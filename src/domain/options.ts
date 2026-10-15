export type OptionEntry<V extends string, B> = {
  readonly value: V;
  readonly description: string;
  readonly isDefault: boolean;
  readonly backend: B;
};

export type OptionSpec<V extends readonly [string, ...string[]], B> = {
  readonly option: string;
  readonly description: string;
  readonly values: V;
  readonly defaultValue: V[number];
  readonly entries: readonly OptionEntry<V[number], B>[];
};

const defineOption = <const V extends readonly [string, ...string[]], B>(spec: {
  readonly option: string;
  readonly description: string;
  readonly values: V;
  readonly defaultValue: V[number];
  readonly describe: Readonly<Record<V[number], string>>;
  readonly backend: (value: V[number]) => B;
}): OptionSpec<V, B> => ({
  option: spec.option,
  description: spec.description,
  values: spec.values,
  defaultValue: spec.defaultValue,
  entries: spec.values.map((value: V[number]) => ({
    value,
    description: spec.describe[value],
    isDefault: value === spec.defaultValue,
    backend: spec.backend(value),
  })),
});

const same = <V extends string>(value: V): V => value;

export const VIDEO_MODE = defineOption({
  option: 'video_mode',
  description:
    'How the video was filmed. smart_cut (removing pauses and filler words) works only with podcast; general-beta always does it, other modes ignore it.',
  values: ['general', 'podcast', 'general-beta', 'stream', 'vlog', 'fitness'],
  defaultValue: 'general',
  describe: {
    general: 'Most videos. Smart crop follows the people and subjects in frame.',
    podcast: 'Talking heads and interviews with one or two speakers; splits the frame when two people talk.',
    'general-beta':
      'SmartCut (General 2.0): highest-quality editing with locked shots and automatic removal of pauses and filler words inside clips. Slower.',
    stream: 'Screen recording or game stream with a webcam: screen on top, webcam below.',
    vlog: 'Handheld vlogs: always vertical with gentle face tracking.',
    fitness: 'Workouts and dance: always vertical, body-aware crop that keeps head and feet in frame.',
  },
  backend: same,
});

export const CLIP_LENGTH = defineOption({
  option: 'clip_length',
  description: 'Target length of each clip. auto lets the AI decide; 30_60s suits Shorts, Reels and TikTok.',
  values: ['auto', 'up_to_30s', '30_60s', '60_90s', '90s_3m', '3m_5m', '5m_10m'],
  defaultValue: '30_60s',
  describe: {
    auto: 'Chosen by AI: 15–60 s for sources up to 2 min, up to 90 s (up to 10 min), 150 s (up to 30 min).',
    up_to_30s: '10–30 s.',
    '30_60s': '30–59 s (Shorts/Reels/TikTok sweet spot).',
    '60_90s': '60–89 s.',
    '90s_3m': '90–180 s.',
    '3m_5m': '180–300 s.',
    '5m_10m': '300–600 s.',
  },
  backend: (value) =>
    ({ auto: 0, up_to_30s: 20, '30_60s': 45, '60_90s': 75, '90s_3m': 120, '3m_5m': 240, '5m_10m': 450 })[value],
});

const TYPEFACE_PRESET = 'Clean preset named after its typeface.';

export const CAPTION_STYLE = defineOption({
  option: 'caption_style',
  description: 'Burned-in caption style; empty means no captions.',
  values: [
    'karaoke',
    'karaoke_static',
    'minimal',
    'viral',
    'montserrat',
    'gilroy',
    'rubik',
    'bebas',
    'impact',
    'pixel',
    'gothic',
    'going',
    'hormozi',
    'hormozi_pop',
    'boxed',
    'boxed_black',
    'boxed_pop',
    'neon',
    'pop3d',
    'tiktok',
    'money',
    'chunky',
    'punch',
    'empty',
  ],
  defaultValue: 'karaoke',
  describe: {
    karaoke: 'Words highlight one by one, four words per line (default).',
    karaoke_static: 'No per-word highlight; larger text placed higher.',
    minimal: 'Small, clean subtitles.',
    viral: 'Bold high-contrast viral look.',
    montserrat: TYPEFACE_PRESET,
    gilroy: TYPEFACE_PRESET,
    rubik: TYPEFACE_PRESET,
    bebas: TYPEFACE_PRESET,
    impact: TYPEFACE_PRESET,
    pixel: TYPEFACE_PRESET,
    gothic: TYPEFACE_PRESET,
    going: TYPEFACE_PRESET,
    hormozi: 'White caps with a thick black outline; the active word turns yellow and pops.',
    hormozi_pop: 'Hormozi with a bouncing active word cycling yellow, white and lime.',
    boxed: 'Active word inside a filled green box.',
    boxed_black: 'Active word in black on a white box.',
    boxed_pop: 'Boxed with a bouncing box cycling green, red and blue.',
    neon: 'Wide font with a neon pink glow on the active word.',
    pop3d: 'Rounded font with a hard purple offset shadow.',
    tiktok: 'Condensed font on a translucent black bar.',
    money: 'Numbers, percentages and currencies glow green; current word yellow.',
    chunky: 'Heavy black offset shadow; active word yellow.',
    punch: 'One big word at a time in the centre; every third word yellow.',
    empty: 'No captions.',
  },
  backend: same,
});

