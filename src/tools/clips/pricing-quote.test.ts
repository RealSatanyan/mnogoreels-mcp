import { describe, expect, it } from 'vitest';
import { ok, status } from '../../../test/support/fake-api.js';
import { errorJsonOf, textOf } from '../../../test/support/harness.js';
import {
  JOB_ID,
  SOURCE_URL,
  aDownloadProbe,
  aJob,
  callTool,
  downloadsProbeRoute,
  jobKindRoutes,
  jobRoute,
  startClips,
} from './fixtures.js';

const fenced = (text: string): string => `<untrusted_source_text>${text}</untrusted_source_text>`;
const NOTE =
  'Jobs cannot be cancelled. If processing fails, credits are not returned automatically; retry_clip_job re-runs a failed job for free, or contact support@mnogo-reels.ru with the job_id.';

const quote = async (args: Readonly<Record<string, unknown>>, options: Parameters<typeof startClips>[0] = {}) => {
  const harness = await startClips(options);
  const result = await callTool(harness, 'quote_clip_job', args);
  return { harness, result };
};

const probeWith = (duration: number | null) => downloadsProbeRoute(() => ok(aDownloadProbe({ duration })));
const recutRoutes = (job = aJob(), kind: 'clip' | 'transcription' | 'republication' = 'clip') => [
  ...jobKindRoutes(kind),
  jobRoute(() => ok(job)),
];

describe('quote_clip_job for a new video', () => {
  it('prices the whole video from its probed length', async () => {
    const { result } = await quote({ source_url: SOURCE_URL }, { routes: [probeWith(600)], apiKey: undefined });
    expect(result.structuredContent).toEqual({
      credits: 10,
      credits_exact: true,
      billed_seconds: 600,
      start_sec: 0,
      end_sec: 600,
      source_url: SOURCE_URL,
      platform: 'youtube',
      downloadable: true,
      source_title: fenced('Talk about habits'),
      source_duration_sec: 600,
      job_id: null,
      pricing_rule: '1 credit per started minute of the range, minimum 1; at most 30 minutes per job.',
      note: NOTE,
    });
  });

  it('prices an explicit range on the exact numbers that will be sent', async () => {
    const { result } = await quote(
      { source_url: SOURCE_URL, start_sec: 1954.7794, end_sec: 5014.7791 },
      { routes: [probeWith(6000)], config: { maxWindowSec: 3600 } },
    );
    expect(result.structuredContent).toMatchObject({
      credits: 52,
      billed_seconds: 3060,
      start_sec: 1954.779,
      end_sec: 5014.779,
      pricing_rule: '1 credit per started minute of the range, minimum 1; at most 60 minutes per job.',
    });
  });

  it('refuses a source the probe reports as not downloadable, even with a complete range', async () => {
    const { result } = await quote(
      { source_url: SOURCE_URL, start_sec: 0, end_sec: 60 },
      { routes: [downloadsProbeRoute(() => ok({ downloadable: false, reason: 'audio_only' }))] },
    );
    expect(textOf(result)).toMatch(
      /^Error \[source_not_downloadable\]: MnogoReels cannot download this source \(audio_only:/,
    );
    expect(errorJsonOf(result)).toMatchObject({ error: { details: { reason: 'audio_only' } } });
  });

  it('asks for end_sec when the length is unknown', async () => {
    const { result } = await quote({ source_url: 'https://cdn.example.com/talk.mp4' }, { routes: [probeWith(null)] });
    expect(textOf(result)).toMatch(/^Error \[duration_unknown\]: The length of this video is not reported/);
  });

  it('prices a direct file link when end_sec is given', async () => {
    const { result } = await quote(
      { source_url: 'https://cdn.example.com/talk.mp4', end_sec: 90 },
      { routes: [probeWith(null)] },
    );
    expect(result.structuredContent).toMatchObject({
      credits: 2,
      platform: 'direct_file',
      downloadable: true,
      source_duration_sec: null,
    });
  });

  it('refuses a video longer than 30 minutes without a range', async () => {
    const { result, harness } = await quote({ source_url: SOURCE_URL }, { routes: [probeWith(1860)] });
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]: MnogoReels processes at most 30 minutes per job;/);
    expect(harness.api.requestsTo('POST', '/videos')).toHaveLength(0);
  });

  it.each([
    ['rate limit', () => status(429, 'slow down', { 'retry-after': '40' })],
    ['gateway timeout', () => status(504)],
    ['network error', () => 'network-error' as const],
  ])('still prices a complete range when the check is temporarily unavailable (%s)', async (_label, respond) => {
    const { result } = await quote(
      { source_url: SOURCE_URL, start_sec: 30, end_sec: 150 },
      { routes: [downloadsProbeRoute(respond)] },
    );
    expect(result.structuredContent).toMatchObject({
      credits: 2,
      start_sec: 30,
      end_sec: 150,
      platform: 'youtube',
      downloadable: null,
      source_title: null,
      source_duration_sec: null,
    });
  });

  it('reports the probe error when the range is incomplete', async () => {
    const { result } = await quote(
      { source_url: SOURCE_URL, start_sec: 30 },
      { routes: [downloadsProbeRoute(() => status(429, 'slow down', { 'retry-after': '40' }))] },
    );
    expect(textOf(result)).toMatch(/^Error \[rate_limited\]:/);
  });

  it.each([
    ['neither', {}],
    ['both', { source_url: SOURCE_URL, job_id: JOB_ID }],
  ])('needs exactly one of source_url and job_id (%s)', async (_label, args: Readonly<Record<string, unknown>>) => {
    const { result, harness } = await quote(args);
    expect(
      textOf(result).startsWith(
        'Error [invalid_arguments]: Give exactly one of source_url (new video) or job_id (recut).',
      ),
    ).toBe(true);
    expect(harness.api.requests()).toHaveLength(0);
  });
});

