import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createFakeClock } from '../../../test/support/clock.js';
import { ok, status, type FakeResponse } from '../../../test/support/fake-api.js';
import { createV1Harness, errorJsonOf, structuredOf, textOf } from '../../../test/support/harness.js';
import { clipsToolset } from './index.js';
import {
  JOB_ID,
  SOURCE_URL,
  aDownloadProbe,
  aJob,
  callTool,
  createRoute,
  downloadsProbeRoute,
  driveProbeRoute,
  startClips,
  yandexProbeRoute,
} from './fixtures.js';

const FORM = { elicitation: { form: {} } };
const createArgs = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  source_url: SOURCE_URL,
  max_credits: 10,
  ...overrides,
});
const queued = (): FakeResponse => ok(aJob({ status: 'queued', s3_clip_urls: [], progress: 0 }));
const probeWith = (duration: number | null) => downloadsProbeRoute(() => ok(aDownloadProbe({ duration })));
const defaultRoutes = () => [probeWith(600), createRoute(queued)];

const deferred = <T>() => {
  const parts: { resolve?: (value: T) => void } = {};
  const promise = new Promise<T>((resolve) => {
    parts.resolve = resolve;
  });
  return { promise, resolve: (value: T) => parts.resolve?.(value) };
};

const create = async (args: Readonly<Record<string, unknown>>, options: Parameters<typeof startClips>[0] = {}) => {
  const harness = await startClips({ routes: defaultRoutes(), ...options });
  const result = await callTool(harness, 'create_clip_job', args);
  return { harness, result, posts: () => harness.api.requestsTo('POST', '/videos') };
};

describe('create_clip_job: a successful submission', () => {
  it('creates the job with an explicit window and reports the charge', async () => {
    const { result, posts } = await create(createArgs());
    expect(result.structuredContent).toEqual({
      job_id: JOB_ID,
      status: 'queued',
      credits: 10,
      start_sec: 0,
      end_sec: 600,
      source_url: SOURCE_URL,
      deduplicated: false,
      next_step: 'Call get_clip_job with job_id and wait_sec=50.',
    });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toMatchObject({ authorized: true, body: { url: SOURCE_URL, start_sec: 0, end_sec: 600 } });
  });

  it('never sends watermark or other unsupported fields', async () => {
    const { posts } = await create(createArgs());
    const body = posts()[0]?.body;
    [
      'watermark',
      'use_custom_watermark',
      'max_clips',
      'clip_analyzer',
      'user_id',
      'user_email',
      'cold_open_black_white',
    ].forEach((field) => {
      expect(body).not.toHaveProperty(field);
    });
  });

  it('charges exactly what quote_clip_job announced, on the same numbers', async () => {
    const harness = await startClips({
      routes: [probeWith(6000), createRoute(queued)],
      config: { maxWindowSec: 3600 },
    });
    const range = { start_sec: 1954.7794, end_sec: 5014.7791 };
    const quote = structuredOf(await callTool(harness, 'quote_clip_job', { source_url: SOURCE_URL, ...range }));
    const created = structuredOf(await callTool(harness, 'create_clip_job', createArgs({ ...range, max_credits: 52 })));
    expect(quote).toMatchObject({ credits: 52, start_sec: 1954.779, end_sec: 5014.779 });
    expect(created).toMatchObject({
      credits: quote['credits'],
      start_sec: quote['start_sec'],
      end_sec: quote['end_sec'],
    });
    expect(harness.api.requestsTo('POST', '/videos')[0]?.body).toMatchObject({
      start_sec: 1954.779,
      end_sec: 5014.779,
    });
    expect(harness.api.requestsTo('POST', '/downloads/probe')).toHaveLength(1);
  });

  it('works without a probe when the range is complete and the check is busy', async () => {
    const { result, posts } = await create(createArgs({ start_sec: 0, end_sec: 120 }), {
      routes: [downloadsProbeRoute(() => status(429, 'slow down', { 'retry-after': '50' })), createRoute(queued)],
    });
    expect(result.structuredContent).toMatchObject({ credits: 2, end_sec: 120 });
    expect(posts()).toHaveLength(1);
  });
});