export const HOOK_STYLE = defineOption({
  option: 'hook_style',
  description: 'Style of the hook title shown at the start of each clip; none hides it.',
  values: ['default', 'dark', 'accent', 'sticker', 'marker', 'neon', 'stagger', 'torn', 'keyword', 'impact', 'none'],
  defaultValue: 'default',
  describe: {
    default: 'White box, black text.',
    dark: 'Black box, white text.',
    accent: 'Orange box, black text.',
    sticker: 'White sticker boxes; lines pop in one after another.',
    marker: 'A highlighter stripe swipes across, then the text appears.',
    neon: 'Glowing neon text.',
    stagger: 'Lines slide in from different sides in a staircase layout.',
    torn: 'Lowercase text on a torn paper sheet that slaps into the frame.',
    keyword: 'Highlights the key word, which appears after the rest of the text.',
    impact: 'Big white Impact-style text.',
    none: 'No hook title on the clip.',
  },
  backend: same,
});

export const STORY_ARC_STYLE = defineOption({
  option: 'story_arc_style',
  description:
    'Build each clip as a story (cold open, main part, payoff). Any value except none also turns on cold_open.',
  values: ['none', 'subtle', 'dynamic', 'cinematic'],
  defaultValue: 'none',
  describe: {
    none: 'Off.',
    subtle: 'Story structure with light transitions.',
    dynamic: 'Story structure with energetic transitions.',
    cinematic: 'Story structure with a cinematic look.',
  },
  backend: (value) => ({ enable_story_arc: value !== 'none', story_arc_style: value }),
});

export const OUTRO = defineOption({
  option: 'outro',
  description: 'Ending added to every clip.',
  values: ['none', 'default', 'soon', 'like', 'custom'],
  defaultValue: 'none',
  describe: {
    none: 'No outro.',
    default: 'Short branded video outro.',
    soon: '3 s Russian text card "Продолжение на канале!".',
    like: '3 s Russian text card asking to like and subscribe.',
    custom: "The user's own outro image saved on the website; ignored if none is saved. Only for create_clip_job.",
  },
  backend: (value): string => (value === 'none' ? '' : value),
});

export const FRAMING = defineOption({
  option: 'framing',
  description: 'How the wide source is turned into a vertical clip.',
  values: ['auto', 'full_frame', 'portrait_only'],
  defaultValue: 'auto',
  describe: {
    auto: 'Smart crop decides.',
    full_frame: 'Keep the whole 16:9 frame on a blurred 9:16 background, no tracking.',
    portrait_only: 'Always crop to the subject, never a wide layout.',
  },
  backend: (value) => ({ full_frame: value === 'full_frame', portrait_only: value === 'portrait_only' }),
});

export const OPTION_CATALOG = [VIDEO_MODE, CLIP_LENGTH, CAPTION_STYLE, HOOK_STYLE, STORY_ARC_STYLE, OUTRO, FRAMING];

const LANGUAGE_NAMES = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  kk: 'Kazakh',
  be: 'Belarusian',
  pl: 'Polish',
  tr: 'Turkish',
  ar: 'Arabic',
  he: 'Hebrew',
  hi: 'Hindi',
  cs: 'Czech',
  bg: 'Bulgarian',
  sr: 'Serbian',
} as const;

export const LANGUAGE = {
  option: 'language',
  description:
    "ISO 639-1 two-letter code of the speech, e.g. en or ru; other two-letter codes work too. Omit to auto-detect (one language for the whole video). Never pass 'auto'.",
  codes: Object.keys(LANGUAGE_NAMES),
  entries: Object.entries(LANGUAGE_NAMES).map(([value, name]) => ({ value, description: name, isDefault: false })),
};

export const PAID_JOB_NOTICE =
  'Credits are charged when the job is created and jobs cannot be cancelled. If processing fails, credits are not returned automatically; retry_clip_job re-runs a failed job for free, or the user can contact support@mnogo-reels.ru with the job_id.';

const plural = (count: number, unit: string): string => `${String(count)} ${unit}${count === 1 ? '' : 's'}`;

export const formatWindow = (seconds: number): string =>
  seconds % 60 === 0 ? plural(seconds / 60, 'minute') : plural(seconds, 'second');

export const pricingGuide = (maxWindowSec: number) => ({
  rule: `1 credit per started minute of the processed range (end_sec − start_sec), minimum 1, charged when the job is created. One job processes at most ${formatWindow(maxWindowSec)}; split longer videos into several jobs with start_sec/end_sec. Options (captions, hooks, B-roll, music, agentic mode) do not change the price through the API.`,
  examples: ['45 s → 1 credit', '10 min → 10 credits', '29 min 30 s → 30 credits'],
  free: [
    'checks',
    'quotes',
    'transcriptions',
    'articles',
    'YouTube thumbnails',
    'retries of failed jobs',
    'reading results',
  ],
});
