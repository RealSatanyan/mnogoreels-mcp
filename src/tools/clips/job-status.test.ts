import { describe, expect, it, vi } from 'vitest';
import { createFakeClock } from '../../../test/support/clock.js';
import { ok, status, type FakeResponse } from '../../../test/support/fake-api.js';
import { structuredOf, textOf } from '../../../test/support/harness.js';
import {
  JOB_ID,
  R2,
  SOURCE_URL,
  aColdHook,
  aJob,
  aManifest,
  aManifestClip,
  callTool,
  clipUrl,
  jobRoute,
  manifestRoute,
  posterUrl,
  startClips,
  type JobInput,
} from './fixtures.js';

const fenced = (text: string): string => `<untrusted_source_text>${text}</untrusted_source_text>`;
const processing = (overrides: Partial<JobInput> = {}) =>
  aJob({
    status: 'processing',
    progress: 0.42,
    eta_seconds: 240,
    s3_clip_urls: [clipUrl(1), clipUrl(2), clipUrl(3)],
    s3_clip_poster_urls: [posterUrl(1), null, posterUrl(3)],
    ...overrides,
  });
const completedManifest = () =>
  aManifest([
    aManifestClip({ clip_id: 1, final_score: 60, title: 'One' }),
    aManifestClip({ clip_id: 2, final_score: 90, title: 'Two' }),
  ]);

const sequence = (responses: readonly FakeResponse[]) => {
  const remaining = [...responses];
  return () => (remaining.length > 1 ? (remaining.shift() ?? status(500)) : (remaining[0] ?? status(500)));
};

const getClipJob = async (args: Readonly<Record<string, unknown>>, options: Parameters<typeof startClips>[0] = {}) => {
  const harness = await startClips(options);
  const result = await callTool(harness, 'get_clip_job', { job_id: JOB_ID, ...args });
  return { harness, result, polls: () => harness.api.requestsTo('GET', `/videos/${JOB_ID}`) };
};

