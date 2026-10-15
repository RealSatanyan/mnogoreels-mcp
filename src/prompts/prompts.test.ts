import { describe, expect, it, onTestFinished } from 'vitest';
import { loadProcessConfig, resolveEffectiveConfig, type EffectiveConfig, type ToolsetName } from '../config.js';
import { CAPTION_STYLE, LANGUAGE } from '../domain/options.js';
import { buildServerCard } from '../server/card.js';
import { ok, status } from '../../test/support/fake-api.js';
import { createHarness, type HarnessOptions } from '../../test/support/harness.js';
import { JOB_ID, OTHER_JOB_ID, aJob, listRoute } from '../tools/clips/fixtures.js';

type Mode = { readonly label: string; readonly transport: 'http' | 'stdio'; readonly era: 'modern' | 'legacy' };

const MODES: readonly Mode[] = [
  { label: 'http modern', transport: 'http', era: 'modern' },
  { label: 'http legacy', transport: 'http', era: 'legacy' },
  { label: 'stdio legacy', transport: 'stdio', era: 'legacy' },
  { label: 'stdio modern', transport: 'stdio', era: 'modern' },
];

const ALL_PROMPTS = [
  'clip_video',
  'podcast_to_shorts',
  'video_to_blog_post',
  'transcribe_video',
  'review_recent_clips',
];

const PROFILE_PROMPTS = [
  { path: '/mcp', prompts: ALL_PROMPTS },
  { path: '/mcp/readonly', prompts: ['review_recent_clips'] },
  { path: '/mcp/directory', prompts: ALL_PROMPTS },
] as const;

const configFor = (path: string): EffectiveConfig => {
  const loaded = loadProcessConfig({ env: {}, forceHttp: true });
  if (!loaded.ok) throw new Error(loaded.error);
  return resolveEffectiveConfig({ process: loaded.config, path });
};

const start = async (options: HarnessOptions = {}) => {
  const harness = await createHarness(options);
  onTestFinished(harness.close);
  return harness;
};

const promptText = async (
  name: string,
  args: Readonly<Record<string, string>>,
  options: HarnessOptions = {},
): Promise<string> => {
  const harness = await start(options);
  const result = await harness.client.getPrompt({ name, arguments: { ...args } });
  expect(result.messages).toHaveLength(1);
  const [message] = result.messages;
  expect(message?.role).toBe('user');
  return message?.content.type === 'text' ? message.content.text : '';
};

const completePrompt = async (
  name: string,
  argument: { readonly name: string; readonly value: string },
  options: HarnessOptions = {},
) => {
  const harness = await start(options);
  const result = await harness.client.complete({ ref: { type: 'ref/prompt', name }, argument: { ...argument } });
  return { values: result.completion.values, harness };
};

const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const CLIP_VIDEO_FIRST = `Make short vertical clips from this video: ${URL}
1. Call quote_clip_job (it also checks that MnogoReels can download the video) and tell me the price in credits. If the video is longer than 30 minutes, propose 30-minute parts with start_sec/end_sec and quote each. Wait for my confirmation before spending anything.
2. After I confirm, call create_clip_job with max_credits equal to the quoted credits`;

const CLIP_VIDEO_LAST =
  '3. Call get_clip_job with wait_sec=50 until the job is completed or failed, then show me the 3 best clips with their titles, virality scores and links.';

const recentJobs = () =>
  listRoute(() => ok({ items: [aJob({ id: JOB_ID }), aJob({ id: OTHER_JOB_ID, status: 'processing' })] }));