describe('create_clip_job: refusals before any charge', () => {
  it('refuses a price above max_credits', async () => {
    const { result, posts } = await create(createArgs({ max_credits: 9 }));
    expect(textOf(result)).toBe(
      `Error [spend_cap_exceeded]: This job costs 10 credits but max_credits is 9. Show the price to the user and, if they agree, call again with max_credits ≥ 10.\n${JSON.stringify(
        {
          error: {
            code: 'spend_cap_exceeded',
            message:
              'This job costs 10 credits but max_credits is 9. Show the price to the user and, if they agree, call again with max_credits ≥ 10.',
            retryable: false,
            retry_after_sec: null,
            details: { credits: 10, max_credits: 9, operator_cap: null },
          },
        },
      )}`,
    );
    expect(posts()).toHaveLength(0);
  });

  it('refuses a price above the operator cap whatever max_credits says', async () => {
    const { result, posts } = await create(createArgs({ max_credits: 100_000 }), {
      config: { maxCreditsPerCall: 5 },
    });
    expect(textOf(result)).toMatch(
      /^Error \[operator_cap_exceeded\]: This job costs 10 credits; this server is configured to allow at most 5 credits per call \(MNOGOREELS_MAX_CREDITS_PER_CALL\)\. Choose a shorter range with start_sec\/end_sec\./,
    );
    expect(errorJsonOf(result)).toMatchObject({
      error: { details: { credits: 10, max_credits: 100_000, operator_cap: 5 } },
    });
    expect(posts()).toHaveLength(0);
  });

  it.each([
    ['explicit range', createArgs({ start_sec: 0, end_sec: 1900, max_credits: 100 }), 4000],
    ['range defaulted from a 31-minute probe', createArgs({ max_credits: 100 }), 1860],
  ])('refuses a range over the 30-minute window (%s)', async (_label, args, duration) => {
    const { result, posts } = await create(args, { routes: [probeWith(duration), createRoute(queued)] });
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]: MnogoReels processes at most 30 minutes per job;/);
    expect(textOf(result)).toContain('Split the video into jobs with start_sec/end_sec (e.g. 0–1800, 1800–3600).');
    expect(posts()).toHaveLength(0);
  });

  it('asks for end_sec when the length is unknown', async () => {
    const { result, posts } = await create(createArgs({ source_url: 'https://cdn.example.com/talk.mp4' }), {
      routes: [probeWith(null), createRoute(queued)],
    });
    expect(textOf(result)).toMatch(/^Error \[duration_unknown\]:/);
    expect(posts()).toHaveLength(0);
  });

  it.each([
    [
      'Yandex 404',
      'https://disk.yandex.ru/i/abc',
      yandexProbeRoute(() => status(502, "Yandex Disk API error: Client error '404 Not Found'")),
    ],
    ['Yandex folder', 'https://disk.yandex.ru/d/folder', yandexProbeRoute(() => status(502, 'ffprobe failed: x'))],
    [
      'Drive restricted',
      'https://drive.google.com/file/d/abc/view',
      driveProbeRoute(() => status(502, 'did not return a downloadable URL')),
    ],
    ['audio only', SOURCE_URL, downloadsProbeRoute(() => ok({ downloadable: false, reason: 'audio_only' }))],
  ])('refuses an undownloadable source even with a complete range (%s)', async (_label, url, route) => {
    const { result, posts } = await create(createArgs({ source_url: url, start_sec: 0, end_sec: 60 }), {
      routes: [route, createRoute(queued)],
    });
    expect(textOf(result)).toMatch(/^Error \[source_not_downloadable\]:/);
    expect(textOf(result)).toContain('Nothing was charged.');
    expect(posts()).toHaveLength(0);
  });

  it('refuses an invalid link without any request', async () => {
    const { result, harness } = await create(createArgs({ source_url: 'http://192.168.1.10/video.mp4' }));
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]:/);
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('asks to call again when the source check used up the time to submit safely', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const { result, posts } = await create(createArgs(), {
      clock,
      routes: [
        downloadsProbeRoute(() => {
          clock.advance(26_000);
          return ok(aDownloadProbe());
        }),
        createRoute(queued),
      ],
    });
    expect(textOf(result)).toMatch(
      /^Error \[try_again\]: The source check took too long to submit in this call\. Its result is cached; call create_clip_job again now\./,
    );
    expect(posts()).toHaveLength(0);
  });

  it('needs an API key and checks nothing without it', async () => {
    const { result, harness } = await create(createArgs(), { apiKey: undefined });
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]:/);
    expect(harness.api.requests()).toHaveLength(0);
  });
});