describe('get_clip_job while the job runs', () => {
  it('returns a snapshot with the ready-clip count but no clips', async () => {
    const { result, harness } = await getClipJob({ wait_sec: 0 }, { routes: [jobRoute(() => ok(processing()))] });
    expect(result.structuredContent).toEqual({
      job_id: JOB_ID,
      status: 'processing',
      is_terminal: false,
      progress_percent: 42,
      eta_seconds: 240,
      source_url: SOURCE_URL,
      media_available: true,
      clips_total: 3,
      clips: [],
      details_available: false,
      cold_hooks: [],
      teasers: [],
      pack_id: null,
      error: null,
      waited_sec: 0,
      next_step: 'Call get_clip_job again with wait_sec=50.',
    });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    expect(harness.api.requests()).toHaveLength(1);
  });

  it('returns the clips finished so far when asked, without details', async () => {
    const { result, harness } = await getClipJob(
      { wait_sec: 0, include_partial_clips: true },
      { routes: [jobRoute(() => ok(processing({ teaser_url: `${R2}/teaser.mp4`, cold_hooks: [aColdHook()] })))] },
    );
    expect(structuredOf(result)).toMatchObject({
      clips_total: 3,
      details_available: false,
      teasers: [{ url: `${R2}/teaser.mp4` }],
      cold_hooks: [{ video: { url: aColdHook().url } }],
    });
    expect(structuredOf(result)['clips']).toHaveLength(3);
    expect(harness.api.requestsTo('GET', /model-json/)).toHaveLength(0);
  });

  it('waits with increasing progress notifications and returns when wait_sec runs out', async () => {
    const harness = await startClips({ routes: [jobRoute(() => ok(processing()))] });
    const updates: { progress: number; total?: number; message?: string }[] = [];
    const result = await harness.client.callTool(
      { name: 'get_clip_job', arguments: { job_id: JOB_ID } },
      { onprogress: (progress) => updates.push(progress) },
    );
    expect(structuredOf(result)).toMatchObject({ status: 'processing', waited_sec: 30 });
    expect(updates.map((update) => update.progress)).toEqual([0, 10, 20]);
    expect(updates[0]).toEqual({ progress: 0, total: 30, message: 'processing 42% · 3 clips ready · ETA ~4 min' });
    expect(harness.api.requestsTo('GET', `/videos/${JOB_ID}`)).toHaveLength(4);
  });

  it.each([
    [{ progress: null, eta_seconds: null, s3_clip_urls: [] }, 'queued · 0 clips ready'],
    [{ progress: 0.05, eta_seconds: 42.4, s3_clip_urls: [] }, 'queued 5% · 0 clips ready · ETA ~42 s'],
    [{ progress: null, eta_seconds: 60, s3_clip_urls: null }, 'queued · 0 clips ready · ETA ~1 min'],
  ])('describes progress without unknown pieces %j', async (overrides, message) => {
    const harness = await startClips({ routes: [jobRoute(() => ok(processing({ status: 'queued', ...overrides })))] });
    const updates: { message?: string }[] = [];
    await harness.client.callTool(
      { name: 'get_clip_job', arguments: { job_id: JOB_ID, wait_sec: 10 } },
      { onprogress: (progress) => updates.push(progress) },
    );
    expect(updates[0]?.message).toBe(message);
  });

  it('returns as soon as the job completes', async () => {
    const { result, polls } = await getClipJob(
      { wait_sec: 50 },
      {
        routes: [
          jobRoute(sequence([ok(processing()), ok(processing()), ok(aJob())])),
          manifestRoute(() => ok(completedManifest())),
        ],
      },
    );
    expect(structuredOf(result)).toMatchObject({ status: 'completed', is_terminal: true, waited_sec: 20 });
    expect(polls()).toHaveLength(3);
  });

  it('tells the user about a long wait', async () => {
    const { result } = await getClipJob(
      { wait_sec: 0 },
      { routes: [jobRoute(() => ok(processing({ eta_seconds: 1500 })))] },
    );
    expect(structuredOf(result)['next_step']).toBe(
      'This will take about 25 more minutes; tell the user and offer to check back later, or call get_clip_job again with wait_sec=50.',
    );
  });

  it('keeps the regular next step at exactly 10 minutes left', async () => {
    const { result } = await getClipJob(
      { wait_sec: 0 },
      { routes: [jobRoute(() => ok(processing({ eta_seconds: 600 })))] },
    );
    expect(structuredOf(result)['next_step']).toBe('Call get_clip_job again with wait_sec=50.');
  });

  it('reports a queued job without any clip lists', async () => {
    const { result } = await getClipJob(
      { wait_sec: 0, include_partial_clips: true },
      {
        routes: [jobRoute(() => ok(processing({ status: 'queued', s3_clip_urls: null, s3_clip_poster_urls: null })))],
      },
    );
    expect(structuredOf(result)).toMatchObject({ clips: [], clips_total: 0 });
  });

  it('describes an unknown status as unknown while waiting', async () => {
    const harness = await startClips({ routes: [jobRoute(() => ok(processing({ status: '<b>rendering</b>' })))] });
    const updates: { message?: string }[] = [];
    await harness.client.callTool(
      { name: 'get_clip_job', arguments: { job_id: JOB_ID, wait_sec: 10 } },
      { onprogress: (progress) => updates.push(progress) },
    );
    expect(updates[0]?.message).toBe('unknown 42% · 3 clips ready · ETA ~4 min');
  });

  it('treats an unknown status as still running', async () => {
    const { result } = await getClipJob(
      { wait_sec: 0 },
      { routes: [jobRoute(() => ok(processing({ status: 'rendering' })))] },
    );
    expect(structuredOf(result)).toMatchObject({ status: 'unknown', is_terminal: false, clips: [] });
  });

  it('reports a job that went back to the queue after failing as queued', async () => {
    const { result } = await getClipJob(
      { wait_sec: 0 },
      { routes: [jobRoute(() => ok(processing({ status: 'queued', error: 'worker crashed' })))] },
    );
    expect(structuredOf(result)).toMatchObject({ status: 'queued', is_terminal: false, error: null });
  });

  it('stops polling when the client cancels', async () => {
    const clock = createFakeClock();
    const harness = await startClips({ clock, transport: 'stdio', routes: [jobRoute(() => ok(processing()))] });
    const controller = new AbortController();
    const pending = harness.client.callTool(
      { name: 'get_clip_job', arguments: { job_id: JOB_ID, wait_sec: 50 } },
      { signal: controller.signal },
    );
    await vi.waitFor(() => {
      expect(clock.pendingSleeps()).toBe(1);
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    await vi.waitFor(() => {
      expect(clock.pendingSleeps()).toBe(0);
    });
    clock.advance(60_000);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(harness.api.requestsTo('GET', `/videos/${JOB_ID}`)).toHaveLength(1);
  });

  it('returns the last snapshot when a slow poll runs into the time budget', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const calls = { count: 0 };
    const { result } = await getClipJob(
      { wait_sec: 50 },
      {
        clock,
        routes: [
          jobRoute((request) => {
            calls.count += 1;
            if (calls.count > 1) {
              return new Promise((resolve) => {
                request.signal?.addEventListener('abort', () => {
                  resolve('network-error');
                });
              });
            }
            clock.advance(34_000);
            return ok(processing());
          }),
        ],
      },
    );
    expect(structuredOf(result)).toMatchObject({ status: 'processing', waited_sec: 44, clips: [] });
  }, 20_000);
});

describe('get_clip_job for a finished job', () => {
  it('returns clips joined with their titles and scores, best first', async () => {
    const { result } = await getClipJob(
      { wait_sec: 0 },
      {
        routes: [
          jobRoute(() =>
            ok(
              aJob({
                cold_hooks: [aColdHook()],
                teaser_urls: [`${R2}/t.mp4`],
                teaser_url: `${R2}/t.mp4`,
                pack_id: 'p1',
              }),
            ),
          ),
          manifestRoute(() => ok(completedManifest())),
        ],
      },
    );
    expect(result.structuredContent).toEqual({
      job_id: JOB_ID,
      status: 'completed',
      is_terminal: true,
      progress_percent: 100,
      eta_seconds: null,
      source_url: SOURCE_URL,
      media_available: true,
      clips_total: 2,
      clips: [
        {
          clip_id: 2,
          video: { url: clipUrl(2) },
          title: fenced('Two'),
          score: 90,
          duration_sec: 42.7,
          hook: fenced('The one habit that changed everything'),
        },
        {
          clip_id: 1,
          video: { url: clipUrl(1) },
          title: fenced('One'),
          score: 60,
          duration_sec: 42.7,
          hook: fenced('The one habit that changed everything'),
        },
      ],
      details_available: true,
      cold_hooks: [{ video: { url: aColdHook().url }, duration_sec: 4.3 }],
      teasers: [{ url: `${R2}/t.mp4` }],
      pack_id: 'p1',
      error: null,
      waited_sec: 0,
      next_step: null,
    });
  });

  it('adds descriptions, excerpts, posters and timings in detailed mode', async () => {
    const { result } = await getClipJob(
      { wait_sec: 0, response_format: 'detailed', max_clips: 1 },
      { routes: [jobRoute(() => ok(aJob())), manifestRoute(() => ok(completedManifest()))] },
    );
    expect(structuredOf(result)['clips']).toEqual([
      expect.objectContaining({
        clip_id: 2,
        description: fenced('A short story about habits.'),
        transcript_excerpt: fenced('So the thing about habits is that they compound over time.'),
        poster_url: posterUrl(2),
        source_start_sec: 12.5,
        source_end_sec: 55.25,
      }),
    ]);
    expect(structuredOf(result)['clips_total']).toBe(2);
  });

  it('refuses more than 10 detailed clips without calling MnogoReels', async () => {
    const { result, harness } = await getClipJob({ response_format: 'detailed', max_clips: 11 });
    expect(
      textOf(result).startsWith(
        'Error [invalid_arguments]: detailed returns at most 10 clips per call; lower max_clips or use concise.',
      ),
    ).toBe(true);
    expect(harness.api.requests()).toHaveLength(0);
  });

  it.each([
    ['server error', () => status(500)],
    ['not ready', () => status(400, 'job not ready (status=processing)')],
    ['unexpected body', () => ok({ clips: 'nope' })],
  ])('returns clips without details when the manifest fails (%s)', async (_label, respond) => {
    const { result } = await getClipJob(
      { wait_sec: 0 },
      { routes: [jobRoute(() => ok(aJob())), manifestRoute(respond)] },
    );
    expect(structuredOf(result)).toMatchObject({ details_available: false, next_step: null });
    expect(structuredOf(result)['clips']).toEqual([
      expect.objectContaining({ clip_id: 1, title: null, score: null }),
      expect.objectContaining({ clip_id: 2, title: null, score: null }),
    ]);
  });

  it('skips the manifest when too little time is left in the call', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const { result, harness } = await getClipJob(
      { wait_sec: 0 },
      {
        clock,
        routes: [
          jobRoute(() => {
            clock.advance(44_500);
            return ok(aJob());
          }),
        ],
      },
    );
    expect(structuredOf(result)).toMatchObject({
      details_available: false,
      next_step: 'Call get_clip_job again with wait_sec=0 for titles and scores.',
    });
    expect(harness.api.requestsTo('GET', /model-json/)).toHaveLength(0);
  });

  it('explains a failed job and how to re-run it', async () => {
    const { result, harness } = await getClipJob(
      { wait_sec: 30 },
      { routes: [jobRoute(() => ok(aJob({ status: 'failed', error: `download failed ${'x'.repeat(400)}` })))] },
    );
    expect(structuredOf(result)).toMatchObject({
      status: 'failed',
      is_terminal: true,
      error: {
        message: fenced(`download failed ${'x'.repeat(284)}`),
        hint: 'Call retry_clip_job to re-run it for free, or check_video_source to see whether the source still works.',
      },
      next_step: null,
      waited_sec: 0,
    });
    expect(harness.api.requestsTo('GET', /model-json/)).toHaveLength(0);
  });

  it('reports a failure without a reason', async () => {
    const { result } = await getClipJob({ wait_sec: 0 }, { routes: [jobRoute(() => ok(aJob({ status: 'failed' })))] });
    expect(structuredOf(result)['error']).toMatchObject({ message: 'MnogoReels did not report a reason.' });
  });

  it('says when the files were deleted by retention', async () => {
    const { result, harness } = await getClipJob(
      { wait_sec: 0 },
      { routes: [jobRoute(() => ok(aJob({ media_available: false, teaser_url: `${R2}/t.mp4` })))] },
    );
    expect(structuredOf(result)).toMatchObject({
      media_available: false,
      clips_total: 2,
      clips: [],
      cold_hooks: [],
      teasers: [],
      next_step: 'The files were deleted by storage retention.',
    });
    expect(harness.api.requestsTo('GET', /model-json/)).toHaveLength(0);
  });

  it('adds proxy stream links only when the operator enabled them', async () => {
    const { result } = await getClipJob(
      { wait_sec: 0 },
      { config: { mediaUrls: 'both' }, routes: [jobRoute(() => ok(aJob())), manifestRoute(() => ok(aManifest([])))] },
    );
    expect(structuredOf(result)['clips']).toContainEqual(
      expect.objectContaining({
        video: {
          url: clipUrl(1),
          stream_url: `https://mnogo-reels.ru/api/video/stream?url=${encodeURIComponent(clipUrl(1))}`,
        },
      }),
    );
  });
});

