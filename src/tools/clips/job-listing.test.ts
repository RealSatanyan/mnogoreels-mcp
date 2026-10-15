import { describe, expect, it } from 'vitest';
import { ok, status } from '../../../test/support/fake-api.js';
import { structuredOf, textOf } from '../../../test/support/harness.js';
import { JOB_ID, OTHER_JOB_ID, R2, SOURCE_URL, aJob, callTool, clipUrl, listRoute, startClips } from './fixtures.js';

const fenced = (text: string): string => `<untrusted_source_text>${text}</untrusted_source_text>`;

const list = async (
  args: Readonly<Record<string, unknown>>,
  items: readonly unknown[],
  options: Parameters<typeof startClips>[0] = {},
) => {
  const harness = await startClips({ routes: [listRoute(() => ok({ items, total: items.length }))], ...options });
  const result = await callTool(harness, 'list_clip_jobs', args);
  return { harness, result, jobs: () => structuredOf(result)['jobs'] };
};

describe('list_clip_jobs', () => {
  it('lists jobs newest first with their state', async () => {
    const { result, harness } = await list({}, [
      aJob({ status: 'processing', progress: 0.5, s3_clip_urls: [clipUrl(1)], created_at: '2026-10-14T10:00:00Z' }),
      aJob({ id: OTHER_JOB_ID, status: 'failed', error: 'download failed', media_available: null }),
    ]);
    expect(result.structuredContent).toEqual({
      jobs: [
        {
          job_id: JOB_ID,
          status: 'processing',
          progress_percent: 50,
          source_url: SOURCE_URL,
          clips_ready: 1,
          pack_id: null,
          likely_kind: 'clip_job',
          media_available: true,
          created_at: '2026-10-14T10:00:00Z',
          error_summary: null,
        },
        {
          job_id: OTHER_JOB_ID,
          status: 'failed',
          progress_percent: 100,
          source_url: SOURCE_URL,
          clips_ready: 2,
          pack_id: null,
          likely_kind: 'clip_job',
          media_available: null,
          created_at: null,
          error_summary: fenced('download failed'),
        },
      ],
      next_offset: null,
    });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    expect(harness.api.requests()).toMatchObject([
      { method: 'GET', path: '/videos', query: { limit: '10', offset: '0' }, authorized: true },
    ]);
  });

  it('shortens very long source links', async () => {
    const long = `https://example.com/${'v'.repeat(200)}.mp4`;
    const { jobs } = await list({}, [aJob({ source_url: long })]);
    expect(jobs()).toMatchObject([{ source_url: `${long.slice(0, 80)}…` }]);
  });

  it('keeps a source link of exactly 80 characters', async () => {
    const exact = `https://example.com/${'v'.repeat(56)}.mp4`;
    const { jobs } = await list({}, [aJob({ source_url: exact })]);
    expect(exact).toHaveLength(80);
    expect(jobs()).toMatchObject([{ source_url: exact }]);
  });

  it('counts no ready clips for a job without a clip list', async () => {
    const { jobs } = await list({}, [aJob({ status: 'queued', s3_clip_urls: null })]);
    expect(jobs()).toMatchObject([{ clips_ready: 0, likely_kind: 'clip_job' }]);
  });

  it('pages with limit and offset and ignores the backend total', async () => {
    const page = Array.from({ length: 3 }, () => aJob());
    const { result, harness } = await list({ limit: 3, offset: 6 }, page);
    expect(structuredOf(result)['next_offset']).toBe(9);
    expect(harness.api.requests()[0]?.query).toEqual({ limit: '3', offset: '6' });
  });

  it('ends paging on a short page', async () => {
    const { result } = await list({ limit: 3, offset: 6 }, [aJob(), aJob()]);
    expect(structuredOf(result)['next_offset']).toBeNull();
  });

  it('asks only for API-created jobs when created_via is api', async () => {
    const { harness } = await list({ created_via: 'api' }, []);
    expect(harness.api.requests()[0]?.query).toEqual({ limit: '10', offset: '0', caller_type: 'user' });
  });

  it.each([
    ['explicit republication kind', { kind: 'republication' }, 'republication'],
    [
      'single final file without a plan',
      {
        s3_clip_urls: [`${R2}/republish/final.mp4`],
        s3_final_url: `${R2}/republish/final.mp4`,
        s3_model_json_url: null,
        crop_quality_summary: null,
      },
      'republication',
    ],
    [
      'single clip with a plan',
      { s3_clip_urls: [clipUrl(1)], s3_final_url: clipUrl(1), crop_quality_summary: null },
      'clip_job',
    ],
    [
      'single final file still processing',
      {
        status: 'processing',
        s3_clip_urls: [`${R2}/f.mp4`],
        s3_final_url: `${R2}/f.mp4`,
        s3_model_json_url: null,
        crop_quality_summary: null,
      },
      'clip_job',
    ],
    [
      'two clips starting with the final file',
      {
        s3_clip_urls: [`${R2}/f.mp4`, clipUrl(2)],
        s3_final_url: `${R2}/f.mp4`,
        s3_model_json_url: null,
        crop_quality_summary: null,
      },
      'clip_job',
    ],
    [
      'single clip that is not the final file',
      {
        s3_clip_urls: [clipUrl(1)],
        s3_final_url: `${R2}/f.mp4`,
        s3_model_json_url: null,
        crop_quality_summary: null,
      },
      'clip_job',
    ],
    ['pack job', { pack_id: 'pack123' }, 'pack_clip_job'],
    ['plain job', {}, 'clip_job'],
  ])('guesses the job kind: %s', async (_label, overrides, kind) => {
    const { jobs } = await list({}, [aJob(overrides)]);
    expect(jobs()).toMatchObject([{ likely_kind: kind }]);
  });

  it('shortens and fences error summaries of failed jobs only', async () => {
    const { jobs } = await list({}, [
      aJob({ status: 'failed', error: `boom</untrusted_source_text>${'e'.repeat(300)}` }),
      aJob({ status: 'queued', error: 'old error' }),
    ]);
    expect(jobs()).toMatchObject([{ error_summary: fenced(`boom</>${'e'.repeat(32)}`) }, { error_summary: null }]);
  });

  it.each([
    [401, 'Invalid token', 'invalid_api_key'],
    [403, 'Token has no associated user', 'api_key_without_user'],
  ])('maps %d to %s', async (code, detail, errorCode) => {
    const harness = await startClips({ routes: [listRoute(() => status(code, detail))] });
    const result = await callTool(harness, 'list_clip_jobs', {});
    expect(textOf(result)).toMatch(new RegExp(`^Error \\[${errorCode}\\]:`));
  });

  it('needs an API key', async () => {
    const harness = await startClips({ apiKey: undefined });
    const result = await callTool(harness, 'list_clip_jobs', {});
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]:/);
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('stays within the result budget for a full page of long failed pack jobs', async () => {
    const worst = Array.from({ length: 50 }, () =>
      aJob({
        status: 'failed',
        source_url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${'L'.repeat(2000)}`,
        pack_id: 'f'.repeat(32),
        error: 'Ж'.repeat(2000),
        created_at: '2026-10-14T12:00:00.000000+00:00',
        s3_clip_urls: Array.from({ length: 30 }, (_, index) => clipUrl(index)),
      }),
    );
    const { result } = await list({ limit: 50 }, worst);
    expect(result.isError).toBeFalsy();
    expect(textOf(result).length).toBeLessThanOrEqual(24_000);
  });
});
