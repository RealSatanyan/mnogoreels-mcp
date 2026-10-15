import { z } from 'zod';
import {
  CAPTION_STYLE,
  CLIP_LENGTH,
  FRAMING,
  HOOK_STYLE,
  OUTRO,
  STORY_ARC_STYLE,
  VIDEO_MODE,
  type OptionSpec,
} from '../../domain/options.js';
import { LanguageCode } from '../../shaping/fragments.js';

const DESCRIPTIONS = {
  video_mode:
    'How the video was filmed: general, podcast (talking heads), general-beta (SmartCut: removes pauses and filler words), stream (screen + webcam), vlog, fitness.',
  clip_length: 'Target length of each clip. auto lets the AI decide; 30_60s suits Shorts, Reels and TikTok.',
  caption_style:
    'Burned-in caption style; empty means no captions. Call get_options_guide to see what each style looks like.',
  hook_style: 'Style of the hook title shown at the start of each clip; none hides it.',
  prompt: "What kind of moments to pick, in plain words, e.g. 'funny moments about money'.",
  cold_open:
    'Start each clip with its strongest moment as a teaser, and also produce standalone hook clips and a looped teaser.',
  story_arc_style:
    'Build each clip as a story (cold open, main part, payoff). Any value except none also turns on cold_open.',
  add_music: 'Add quiet background music from the MnogoReels library.',
  emojis: 'Add emojis to captions where they fit.',
  smart_cut:
    'Remove pauses and filler words inside clips. Works only with video_mode podcast (general-beta always does it); ignored for other modes.',
  b_roll_stock_video: 'Insert relevant stock video B-roll.',
  b_roll_ai_images: 'Insert AI-generated illustrative images as B-roll.',
  b_roll_motion_graphics: 'Insert AI motion-graphics B-roll (animated titles, charts, diagrams).',
  outro_create:
    'Ending added to every clip: default branded outro, soon/like short Russian text cards, custom = your saved outro image.',
  outro_recut:
    "Ending added to every clip: default branded outro, soon/like short Russian text cards. Omit to keep the original job's outro (including a custom one).",
  framing:
    'auto = smart crop; full_frame = keep the whole wide frame on a blurred background; portrait_only = always crop to the subject.',
  keep_whole_video:
    'Do not cut into clips: render the whole video once with captions, music and B-roll. Use only for videos that are already vertical and short.',
  agentic_mode: 'Extra AI review pass that refines where clips start and end. Slower.',
} as const;

const RECUT_OUTROS = ['none', 'default', 'soon', 'like'] as const;

const flag = (description: string) => z.boolean().default(false).describe(description);
const maybeFlag = (description: string) => z.boolean().optional().describe(description);
const Prompt = z.string().min(1).max(1000);

export const createOptionFields = {
  video_mode: z.enum(VIDEO_MODE.values).default(VIDEO_MODE.defaultValue).describe(DESCRIPTIONS.video_mode),
  clip_length: z.enum(CLIP_LENGTH.values).default(CLIP_LENGTH.defaultValue).describe(DESCRIPTIONS.clip_length),
  caption_style: z.enum(CAPTION_STYLE.values).default(CAPTION_STYLE.defaultValue).describe(DESCRIPTIONS.caption_style),
  hook_style: z.enum(HOOK_STYLE.values).default(HOOK_STYLE.defaultValue).describe(DESCRIPTIONS.hook_style),
  language: LanguageCode,
  prompt: Prompt.optional().describe(DESCRIPTIONS.prompt),
  cold_open: flag(DESCRIPTIONS.cold_open),
  story_arc_style: z
    .enum(STORY_ARC_STYLE.values)
    .default(STORY_ARC_STYLE.defaultValue)
    .describe(DESCRIPTIONS.story_arc_style),
  add_music: flag(DESCRIPTIONS.add_music),
  emojis: flag(DESCRIPTIONS.emojis),
  smart_cut: flag(DESCRIPTIONS.smart_cut),
  b_roll_stock_video: flag(DESCRIPTIONS.b_roll_stock_video),
  b_roll_ai_images: maybeFlag(DESCRIPTIONS.b_roll_ai_images),
  b_roll_motion_graphics: maybeFlag(DESCRIPTIONS.b_roll_motion_graphics),
  outro: z.enum(OUTRO.values).default(OUTRO.defaultValue).describe(DESCRIPTIONS.outro_create),
  framing: z.enum(FRAMING.values).default(FRAMING.defaultValue).describe(DESCRIPTIONS.framing),
  keep_whole_video: flag(DESCRIPTIONS.keep_whole_video),
  agentic_mode: flag(DESCRIPTIONS.agentic_mode),
};

