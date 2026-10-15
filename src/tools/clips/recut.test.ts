import { describe, expect, it } from 'vitest';
import { ok, status, type FakeRoute } from '../../../test/support/fake-api.js';
import { structuredOf, textOf } from '../../../test/support/harness.js';
import {
  JOB_ID,
  OTHER_JOB_ID,
  aDownloadProbe,
  aJob,
  callTool,
  downloadsProbeRoute,
  jobKindRoutes,
  jobRoute,
  recutRoute,
  startClips,
  type JobInput,
} from './fixtures.js';

const FORM = { elicitation: { form: {} } };
const recutArgs = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  job_id: JOB_ID,
  max_credits: 10,
  ...overrides,
});
const newJob = () => ok(aJob({ id: OTHER_JOB_ID, status: 'queued', s3_clip_urls: [] }));
const probeWith = (duration: number | null) => downloadsProbeRoute(() => ok(aDownloadProbe({ duration })));

const routes = (
  options: {
    readonly parent?: Partial<JobInput>;
    readonly duration?: number | null;
    readonly kind?: 'clip' | 'transcription' | 'republication';
    readonly recut?: FakeRoute['respond'];
  } = {},
): readonly FakeRoute[] => [
  ...jobKindRoutes(options.kind ?? 'clip'),
  jobRoute(() => ok(aJob(options.parent))),
  probeWith(options.duration === undefined ? 600 : options.duration),
  recutRoute(options.recut ?? newJob),
];

const recut = async (args: Readonly<Record<string, unknown>>, options: Parameters<typeof startClips>[0] = {}) => {
  const harness = await startClips({ routes: routes(), ...options });
  const result = await callTool(harness, 'recut_clip_job', args);
  return { harness, result, posts: () => harness.api.requestsTo('POST', `/videos/${JOB_ID}/recut`) };
};

describe('recut_clip_job with the original range', () => {
  it('omits the range, inherits everything not passed and prices the upper bound', async () => {
    const { result, posts } = await recut(recutArgs());
    expect(result.structuredContent).toEqual({
      job_id: OTHER_JOB_ID,
      parent_job_id: JOB_ID,
      status: 'queued',
      credits: 10,
      credits_exact: false,
      start_sec: null,
      end_sec: null,
      deduplicated: false,
      next_step: 'Call get_clip_job with the new job_id and wait_sec=50.',
    });
    expect(posts()).toHaveLength(1);
    expect(posts()[0]?.body).toEqual({ force_replan: false });
  });

  it('re-sends once with the explicit whole-video range when the parent stored no range', async () => {
    const answers = [
      status(422, 'Could not determine video duration; pass start_sec and end_sec explicitly'),
      newJob(),
    ];
    const { result, posts } = await recut(recutArgs(), {
      routes: routes({ duration: 300.12345, recut: () => answers.shift() ?? status(500) }),
    });
    expect(structuredOf(result)).toMatchObject({ job_id: OTHER_JOB_ID, credits: 6 });
    expect(posts().map((post) => post.body)).toEqual([
      { force_replan: false },
      { force_replan: false, start_sec: 0, end_sec: 300.123 },
    ]);
  });

  it('does not re-send a second time', async () => {
    const { result, posts } = await recut(recutArgs(), {
      routes: routes({ recut: () => status(422, 'Could not determine video duration; pass start_sec and end_sec') }),
    });
    expect(textOf(result)).toMatch(/^Error \[duration_unknown\]:/);
    expect(posts()).toHaveLength(2);
  });

  it('does not re-send other refusals', async () => {
    const { result, posts } = await recut(recutArgs(), {
      routes: routes({ recut: () => status(422, 'full_frame and portrait_only are mutually exclusive') }),
    });
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]:/);
    expect(posts()).toHaveLength(1);
  });

  it('does not re-send a duration refusal that is not a 422', async () => {
    const { result, posts } = await recut(recutArgs(), {
      routes: routes({ recut: () => status(400, 'Could not determine video duration') }),
    });
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]:/);
    expect(posts()).toHaveLength(1);
  });

  it('refuses a source longer than 30 minutes', async () => {
    const { result, posts } = await recut(recutArgs({ max_credits: 100 }), { routes: routes({ duration: 1801 }) });
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]: The source is longer than 30 minutes/);
    expect(posts()).toHaveLength(0);
  });

  it('refuses when the source length is unknown', async () => {
    const { result, posts } = await recut(recutArgs(), { routes: routes({ duration: null }) });
    expect(textOf(result)).toMatch(/^Error \[duration_unknown\]:/);
    expect(posts()).toHaveLength(0);
  });

  it('refuses when the upper bound exceeds max_credits', async () => {
    const { result, posts } = await recut(recutArgs({ max_credits: 9 }));
    expect(textOf(result)).toMatch(/^Error \[spend_cap_exceeded\]: This job costs 10 credits but max_credits is 9\./);
    expect(posts()).toHaveLength(0);
  });

  it('asks for confirmation with the upper bound', async () => {
    const asked: string[] = [];
    await recut(recutArgs(), {
      transport: 'stdio',
      clientCapabilities: FORM,
      onElicit: (request) => {
        asked.push(request.params.message);
        return { action: 'accept', content: { confirm: true } };
      },
    });
    expect(asked).toEqual([
      'Recut clip job 01234567 (original range, at most 10:00) for 10 credits? Credits are charged now. Jobs cannot be cancelled, and credits are not returned automatically if processing fails.',
    ]);
  });
});