describe('create_clip_job: backend answers', () => {
  it.each([
    [402, 'Not enough credits', 'insufficient_credits'],
    [401, 'Invalid token', 'invalid_api_key'],
    [403, 'Token has no associated user', 'api_key_without_user'],
    [400, 'url is not allowed', 'source_url_not_allowed'],
    [503, 'Billing is not configured', 'service_unavailable'],
  ])('maps %d to %s', async (code, detail, errorCode) => {
    const { result, posts } = await create(createArgs(), {
      routes: [probeWith(600), createRoute(() => status(code, detail))],
    });
    expect(textOf(result)).toMatch(new RegExp(`^Error \\[${errorCode}\\]:`));
    expect(posts()).toHaveLength(1);
  });

  it('reports an unconfirmed billing failure without retrying', async () => {
    const harness = await startClips({
      routes: [probeWith(600), createRoute(() => status(503, 'Billing service unavailable'))],
    });
    const first = await callTool(harness, 'create_clip_job', createArgs());
    const second = await callTool(harness, 'create_clip_job', createArgs());
    expect(textOf(first)).toMatch(/^Error \[billing_uncertain\]:/);
    expect(textOf(second)).toMatch(/^Error \[(billing_uncertain|outcome_unknown)\]:/);
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(1);
  });

  it.each([
    ['internal error', () => status(500)],
    ['gateway timeout', () => status(504)],
    ['network failure', () => 'network-error' as const],
  ])(
    'reports an unknown outcome (%s), never retries, and replays it for an identical call',
    async (_label, respond) => {
      const harness = await startClips({ routes: [probeWith(600), createRoute(respond)] });
      const first = await callTool(harness, 'create_clip_job', createArgs());
      const second = await callTool(harness, 'create_clip_job', createArgs());
      expect(textOf(first)).toMatch(/^Error \[outcome_unknown\]: .*check list_clip_jobs before trying again/);
      expect(textOf(second)).toMatch(/^Error \[outcome_unknown\]:/);
      expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(1);
    },
  );
});

describe('create_clip_job: duplicate-submit guard', () => {
  it('returns the first job for an identical call instead of charging again', async () => {
    const harness = await startClips({ routes: defaultRoutes() });
    await callTool(harness, 'create_clip_job', createArgs());
    const second = await callTool(harness, 'create_clip_job', createArgs());
    expect(second.structuredContent).toMatchObject({ job_id: JOB_ID, credits: 10, deduplicated: true });
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(1);
  });

  it('sends one request for concurrent identical calls', async () => {
    const answer = deferred<FakeResponse>();
    const harness = await startClips({ routes: [probeWith(600), createRoute(() => answer.promise)] });
    const first = callTool(harness, 'create_clip_job', createArgs());
    await vi.waitFor(() => {
      expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(1);
    });
    const second = callTool(harness, 'create_clip_job', createArgs());
    await new Promise((resolve) => setTimeout(resolve, 20));
    answer.resolve(queued());
    const results = await Promise.all([first, second]);
    expect(results.map((result) => structuredOf(result)['deduplicated'])).toEqual([false, true]);
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(1);
  });

  it.each([
    [402, 'Not enough credits'],
    [422, 'bad request'],
  ])('lets the user try again after a definite refusal (%d)', async (code, detail) => {
    const answers = [status(code, detail), queued()];
    const harness = await startClips({
      routes: [probeWith(600), createRoute(() => answers.shift() ?? queued())],
    });
    await callTool(harness, 'create_clip_job', createArgs());
    const second = await callTool(harness, 'create_clip_job', createArgs());
    expect(structuredOf(second)).toMatchObject({ deduplicated: false });
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(2);
  });

  it('charges again only when allow_duplicate is set', async () => {
    const harness = await startClips({ routes: defaultRoutes() });
    await callTool(harness, 'create_clip_job', createArgs());
    const second = await callTool(harness, 'create_clip_job', createArgs({ allow_duplicate: true }));
    const third = await callTool(harness, 'create_clip_job', createArgs({ allow_duplicate: true }));
    expect([structuredOf(second)['deduplicated'], structuredOf(third)['deduplicated']]).toEqual([false, false]);
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(3);
  });

  it('treats different options as a different job', async () => {
    const harness = await startClips({ routes: defaultRoutes() });
    await callTool(harness, 'create_clip_job', createArgs());
    const second = await callTool(harness, 'create_clip_job', createArgs({ caption_style: 'hormozi' }));
    expect(structuredOf(second)['deduplicated']).toBe(false);
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(2);
  });

  it('never shares the guard between API keys', async () => {
    const first = await startClips({ routes: defaultRoutes() });
    await callTool(first, 'create_clip_job', createArgs());
    const other = await startClips({ apiKey: 'mrfrt_usr_AnotherUserKey0123456789', deps: first.deps });
    const second = await callTool(other, 'create_clip_job', createArgs());
    expect(structuredOf(second)['deduplicated']).toBe(false);
    expect(first.api.requestsTo('POST', '/videos')).toHaveLength(2);
  });

  it('finishes the paid request when the client cancels and remembers its job', async () => {
    const answer = deferred<FakeResponse>();
    const harness = await startClips({
      transport: 'stdio',
      routes: [probeWith(600), createRoute(() => answer.promise)],
    });
    const controller = new AbortController();
    const cancelled = harness.client.callTool(
      { name: 'create_clip_job', arguments: createArgs() },
      { signal: controller.signal },
    );
    await vi.waitFor(() => {
      expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(1);
    });
    controller.abort();
    await expect(cancelled).rejects.toThrow();
    expect(harness.api.requestsTo('POST', '/videos')[0]?.signal?.aborted).toBe(false);
    answer.resolve(queued());
    await new Promise((resolve) => setTimeout(resolve, 20));
    const again = await callTool(harness, 'create_clip_job', createArgs());
    expect(again.structuredContent).toMatchObject({ job_id: JOB_ID, deduplicated: true });
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(1);
  });
});