describe.each(MODES)('prompts: $label', ({ transport, era }) => {
  it('lists the five prompts in order with their arguments', async () => {
    const harness = await start({ transport, era });
    const { prompts } = await harness.client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual(ALL_PROMPTS);
    expect(prompts[0]).toMatchObject({
      title: 'Make clips from a video',
      arguments: [
        { name: 'url', description: 'Public video link', required: true },
        { name: 'language', description: 'Two-letter speech language; empty = auto', required: false },
        { name: 'caption_style', required: false },
        { name: 'clip_length', required: false },
      ],
    });
  });

  it('substitutes the arguments into clip_video', async () => {
    const text = await promptText(
      'clip_video',
      { url: URL, language: 'ru', caption_style: 'hormozi', clip_length: '30_60s' },
      { transport, era },
    );
    expect(text).toBe(
      `${CLIP_VIDEO_FIRST}, language "ru", caption_style "hormozi", clip_length "30_60s".\n${CLIP_VIDEO_LAST}`,
    );
  });

  it('completes the language argument by prefix', async () => {
    const { values } = await completePrompt('clip_video', { name: 'language', value: 'r' }, { transport, era });
    expect(values).toContain('ru');
    expect(values.every((value) => value.startsWith('r'))).toBe(true);
  });

  it('completes clip job ids from recent jobs, and nothing without a key', async () => {
    const keyed = await completePrompt(
      'video_to_blog_post',
      { name: 'clip_job_id', value: '0123' },
      { transport, era, routes: [recentJobs()] },
    );
    expect(keyed.values).toEqual([JOB_ID]);
    const keyless = await completePrompt(
      'video_to_blog_post',
      { name: 'clip_job_id', value: '' },
      { transport, era, apiKey: undefined },
    );
    expect(keyless.values).toEqual([]);
    expect(keyless.harness.api.requests()).toEqual([]);
  });
});

describe('prompt texts', () => {
  it('clip_video omits the optional settings that are empty', async () => {
    const text = await promptText('clip_video', { url: URL, language: '', caption_style: 'boxed' });
    expect(text).toBe(`${CLIP_VIDEO_FIRST}, caption_style "boxed".\n${CLIP_VIDEO_LAST}`);
  });

  it('clip_video with only the link', async () => {
    expect(await promptText('clip_video', { url: URL })).toBe(`${CLIP_VIDEO_FIRST}.\n${CLIP_VIDEO_LAST}`);
  });

  it('podcast_to_shorts', async () => {
    const step2 = (language: string) =>
      `2. Create one job per part with create_clip_job using video_mode "podcast", clip_length "30_60s", cold_open true, story_arc_style "subtle", hook_style "default"${language} and max_credits equal to that part's quote.`;
    const expected = (language: string) =>
      [
        `Turn this podcast or interview into a series of Shorts: ${URL}`,
        '1. Quote the price with quote_clip_job (it also checks the link). One job covers at most 30 minutes: if the episode is longer, split it into consecutive parts (start_sec/end_sec 0–1800, 1800–3600, …) and quote each part. Wait for my confirmation.',
        step2(language),
        '3. Wait with get_clip_job (wait_sec=50) until every job completes.',
        '4. Propose a posting order for the clips (best first, at most one per day) with a one-line caption idea for each, and list the cold-open hook clips and the teaser separately.',
      ].join('\n');
    expect(await promptText('podcast_to_shorts', { url: URL, language: 'en' })).toBe(expected(', language "en"'));
    expect(await promptText('podcast_to_shorts', { url: URL })).toBe(expected(''));
  });

  it.each([
    [900, '15 minutes', '15-minute', '0–900, 900–1800'],
    [90, '90 seconds', '90-second', '0–90, 90–180'],
  ])('follows a configured job window of %i s', async (maxWindowSec, length, adjective, parts) => {
    const options = { config: { maxWindowSec } };
    expect(await promptText('clip_video', { url: URL }, options)).toContain(
      `If the video is longer than ${length}, propose ${adjective} parts with start_sec/end_sec and quote each.`,
    );
    expect(await promptText('podcast_to_shorts', { url: URL }, options)).toContain(
      `One job covers at most ${length}: if the episode is longer, split it into consecutive parts (start_sec/end_sec ${parts}, …) and quote each part.`,
    );
  });

  it('video_to_blog_post', async () => {
    expect(await promptText('video_to_blog_post', { clip_job_id: JOB_ID })).toBe(
      [
        `Write a blog post from my clip job ${JOB_ID}.`,
        `1. Call get_clip_job with job_id ${JOB_ID} to confirm the job is completed (if it is still processing, wait with wait_sec=50).`,
        `2. Call create_article with clip_job_id ${JOB_ID}, then get_article with wait_sec=50 until the article text is ready.`,
        '3. Give me the article Markdown and, separately, the chapter list with timestamps.',
      ].join('\n'),
    );
  });

  it('transcribe_video with language and format, and with the defaults', async () => {
    const expected = (language: string, format: string) =>
      [
        `Transcribe this video: ${URL}`,
        `1. Call create_transcription${language}.`,
        `2. Call get_transcription with wait_sec=50 and format "${format}" until it is completed; fetch every page using next_offset.`,
        '3. Give me the full result.',
      ].join('\n');
    expect(await promptText('transcribe_video', { url: URL, language: 'de', format: 'srt' })).toBe(
      expected(' with language "de"', 'srt'),
    );
    expect(await promptText('transcribe_video', { url: URL })).toBe(expected('', 'text'));
  });

  it('review_recent_clips with a count and with the default of 5', async () => {
    const expected = (count: string) =>
      [
        `Review my ${count} most recent clip jobs.`,
        `1. Call list_clip_jobs with limit ${count}; skip jobs whose likely_kind is republication.`,
        '2. For each completed job, call get_clip_job with response_format "detailed" and max_clips 5.',
        '3. Summarise the best clips across all jobs (title, score, link) and, for weak jobs, suggest recut settings (caption_style, hook_style, clip_length or new_moments) without starting any paid job.',
      ].join('\n');
    expect(await promptText('review_recent_clips', { count: '3' })).toBe(expected('3'));
    expect(await promptText('review_recent_clips', {})).toBe(expected('5'));
    expect(await promptText('review_recent_clips', { count: ' ' })).toBe(expected('5'));
  });

  it('a missing required argument is a protocol error', async () => {
    const harness = await start();
    await expect(harness.client.getPrompt({ name: 'clip_video', arguments: {} })).rejects.toMatchObject({
      code: -32602,
    });
  });
});