describe('recut_clip_job with a new range', () => {
  it.each([
    [{ start_sec: 60 }, { start_sec: 60, end_sec: 600 }, 9],
    [{ end_sec: 120.5 }, { start_sec: 0, end_sec: 120.5 }, 3],
    [{ start_sec: 30, end_sec: 90 }, { start_sec: 30, end_sec: 90 }, 1],
  ])('sends an explicit range %j', async (range, sent, credits) => {
    const { result, posts } = await recut(recutArgs(range));
    expect(posts()[0]?.body).toEqual({ force_replan: false, ...sent });
    expect(structuredOf(result)).toMatchObject({ credits, credits_exact: true, ...sent });
  });

  it('asks for confirmation with the range length', async () => {
    const asked: string[] = [];
    await recut(recutArgs({ start_sec: 60, end_sec: 400 }), {
      transport: 'stdio',
      clientCapabilities: FORM,
      onElicit: (request) => {
        asked.push(request.params.message);
        return { action: 'decline' };
      },
    });
    expect(asked[0]).toMatch(/^Recut clip job 01234567 \(5:40 of video\) for 6 credits\?/);
  });

  it('refuses a range over the window cap', async () => {
    const { result, posts } = await recut(recutArgs({ start_sec: 0, end_sec: 1900, max_credits: 100 }), {
      routes: routes({ duration: 4000 }),
    });
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]: MnogoReels processes at most 30 minutes/);
    expect(posts()).toHaveLength(0);
  });

  it('works without the probe when the range is complete', async () => {
    const { result } = await recut(recutArgs({ start_sec: 0, end_sec: 60 }), {
      routes: [
        ...jobKindRoutes(),
        jobRoute(() => ok(aJob())),
        downloadsProbeRoute(() => status(504)),
        recutRoute(newJob),
      ],
    });
    expect(structuredOf(result)).toMatchObject({ credits: 1, start_sec: 0, end_sec: 60 });
  });
});