describe('create_clip_job: confirmation', () => {
  const MESSAGE =
    'Create clips from "Talk about habits" (10:00 of video) for 10 credits? Credits are charged now. Jobs cannot be cancelled, and credits are not returned automatically if processing fails.';

  it.each([
    ['stdio', 'legacy'],
    ['stdio', 'modern'],
    ['http', 'modern'],
  ] as const)('asks the user and creates one job on accept (%s %s)', async (transport, era) => {
    const asked: string[] = [];
    const { result, posts } = await create(createArgs(), {
      transport,
      era,
      clientCapabilities: FORM,
      onElicit: (request) => {
        asked.push(request.params.message);
        return { action: 'accept', content: { confirm: true } };
      },
    });
    expect(result.structuredContent).toMatchObject({ job_id: JOB_ID, deduplicated: false });
    expect(asked).toEqual([MESSAGE]);
    expect(posts()).toHaveLength(1);
  });

  it.each([
    ['stdio', 'legacy', { action: 'decline' }],
    ['stdio', 'modern', { action: 'cancel' }],
    ['http', 'modern', { action: 'accept', content: { confirm: false } }],
  ] as const)('charges nothing when the user says no (%s %s)', async (transport, era, answer) => {
    const { result, posts } = await create(createArgs(), {
      transport,
      era,
      clientCapabilities: FORM,
      onElicit: () => answer,
    });
    expect(textOf(result)).toMatch(
      /^Error \[cancelled_by_user\]: The user declined to spend 10 credits\. Nothing was charged\./,
    );
    expect(posts()).toHaveLength(0);
  });

  it('names the link host when the title is unknown and shortens long titles', async () => {
    const asked: string[] = [];
    const onElicit = (request: { readonly params: { readonly message: string } }) => {
      asked.push(request.params.message);
      return { action: 'accept' as const, content: { confirm: true } };
    };
    await create(createArgs({ start_sec: 15, end_sec: 60.5 }), {
      transport: 'stdio',
      clientCapabilities: FORM,
      onElicit,
      routes: [downloadsProbeRoute(() => status(429, 'busy', { 'retry-after': '60' })), createRoute(queued)],
    });
    await create(createArgs(), {
      transport: 'stdio',
      clientCapabilities: FORM,
      onElicit,
      routes: [
        downloadsProbeRoute(() => ok(aDownloadProbe({ title: `‮${'Long title '.repeat(10)}` }))),
        createRoute(queued),
      ],
    });
    expect(asked[0]).toMatch(/^Create clips from "www\.youtube\.com" \(0:45 of video\) for 1 credits\?/);
    expect(asked[1]).toContain(`"${'Long title '.repeat(10).slice(0, 80)}"`);
  });

  it('accepts a confirmation that took longer than the submit budget', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const { result, posts } = await create(createArgs(), {
      clock,
      transport: 'stdio',
      clientCapabilities: FORM,
      onElicit: () => {
        clock.advance(40_000);
        return { action: 'accept', content: { confirm: true } };
      },
    });
    expect(result.structuredContent).toMatchObject({ job_id: JOB_ID });
    expect(posts()).toHaveLength(1);
  });

  it('does not ask a 2025-era client on the remote server and creates one job', async () => {
    const onElicit = vi.fn(() => ({ action: 'accept' as const, content: { confirm: true } }));
    const { result, posts } = await create(createArgs(), { era: 'legacy', clientCapabilities: FORM, onElicit });
    expect(result.structuredContent).toMatchObject({ job_id: JOB_ID });
    expect(onElicit).not.toHaveBeenCalled();
    expect(posts()).toHaveLength(1);
  });

  it('creates the job directly for a client without elicitation support', async () => {
    const { result, posts } = await create(createArgs(), { transport: 'stdio' });
    expect(result.structuredContent).toMatchObject({ job_id: JOB_ID });
    expect(posts()).toHaveLength(1);
  });

  it('does not ask again for a deduplicated call', async () => {
    const onElicit = vi.fn(() => ({ action: 'accept' as const, content: { confirm: true } }));
    const harness = await startClips({
      transport: 'stdio',
      clientCapabilities: FORM,
      onElicit,
      routes: defaultRoutes(),
    });
    await callTool(harness, 'create_clip_job', createArgs());
    const second = await callTool(harness, 'create_clip_job', createArgs());
    expect(structuredOf(second)['deduplicated']).toBe(true);
    expect(onElicit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['accept', { action: 'accept', content: { confirm: true } }, 1],
    ['decline', { action: 'decline' }, 0],
  ] as const)('works with the v1 client over stdio (%s)', async (_label, answer, expectedPosts) => {
    const harness = await createV1Harness({
      tools: clipsToolset.tools,
      routes: defaultRoutes(),
      clientCapabilities: FORM,
      onElicit: () => answer,
    });
    onTestFinished(harness.close);
    const result = await harness.client.callTool({ name: 'create_clip_job', arguments: createArgs() });
    expect(Boolean(result.isError)).toBe(expectedPosts === 0);
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(expectedPosts);
  });
});