describe('prompt completions', () => {
  it.each([
    { prompt: 'clip_video', argument: 'caption_style', value: 'hor', expected: ['hormozi', 'hormozi_pop'] },
    { prompt: 'clip_video', argument: 'caption_style', value: '', expected: [...CAPTION_STYLE.values] },
    { prompt: 'clip_video', argument: 'clip_length', value: '3', expected: ['30_60s', '3m_5m'] },
    { prompt: 'podcast_to_shorts', argument: 'language', value: '', expected: LANGUAGE.codes },
    { prompt: 'transcribe_video', argument: 'language', value: 'b', expected: ['be', 'bg'] },
    { prompt: 'transcribe_video', argument: 'format', value: '', expected: ['text', 'srt'] },
    { prompt: 'transcribe_video', argument: 'format', value: 's', expected: ['srt'] },
    { prompt: 'review_recent_clips', argument: 'count', value: '', expected: [] },
  ])('$prompt $argument "$value"', async ({ prompt, argument, value, expected }) => {
    const { values, harness } = await completePrompt(prompt, { name: argument, value });
    expect(values).toEqual(expected);
    expect(harness.api.requests()).toEqual([]);
  });

  it('completes no clip job ids when the backend fails', async () => {
    const { values } = await completePrompt(
      'video_to_blog_post',
      { name: 'clip_job_id', value: '' },
      { routes: [listRoute(() => status(500, 'boom'))] },
    );
    expect(values).toEqual([]);
  });

  it('asks the backend for the 20 most recent jobs', async () => {
    const { values, harness } = await completePrompt(
      'video_to_blog_post',
      { name: 'clip_job_id', value: '' },
      { routes: [recentJobs()] },
    );
    expect(values).toEqual([JOB_ID, OTHER_JOB_ID]);
    expect(harness.api.requestsTo('GET', '/videos')[0]?.query).toMatchObject({ limit: '20' });
  });
});

describe('prompt gating', () => {
  it.each(PROFILE_PROMPTS)('$path lists $prompts', async ({ path, prompts }) => {
    const config = configFor(path);
    const harness = await start({ config });
    const listed = (await harness.client.listPrompts()).prompts;
    expect(listed.map((prompt) => prompt.name)).toEqual(prompts);
    const card = buildServerCard({ config, publicUrl: 'https://mcp.mnogo-reels.ru/mcp' });
    expect(card.prompts).toEqual(listed);
  });

  it('drops the prompts whose tools are disabled by the toolset selection', async () => {
    const harness = await start({ config: { toolsets: new Set<ToolsetName>(['account', 'clips', 'transcripts']) } });
    expect((await harness.client.listPrompts()).prompts.map((prompt) => prompt.name)).toEqual([
      'clip_video',
      'podcast_to_shorts',
      'transcribe_video',
      'review_recent_clips',
    ]);
  });

  it('a prompt that is not enabled cannot be fetched', async () => {
    const harness = await start({ config: configFor('/mcp/readonly') });
    await expect(harness.client.getPrompt({ name: 'clip_video', arguments: { url: URL } })).rejects.toMatchObject({
      code: -32602,
    });
  });
});