export const recutOptionFields = {
  video_mode: z.enum(VIDEO_MODE.values).optional().describe(DESCRIPTIONS.video_mode),
  clip_length: z.enum(CLIP_LENGTH.values).optional().describe(DESCRIPTIONS.clip_length),
  caption_style: z.enum(CAPTION_STYLE.values).optional().describe(DESCRIPTIONS.caption_style),
  hook_style: z.enum(HOOK_STYLE.values).optional().describe(DESCRIPTIONS.hook_style),
  language: LanguageCode,
  prompt: Prompt.optional().describe(DESCRIPTIONS.prompt),
  cold_open: maybeFlag(DESCRIPTIONS.cold_open),
  story_arc_style: z.enum(STORY_ARC_STYLE.values).optional().describe(DESCRIPTIONS.story_arc_style),
  add_music: maybeFlag(DESCRIPTIONS.add_music),
  emojis: maybeFlag(DESCRIPTIONS.emojis),
  smart_cut: maybeFlag(DESCRIPTIONS.smart_cut),
  b_roll_stock_video: maybeFlag(DESCRIPTIONS.b_roll_stock_video),
  b_roll_ai_images: maybeFlag(DESCRIPTIONS.b_roll_ai_images),
  b_roll_motion_graphics: maybeFlag(DESCRIPTIONS.b_roll_motion_graphics),
  outro: z.enum(RECUT_OUTROS).optional().describe(DESCRIPTIONS.outro_recut),
  framing: z.enum(FRAMING.values).optional().describe(DESCRIPTIONS.framing),
  agentic_mode: maybeFlag(DESCRIPTIONS.agentic_mode),
};

export const DIRECTORY_HIDDEN_FIELDS = { b_roll_ai_images: true, b_roll_motion_graphics: true } as const;

type CreateOptions = z.output<z.ZodObject<typeof createOptionFields>>;
type RecutOptions = z.output<z.ZodObject<typeof recutOptionFields>>;

const backendOf = <V extends readonly [string, ...string[]], B>(spec: OptionSpec<V, B>, value: V[number]): B => {
  const entry = spec.entries.find((candidate) => candidate.value === value);
  if (entry === undefined) throw new Error(`Unknown ${spec.option} value`);
  return entry.backend;
};

const clipLengthFields = (value: CreateOptions['clip_length']) => ({
  clip_duration: backendOf(CLIP_LENGTH, value),
  clip_durations: [],
});

const passed = <T>(name: string, value: T | undefined): Readonly<Record<string, T>> =>
  value === undefined ? {} : { [name]: value };

export const createBodyOptions = (options: CreateOptions, directory: boolean): Readonly<Record<string, unknown>> => ({
  ...clipLengthFields(options.clip_length),
  video_mode: options.video_mode,
  caption_style: options.caption_style,
  hook_style: options.hook_style,
  ...passed('language', options.language),
  ...passed('gemini_prompt', options.prompt),
  add_music: options.add_music,
  gemini_emojis: options.emojis,
  podcast_montage: options.smart_cut,
  b_roll: false,
  b_roll_video: options.b_roll_stock_video,
  b_roll_image: !directory && (options.b_roll_ai_images ?? false),
  b_roll_motion: !directory && (options.b_roll_motion_graphics ?? false),
  b_roll_memes: false,
  outro: backendOf(OUTRO, options.outro),
  enable_cold_open: options.cold_open,
  ...backendOf(STORY_ARC_STYLE, options.story_arc_style),
  enable_critic: options.agentic_mode,
  direct_mode: options.keep_whole_video,
  ...backendOf(FRAMING, options.framing),
});

export const recutBodyOptions = (options: RecutOptions, directory: boolean): Readonly<Record<string, unknown>> => {
  const { clip_length: clipLength, story_arc_style: storyArc, outro, framing } = options;
  return {
    ...(clipLength === undefined ? {} : clipLengthFields(clipLength)),
    ...passed('video_mode', options.video_mode),
    ...passed('caption_style', options.caption_style),
    ...passed('hook_style', options.hook_style),
    ...passed('language', options.language),
    ...passed('gemini_prompt', options.prompt),
    ...passed('enable_cold_open', options.cold_open),
    ...(storyArc === undefined ? {} : backendOf(STORY_ARC_STYLE, storyArc)),
    ...passed('add_music', options.add_music),
    ...passed('gemini_emojis', options.emojis),
    ...passed('podcast_montage', options.smart_cut),
    ...passed('b_roll_video', options.b_roll_stock_video),
    ...passed('b_roll_image', directory ? false : options.b_roll_ai_images),
    ...passed('b_roll_motion', directory ? false : options.b_roll_motion_graphics),
    ...(outro === undefined ? {} : { outro: backendOf(OUTRO, outro) }),
    ...(framing === undefined ? {} : backendOf(FRAMING, framing)),
    ...passed('enable_critic', options.agentic_mode),
  };
};
