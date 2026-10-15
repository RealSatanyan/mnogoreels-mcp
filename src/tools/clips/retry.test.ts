import { describe, expect, it } from 'vitest';
import { ok, status, type FakeRoute } from '../../../test/support/fake-api.js';
import { textOf } from '../../../test/support/harness.js';
import { JOB_ID, aJob, callTool, jobKindRoutes, jobRoute, reloadRoute, startClips } from './fixtures.js';

const retry = async (options: {
  readonly state?: string;
  readonly kind?: 'clip' | 'transcription' | 'republication';
  readonly reload?: FakeRoute['respond'];
  readonly apiKey?: string | undefined;
}) => {
  const harness = await startClips({
    ...('apiKey' in options ? { apiKey: options.apiKey } : {}),
    routes: [
      ...jobKindRoutes(options.kind ?? 'clip'),
      jobRoute(() => ok(aJob({ status: options.state ?? 'failed', error: 'render failed' }))),
      reloadRoute(options.reload ?? (() => ok(aJob({ status: 'queued', s3_clip_urls: [], error: null })))),
    ],
  });
  const result = await callTool(harness, 'retry_clip_job', { job_id: JOB_ID });
  return { harness, result, reloads: () => harness.api.requestsTo('POST', `/tasks/${JOB_ID}/reload`) };
};

describe('retry_clip_job', () => {
  it('re-runs a failed clip job for free under the same id', async () => {
    const { result, reloads, harness } = await retry({});
    expect(result.structuredContent).toEqual({
      job_id: JOB_ID,
      status: 'queued',
      previous_status: 'failed',
      next_step: 'Call get_clip_job with job_id and wait_sec=50.',
    });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    expect(reloads()).toHaveLength(1);
    expect(reloads()[0]?.authorized).toBe(true);
    expect(harness.api.requestsTo('GET', /^\/(transcriptions|republications)\//)).toHaveLength(2);
  });

  it('refuses a completed job without posting', async () => {
    const { result, reloads } = await retry({ state: 'completed' });
    expect(textOf(result)).toMatch(
      /^Error \[job_not_retryable\]: This job completed\. Use recut_clip_job to make a new variant \(paid\), or get_clip_job to see its clips\./,
    );
    expect(reloads()).toHaveLength(0);
  });

  it.each(['queued', 'processing', 'rendering'])('refuses a job that is %s without posting', async (state) => {
    const { result, reloads } = await retry({ state });
    expect(textOf(result)).toMatch(/^Error \[job_already_running\]: The job is still queued or processing/);
    expect(reloads()).toHaveLength(0);
  });

  it.each([
    ['transcription', 'This is a transcription id; use get_transcription.'],
    ['republication', 'This is a republication job, not a clip job; it cannot be retried or recut here.'],
  ] as const)('refuses a failed %s id without posting', async (kind, message) => {
    const { result, reloads } = await retry({ kind });
    expect(textOf(result).startsWith(`Error [invalid_arguments]: ${message}`)).toBe(true);
    expect(reloads()).toHaveLength(0);
  });

  it('maps a race with another retry', async () => {
    const { result, reloads } = await retry({
      reload: () => status(400, 'job is already running (status=queued)'),
    });
    expect(textOf(result)).toMatch(/^Error \[job_already_running\]:/);
    expect(reloads()).toHaveLength(1);
  });

  it('never repeats the request on a server error', async () => {
    const { result, reloads } = await retry({ reload: () => status(503, 'failed to enqueue reload') });
    expect(textOf(result)).toMatch(/^Error \[service_unavailable\]:/);
    expect(reloads()).toHaveLength(1);
  });

  it('reports a server error during the restart without promising a charge', async () => {
    const { result, reloads } = await retry({ reload: () => status(500, 'boom') });
    expect(textOf(result)).toMatch(
      /^Error \[outcome_unknown\]: MnogoReels returned an internal error while restarting the clip job\. Retrying is free/,
    );
    expect(reloads()).toHaveLength(1);
  });

  it.each([
    [() => status(500, 'boom'), /^Error \[upstream_error\]:/],
    [() => status(403, 'job belongs to another user'), /^Error \[not_found\]: No clip job with this id/],
  ])('stops without posting when the job kind cannot be checked (%#)', async (respond, expected) => {
    const harness = await startClips({
      routes: [
        { method: 'GET', path: `/transcriptions/${JOB_ID}`, respond },
        ...jobKindRoutes().filter((route) => route.path !== `/transcriptions/${JOB_ID}`),
        jobRoute(() => ok(aJob({ status: 'failed' }))),
        reloadRoute(() => ok(aJob({ status: 'queued' }))),
      ],
    });
    const result = await callTool(harness, 'retry_clip_job', { job_id: JOB_ID });
    expect(textOf(result)).toMatch(expected);
    expect(harness.api.requestsTo('POST', `/tasks/${JOB_ID}/reload`)).toHaveLength(0);
  });

  it('reports an unknown job', async () => {
    const harness = await startClips({ routes: [jobRoute(() => status(404, 'job not found'))] });
    const result = await callTool(harness, 'retry_clip_job', { job_id: JOB_ID });
    expect(textOf(result)).toMatch(/^Error \[not_found\]: No clip job with this id/);
  });

  it('needs an API key', async () => {
    const { result, harness } = await retry({ apiKey: undefined });
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]:/);
    expect(harness.api.requests()).toHaveLength(0);
  });
});
