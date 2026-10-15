export type Completion = 'language' | 'caption_style' | 'clip_length' | 'format' | 'clip_job_id';

export type PromptArgument = {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly completion?: Completion;
};

import { formatWindow } from '../domain/options.js';

export type ArgumentValue = (name: string) => string;

export type PromptLimits = { readonly maxWindowSec: number };

export type PromptDefinition = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly tools: readonly string[];
  readonly arguments: readonly PromptArgument[];
  readonly text: (arg: ArgumentValue, limits: PromptLimits) => string;
};

const URL_ARG: PromptArgument = { name: 'url', description: 'Public video link', required: true };
const LANGUAGE_ARG: PromptArgument = {
  name: 'language',
  description: 'Two-letter speech language; empty = auto',
  required: false,
  completion: 'language',
};
const CLIP_TOOLS = ['quote_clip_job', 'create_clip_job', 'get_clip_job'];

const setting = (arg: ArgumentValue, name: string, render: (value: string) => string): string => {
  const value = arg(name);
  return value === '' ? '' : render(value);
};

const quoted = (arg: ArgumentValue, name: string): string => setting(arg, name, (value) => `, ${name} "${value}"`);

const partLength = (seconds: number): string =>
  seconds % 60 === 0 ? `${String(seconds / 60)}-minute` : `${String(seconds)}-second`;

const splitExample = (seconds: number): string => `0–${String(seconds)}, ${String(seconds)}–${String(seconds * 2)}`;

export const PROMPTS: readonly PromptDefinition[] = [
  {
    name: 'clip_video',
    title: 'Make clips from a video',
    description: 'Quote, confirm and create a clip job for one video, then show the best clips.',
    tools: CLIP_TOOLS,
    arguments: [
      URL_ARG,
      LANGUAGE_ARG,
      {
        name: 'caption_style',
        description: 'Caption style, e.g. karaoke or hormozi; empty = default',
        required: false,
        completion: 'caption_style',
      },
      {
        name: 'clip_length',
        description: 'Clip length, e.g. 30_60s; empty = default',
        required: false,
        completion: 'clip_length',
      },
    ],
    text: (arg, { maxWindowSec }) =>
      [
        `Make short vertical clips from this video: ${arg('url')}`,
        `1. Call quote_clip_job (it also checks that MnogoReels can download the video) and tell me the price in credits. If the video is longer than ${formatWindow(maxWindowSec)}, propose ${partLength(maxWindowSec)} parts with start_sec/end_sec and quote each. Wait for my confirmation before spending anything.`,
        `2. After I confirm, call create_clip_job with max_credits equal to the quoted credits${quoted(arg, 'language')}${quoted(arg, 'caption_style')}${quoted(arg, 'clip_length')}.`,
        '3. Call get_clip_job with wait_sec=50 until the job is completed or failed, then show me the 3 best clips with their titles, virality scores and links.',
      ].join('\n'),
  },
  {
    name: 'podcast_to_shorts',
    title: 'Turn a podcast into a Shorts series',
    description: 'Split a podcast or interview into 30-minute parts, clip each part and plan a posting order.',
    tools: CLIP_TOOLS,
    arguments: [URL_ARG, LANGUAGE_ARG],
    text: (arg, { maxWindowSec }) =>
      [
        `Turn this podcast or interview into a series of Shorts: ${arg('url')}`,
        `1. Quote the price with quote_clip_job (it also checks the link). One job covers at most ${formatWindow(maxWindowSec)}: if the episode is longer, split it into consecutive parts (start_sec/end_sec ${splitExample(maxWindowSec)}, …) and quote each part. Wait for my confirmation.`,
        `2. Create one job per part with create_clip_job using video_mode "podcast", clip_length "30_60s", cold_open true, story_arc_style "subtle", hook_style "default"${quoted(arg, 'language')} and max_credits equal to that part's quote.`,
        '3. Wait with get_clip_job (wait_sec=50) until every job completes.',
        '4. Propose a posting order for the clips (best first, at most one per day) with a one-line caption idea for each, and list the cold-open hook clips and the teaser separately.',
      ].join('\n'),
  },
  {
    name: 'video_to_blog_post',
    title: 'Write a blog post from a clipped video',
    description: 'Turn a completed clip job into a blog post with chapters.',
    tools: ['get_clip_job', 'create_article', 'get_article'],
    arguments: [
      { name: 'clip_job_id', description: 'Completed clip job id', required: true, completion: 'clip_job_id' },
    ],
    text: (arg) => {
      const id = arg('clip_job_id');
      return [
        `Write a blog post from my clip job ${id}.`,
        `1. Call get_clip_job with job_id ${id} to confirm the job is completed (if it is still processing, wait with wait_sec=50).`,
        `2. Call create_article with clip_job_id ${id}, then get_article with wait_sec=50 until the article text is ready.`,
        '3. Give me the article Markdown and, separately, the chapter list with timestamps.',
      ].join('\n');
    },
  },
  {
    name: 'transcribe_video',
    title: 'Transcribe a video',
    description: 'Transcribe a video for free and return the full text or subtitles.',
    tools: ['create_transcription', 'get_transcription'],
    arguments: [
      URL_ARG,
      LANGUAGE_ARG,
      { name: 'format', description: 'text or srt; empty = text', required: false, completion: 'format' },
    ],
    text: (arg) =>
      [
        `Transcribe this video: ${arg('url')}`,
        `1. Call create_transcription${setting(arg, 'language', (value) => ` with language "${value}"`)}.`,
        `2. Call get_transcription with wait_sec=50 and format "${arg('format') || 'text'}" until it is completed; fetch every page using next_offset.`,
        '3. Give me the full result.',
      ].join('\n'),
  },
  {
    name: 'review_recent_clips',
    title: 'Review my recent clips',
    description: 'Review recent clip jobs, pick the best clips and suggest recut settings.',
    tools: ['list_clip_jobs', 'get_clip_job'],
    arguments: [{ name: 'count', description: 'How many recent jobs to review, default 5', required: false }],
    text: (arg) => {
      const count = arg('count') || '5';
      return [
        `Review my ${count} most recent clip jobs.`,
        `1. Call list_clip_jobs with limit ${count}; skip jobs whose likely_kind is republication.`,
        '2. For each completed job, call get_clip_job with response_format "detailed" and max_clips 5.',
        '3. Summarise the best clips across all jobs (title, score, link) and, for weak jobs, suggest recut settings (caption_style, hook_style, clip_length or new_moments) without starting any paid job.',
      ].join('\n');
    },
  },
];
