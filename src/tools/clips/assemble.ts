import { z } from 'zod';
import { mediaLink, safeHttpUrl, type MediaLink, type MediaUrlMode } from '../../domain/media-urls.js';
import { fenceUntrusted } from '../../shaping/fence.js';
import { MediaLinkOutput, UNTRUSTED_TEXT_NOTE } from '../../shaping/fragments.js';
import type { JobResponse, ManifestClip } from './schemas.js';

export type ResponseMode = 'concise' | 'detailed';

const untrusted = (description: string) => z.string().nullable().describe(`${description} ${UNTRUSTED_TEXT_NOTE}.`);

export const ClipOutput = z.object({
  clip_id: z
    .number()
    .int()
    .nullable()
    .describe('Clip number inside the job; null when it cannot be read from the link.'),
  video: MediaLinkOutput,
  title: untrusted('Clip title.'),
  score: z.number().nullable().describe('Virality score 0–100 (higher is better).'),
  duration_sec: z.number().nullable().describe('Clip length in seconds.'),
  hook: untrusted('Hook text shown at the start of the clip.'),
  description: untrusted('Clip description (detailed only).').optional(),
  transcript_excerpt: untrusted('First 300 characters of what is said in the clip (detailed only).').optional(),
  poster_url: z.string().nullable().optional().describe('First-frame poster image (detailed only).'),
  source_start_sec: z.number().nullable().optional().describe('Start of the clip in the source video (detailed only).'),
  source_end_sec: z.number().nullable().optional().describe('End of the clip in the source video (detailed only).'),
});

export const ColdHookOutput = z.object({
  video: MediaLinkOutput,
  duration_sec: z.number().nullable(),
  text: untrusted('What the hook clip says (detailed only).').optional(),
});

type Clip = z.output<typeof ClipOutput>;
type ColdHook = z.output<typeof ColdHookOutput>;

const TITLE_MAX = 120;
const HOOK_MAX = 200;
const LONG_TEXT_MAX = 300;
const MAX_COLD_HOOKS = 10;
const MAX_TEASERS = 5;
const CLIP_ID_RE = /clip_(\d+)\.mp4(?:$|[?#])/;

export const round1 = (value: number | null | undefined): number | null =>
  value === null || value === undefined ? null : Math.round(value * 10) / 10;

export const fenceShort = (text: string | null | undefined, max: number): string | null =>
  fenceUntrusted(text?.slice(0, max));

const linkOf = (url: string | null | undefined, mode: MediaUrlMode): MediaLink | null => {
  const safe = safeHttpUrl(url);
  return safe === null ? null : mediaLink(safe, mode);
};

const clipIdOf = (url: string): number | null => {
  const match = CLIP_ID_RE.exec(url);
  return match ? Number(match[1]) : null;
};

const detailsOf = (manifest: ManifestClip | undefined, poster: string | null): Partial<Clip> => ({
  description: fenceShort(manifest?.description, LONG_TEXT_MAX),
  transcript_excerpt: fenceShort(manifest?.text, LONG_TEXT_MAX),
  poster_url: (linkOf(poster, 'direct') ?? linkOf(manifest?.poster_url, 'direct'))?.url ?? null,
  source_start_sec: manifest?.start ?? null,
  source_end_sec: manifest?.end ?? null,
});

const compareNullable = (a: number | null, b: number | null, direction: 1 | -1): number => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
};

const byScoreThenId = (a: Clip, b: Clip): number =>
  compareNullable(a.score, b.score, -1) || compareNullable(a.clip_id, b.clip_id, 1);

export const assembleClips = (input: {
  readonly clipUrls: readonly string[];
  readonly posterUrls: readonly (string | null)[];
  readonly manifestClips: readonly ManifestClip[];
  readonly mode: ResponseMode;
  readonly maxClips: number;
  readonly mediaUrls: MediaUrlMode;
}): { readonly clips: readonly Clip[]; readonly clipsTotal: number } => {
  const manifestById = new Map(input.manifestClips.map((clip) => [clip.clip_id, clip]));
  const clips = input.clipUrls.flatMap((url, index): Clip[] => {
    const video = linkOf(url, input.mediaUrls);
    if (video === null) return [];
    const clipId = clipIdOf(video.url);
    const manifest = clipId === null ? undefined : manifestById.get(clipId);
    const concise: Clip = {
      clip_id: clipId,
      video,
      title: fenceShort(manifest?.title, TITLE_MAX),
      score: manifest?.final_score ?? manifest?.score ?? null,
      duration_sec: round1(manifest?.rendered_duration ?? manifest?.duration),
      hook: fenceShort(manifest?.hook, HOOK_MAX),
    };
    return [
      input.mode === 'detailed' ? { ...concise, ...detailsOf(manifest, input.posterUrls[index] ?? null) } : concise,
    ];
  });
  return { clips: clips.toSorted(byScoreThenId).slice(0, input.maxClips), clipsTotal: input.clipUrls.length };
};

export const assembleExtras = (input: {
  readonly coldHooks: JobResponse['cold_hooks'];
  readonly teaserUrl: string | null | undefined;
  readonly teaserUrls: readonly string[] | null | undefined;
  readonly mode: ResponseMode;
  readonly mediaUrls: MediaUrlMode;
}): { readonly cold_hooks: readonly ColdHook[]; readonly teasers: readonly MediaLink[] } => {
  const coldHooks = (input.coldHooks ?? []).flatMap((hook): ColdHook[] => {
    const video = linkOf(hook.url, input.mediaUrls);
    if (video === null) return [];
    const base = { video, duration_sec: round1(hook.duration) };
    return [input.mode === 'detailed' ? { ...base, text: fenceShort(hook.text, HOOK_MAX) } : base];
  });
  const teaserLinks = [...(input.teaserUrls ?? []), input.teaserUrl].flatMap((url) => {
    const link = linkOf(url, input.mediaUrls);
    return link === null ? [] : [link];
  });
  const teasers = [...new Map(teaserLinks.map((link) => [link.url, link])).values()];
  return { cold_hooks: coldHooks.slice(0, MAX_COLD_HOOKS), teasers: teasers.slice(0, MAX_TEASERS) };
};