describe('recut_clip_job options', () => {
  it('sends only the options that were passed, mapped to the backend names', async () => {
    const { posts } = await recut(
      recutArgs({
        start_sec: 0,
        end_sec: 60,
        new_moments: true,
        video_mode: 'podcast',
        clip_length: 'up_to_30s',
        caption_style: 'hormozi',
        hook_style: 'dark',
        language: 'en',
        prompt: 'money',
        cold_open: true,
        story_arc_style: 'dynamic',
        add_music: true,
        emojis: false,
        smart_cut: true,
        b_roll_stock_video: true,
        b_roll_ai_images: false,
        b_roll_motion_graphics: true,
        outro: 'none',
        framing: 'portrait_only',
        agentic_mode: true,
      }),
    );
    expect(posts()[0]?.body).toEqual({
      start_sec: 0,
      end_sec: 60,
      force_replan: true,
      clip_duration: 20,
      clip_durations: [],
      video_mode: 'podcast',
      caption_style: 'hormozi',
      hook_style: 'dark',
      language: 'en',
      gemini_prompt: 'money',
      enable_cold_open: true,
      enable_story_arc: true,
      story_arc_style: 'dynamic',
      add_music: true,
      gemini_emojis: false,
      podcast_montage: true,
      b_roll_video: true,
      b_roll_image: false,
      b_roll_motion: true,
      outro: '',
      full_frame: false,
      portrait_only: true,
      enable_critic: true,
    });
  });

  it.each([
    [{ framing: 'full_frame' }, { full_frame: true, portrait_only: false }],
    [{ story_arc_style: 'none' }, { enable_story_arc: false, story_arc_style: 'none' }],
    [{ outro: 'like' }, { outro: 'like' }],
  ])('maps %j', async (options, sent) => {
    const { posts } = await recut(recutArgs(options));
    expect(posts()[0]?.body).toEqual({ force_replan: false, ...sent });
  });

  it.each([[{ outro: 'custom' }], [{ keep_whole_video: true }], [{ language: 'auto' }]])(
    'never accepts %j',
    async (options) => {
      const { result, harness } = await recut(recutArgs(options));
      if (result.isError) {
        expect(harness.api.requestsTo('POST', /.*/)).toHaveLength(0);
        return;
      }
      expect(harness.api.requestsTo('POST', `/videos/${JOB_ID}/recut`)[0]?.body).not.toHaveProperty('direct_mode');
    },
  );

  it('rejects outro custom through the schema', async () => {
    const { result, harness } = await recut(recutArgs({ outro: 'custom' }));
    expect(result.isError).toBe(true);
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('does not offer keep_whole_video or outro custom', async () => {
    const harness = await startClips();
    const tool = (await harness.client.listTools()).tools.find((candidate) => candidate.name === 'recut_clip_job');
    const properties = tool?.inputSchema.properties ?? {};
    expect(Object.keys(properties)).not.toContain('keep_whole_video');
    expect(properties['outro']).toMatchObject({ enum: ['none', 'default', 'soon', 'like'] });
  });

  it('forces AI B-roll off in the directory profile', async () => {
    const directory = { profile: 'directory' as const, directory: true };
    const { posts, harness } = await recut(recutArgs({ b_roll_ai_images: true, b_roll_motion_graphics: true }), {
      config: directory,
    });
    expect(posts()[0]?.body).toEqual({ force_replan: false, b_roll_image: false, b_roll_motion: false });
    const tool = (await harness.client.listTools()).tools.find((candidate) => candidate.name === 'recut_clip_job');
    expect(Object.keys(tool?.inputSchema.properties ?? {})).not.toContain('b_roll_ai_images');
  });
});

describe('recut_clip_job refusals', () => {
  it.each(['queued', 'processing', 'rendering'])('refuses a parent that is still %s', async (state) => {
    const { result, posts } = await recut(recutArgs(), { routes: routes({ parent: { status: state } }) });
    expect(textOf(result)).toMatch(/^Error \[job_already_running\]:/);
    expect(posts()).toHaveLength(0);
  });

  it.each([
    ['failed', { status: 'failed' }],
    ['expired', { media_available: false }],
  ])('accepts a %s parent', async (_label, parent) => {
    const { result } = await recut(recutArgs(), { routes: routes({ parent }) });
    expect(structuredOf(result)).toMatchObject({ job_id: OTHER_JOB_ID });
  });

  it.each(['transcription', 'republication'] as const)('refuses a %s id without posting', async (kind) => {
    const { result, harness } = await recut(recutArgs(), { routes: routes({ kind }) });
    expect(textOf(result)).toMatch(/^Error \[invalid_arguments\]: This is a /);
    expect(harness.api.requestsTo('POST', /.*/)).toHaveLength(0);
  });

  it('refuses an undownloadable source', async () => {
    const { result, posts } = await recut(recutArgs(), {
      routes: [
        ...jobKindRoutes(),
        jobRoute(() => ok(aJob())),
        downloadsProbeRoute(() => ok({ downloadable: false, reason: 'unavailable' })),
        recutRoute(newJob),
      ],
    });
    expect(textOf(result)).toMatch(/^Error \[source_not_downloadable\]:/);
    expect(posts()).toHaveLength(0);
  });

  it.each([
    [403, 'job belongs to another user', 'not_found'],
    [402, 'Not enough credits', 'insufficient_credits'],
    [500, undefined, 'outcome_unknown'],
  ])('maps a %d answer to %s', async (code, detail, errorCode) => {
    const { result, posts } = await recut(recutArgs(), { routes: routes({ recut: () => status(code, detail) }) });
    expect(textOf(result)).toMatch(new RegExp(`^Error \\[${errorCode}\\]:`));
    expect(posts()).toHaveLength(1);
  });

  it('reports an unknown parent', async () => {
    const { result } = await recut(recutArgs(), {
      routes: [...jobKindRoutes(), jobRoute(() => status(404, 'job not found'))],
    });
    expect(textOf(result)).toMatch(/^Error \[not_found\]: No clip job with this id/);
  });

  it('treats different options as a different recut', async () => {
    const harness = await startClips({ routes: routes() });
    await callTool(harness, 'recut_clip_job', recutArgs({ caption_style: 'neon' }));
    const second = await callTool(harness, 'recut_clip_job', recutArgs({ caption_style: 'karaoke' }));
    expect(structuredOf(second)).toMatchObject({ deduplicated: false });
    expect(harness.api.requestsTo('POST', `/videos/${JOB_ID}/recut`)).toHaveLength(2);
  });

  it('names the recut when credits run out', async () => {
    const { result } = await recut(recutArgs(), { routes: routes({ recut: () => status(402, 'Not enough credits') }) });
    expect(textOf(result)).toMatch(/^Error \[insufficient_credits\]: Not enough credits for this recut\./);
  });

  it('needs the source check for an inherited range, even if the check is busy', async () => {
    const { result, posts } = await recut(recutArgs(), {
      routes: [
        ...jobKindRoutes(),
        jobRoute(() => ok(aJob())),
        downloadsProbeRoute(() => status(429, 'slow down', { 'retry-after': '50' })),
        recutRoute(newJob),
      ],
    });
    expect(textOf(result)).toMatch(/^Error \[rate_limited\]:/);
    expect(posts()).toHaveLength(0);
  });

  it('returns the earlier recut for an identical call', async () => {
    const harness = await startClips({ routes: routes() });
    await callTool(harness, 'recut_clip_job', recutArgs({ caption_style: 'neon' }));
    const second = await callTool(harness, 'recut_clip_job', recutArgs({ caption_style: 'neon' }));
    expect(structuredOf(second)).toMatchObject({ job_id: OTHER_JOB_ID, deduplicated: true });
    expect(harness.api.requestsTo('POST', `/videos/${JOB_ID}/recut`)).toHaveLength(1);
  });

  it('needs an API key', async () => {
    const { result, harness } = await recut(recutArgs(), { apiKey: undefined });
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]:/);
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('is not offered in read-only mode', async () => {
    const harness = await startClips({ config: { readOnly: true } });
    await expect(callTool(harness, 'recut_clip_job', recutArgs())).rejects.toMatchObject({ code: -32602 });
  });
});