describe('quote_clip_job for a recut', () => {
  it('prices a recut that reuses the original range as an upper bound', async () => {
    const { result, harness } = await quote({ job_id: JOB_ID }, { routes: [...recutRoutes(), probeWith(1234.5678)] });
    expect(result.structuredContent).toMatchObject({
      credits: 21,
      credits_exact: false,
      billed_seconds: null,
      start_sec: null,
      end_sec: null,
      source_url: SOURCE_URL,
      source_duration_sec: 1234.6,
      job_id: JOB_ID,
    });
    expect(harness.api.requests().map((request) => `${request.method} ${request.path}`)).toEqual(
      expect.arrayContaining([
        `GET /transcriptions/${JOB_ID}`,
        `GET /republications/${JOB_ID}`,
        `GET /videos/${JOB_ID}`,
        'POST /downloads/probe',
      ]),
    );
    expect(harness.api.requestsTo('POST', '/downloads/probe')[0]?.body).toEqual({ url: SOURCE_URL });
  });

  it('prices an explicit recut range exactly', async () => {
    const { result } = await quote({ job_id: JOB_ID, start_sec: 60 }, { routes: [...recutRoutes(), probeWith(400)] });
    expect(result.structuredContent).toMatchObject({ credits: 6, credits_exact: true, start_sec: 60, end_sec: 400 });
  });

  it('prices a recut range given only by its end exactly', async () => {
    const { result } = await quote({ job_id: JOB_ID, end_sec: 120 }, { routes: [...recutRoutes(), probeWith(400)] });
    expect(result.structuredContent).toMatchObject({ credits: 2, credits_exact: true, start_sec: 0, end_sec: 120 });
  });

  it('refuses an inherited range on a source longer than the cap', async () => {
    const { result } = await quote({ job_id: JOB_ID }, { routes: [...recutRoutes(), probeWith(2000)] });
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]: The source is longer than 30 minutes/);
  });

  it.each([
    ['transcription', 'This is a transcription id; use get_transcription.'],
    ['republication', 'This is a republication job, not a clip job; it cannot be retried or recut here.'],
  ] as const)('refuses a %s id', async (kind, message) => {
    const { result, harness } = await quote({ job_id: JOB_ID }, { routes: recutRoutes(aJob(), kind) });
    expect(textOf(result).startsWith(`Error [invalid_arguments]: ${message}`)).toBe(true);
    expect(harness.api.requestsTo('POST', /.*/)).toHaveLength(0);
  });

  it('needs an API key for a job id', async () => {
    const { result, harness } = await quote({ job_id: JOB_ID }, { apiKey: undefined });
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]:/);
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('refuses a malformed API key for a job id', async () => {
    const { result, harness } = await quote({ job_id: JOB_ID }, { apiKey: 'mrfrt_svc_abcdefghijklmnopqrstuvwx' });
    expect(textOf(result)).toMatch(/^Error \[invalid_api_key_format\]:/);
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('reports an unknown job', async () => {
    const { result } = await quote(
      { job_id: JOB_ID },
      { routes: [...jobKindRoutes(), jobRoute(() => status(404, 'job not found'))] },
    );
    expect(textOf(result)).toMatch(/^Error \[not_found\]: No clip job with this id/);
  });

  it('reports a rejected key', async () => {
    const { result } = await quote(
      { job_id: JOB_ID },
      {
        routes: [
          { method: 'GET', path: /^\/(transcriptions|republications)\//, respond: () => status(401, 'Invalid token') },
          jobRoute(() => status(401, 'Invalid token')),
        ],
      },
    );
    expect(textOf(result)).toMatch(/^Error \[invalid_api_key\]:/);
  });
});