describe('create_clip_job: availability', () => {
  it.each([
    ['read-only mode', { readOnly: true }],
    ['readonly profile', { readOnly: true, profile: 'readonly' as const }],
  ])('is not offered in %s', async (_label, config) => {
    const harness = await startClips({ config, routes: defaultRoutes() });
    const names = (await harness.client.listTools()).tools.map((tool) => tool.name);
    expect(names).not.toContain('create_clip_job');
    await expect(callTool(harness, 'create_clip_job', createArgs())).rejects.toMatchObject({ code: -32602 });
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('stops after 20 paid calls per hour', async () => {
    const clock = createFakeClock();
    const harness = await startClips({ clock, routes: defaultRoutes() });
    const results = await Array.from({ length: 21 }).reduce<Promise<unknown[]>>(
      async (previous) => [...(await previous), await callTool(harness, 'create_clip_job', createArgs())],
      Promise.resolve([]),
    );
    expect(textOf(results[19])).not.toMatch(/^Error/);
    expect(textOf(results[20])).toMatch(/^Error \[rate_limited_local\]: Too many paid calls with this API key\./);
  });

  it('keeps the key and the arguments out of the logs', async () => {
    const { harness } = await create(
      createArgs({ source_url: `${SOURCE_URL}&secret=abc123`, prompt: 'private words' }),
    );
    const logs = harness.logs.text();
    expect(logs).not.toContain('mrfrt_usr_TestKey');
    expect(logs).not.toContain('abc123');
    expect(logs).not.toContain('private words');
  });
});

describe('create_clip_job: source checks, time budget and unknown outcomes', () => {
  it('needs the source check when end_sec is missing, even if the check is busy', async () => {
    const { result, posts } = await create(createArgs(), {
      routes: [downloadsProbeRoute(() => status(429, 'slow down', { 'retry-after': '50' })), createRoute(queued)],
    });
    expect(textOf(result)).toMatch(/^Error \[rate_limited\]:/);
    expect(posts()).toHaveLength(0);
  });

  it('still submits when the source check took exactly the submit budget', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const { result, posts } = await create(createArgs(), {
      clock,
      routes: [
        downloadsProbeRoute(() => {
          clock.advance(25_000);
          return ok(aDownloadProbe());
        }),
        createRoute(queued),
      ],
    });
    expect(result.structuredContent).toMatchObject({ job_id: JOB_ID });
    expect(posts()).toHaveLength(1);
  });

  it('refuses a repeat of a request with an unknown outcome without asking the user again', async () => {
    const onElicit = vi.fn(() => ({ action: 'accept' as const, content: { confirm: true } }));
    const harness = await startClips({
      transport: 'stdio',
      clientCapabilities: FORM,
      onElicit,
      routes: [probeWith(600), createRoute(() => 'network-error')],
    });
    const first = await callTool(harness, 'create_clip_job', createArgs());
    const second = await callTool(harness, 'create_clip_job', createArgs());
    expect(textOf(first)).toMatch(/^Error \[outcome_unknown\]:/);
    expect(textOf(second)).toMatch(/^Error \[outcome_unknown\]:/);
    expect(onElicit).toHaveBeenCalledTimes(1);
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(1);
  });
});