describe('get_clip_job errors', () => {
  it.each([
    [404, 'job not found', 'not_found'],
    [401, 'Invalid token', 'invalid_api_key'],
  ])('maps %d to %s', async (code, detail, errorCode) => {
    const { result } = await getClipJob({ wait_sec: 0 }, { routes: [jobRoute(() => status(code, detail))] });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result)).toMatch(new RegExp(`^Error \\[${errorCode}\\]:`));
  });

  it('needs an API key', async () => {
    const { result, harness } = await getClipJob({}, { apiKey: undefined });
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]:/);
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('rejects a malformed job id through the schema', async () => {
    const harness = await startClips();
    const result = await callTool(harness, 'get_clip_job', { job_id: 'abc' });
    expect(result.isError).toBe(true);
    expect(harness.api.requests()).toHaveLength(0);
  });
});

describe('get_clip_job output size', () => {
  const longText = (n: number) => 'Ж'.repeat(n);
  const worstJob = () =>
    aJob({
      s3_clip_urls: Array.from({ length: 40 }, (_, index) => clipUrl(index + 1)),
      s3_clip_poster_urls: Array.from({ length: 40 }, (_, index) => posterUrl(index + 1)),
      cold_hooks: Array.from({ length: 40 }, (_, index) =>
        aColdHook({ url: `${R2}/smart-reels/${JOB_ID}/hooks/hook_${String(index)}.mp4`, text: longText(1000) }),
      ),
      teaser_urls: Array.from(
        { length: 20 },
        (_, index) => `${R2}/smart-reels/${JOB_ID}/teasers/t_${String(index)}.mp4`,
      ),
      pack_id: 'f'.repeat(32),
      eta_seconds: 99_999,
    });
  const worstManifest = () =>
    aManifest(
      Array.from({ length: 40 }, (_, index) =>
        aManifestClip({
          clip_id: index + 1,
          title: longText(1000),
          hook: longText(1000),
          description: longText(5000),
          text: longText(5000),
          final_score: 99.123456789,
          rendered_duration: 123.456789,
          start: 12_345.678901,
          end: 12_456.789012,
        }),
      ),
    );

  it.each([[{ max_clips: 30, response_format: 'concise' }], [{ max_clips: 10, response_format: 'detailed' }]])(
    'stays within the result budget for %j',
    async (args) => {
      const { result } = await getClipJob(
        { wait_sec: 0, ...args },
        { routes: [jobRoute(() => ok(worstJob())), manifestRoute(() => ok(worstManifest()))] },
      );
      expect(result.isError).toBeFalsy();
      expect(textOf(result).length).toBeLessThanOrEqual(24_000);
    },
  );
});
