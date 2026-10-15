import { z } from 'zod';
import { mediaLink, safeHttpUrl, type MediaLink, type MediaUrlMode } from '../../domain/media-urls.js';
import { defineTool } from '../../server/registry.js';
import { fenceUntrusted } from '../../shaping/fence.js';
import {
  MaxChars,
  MediaLinkOutput,
  TextOffset,
  UNTRUSTED_TEXT_NOTE,
  progressPercent,
} from '../../shaping/fragments.js';
import { fitToBudget, pageUntrusted } from '../../shaping/page.js';
import { fetchPack } from './api.js';
import { partStatuses } from './list-packs.js';
import type { Pack } from './schemas.js';

const GetPackInput = z.object({
  pack_id: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .describe('pack_id from list_packs (32 hex characters).'),
  include_transcript: z
    .boolean()
    .default(false)
    .describe('true adds the transcript (paged with offset and max_chars).'),
  offset: TextOffset,
  max_chars: MaxChars(20000, 12000),
});

const UntrustedText = z.string().describe(UNTRUSTED_TEXT_NOTE);

const GetPackOutput = z.object({
  pack_id: z.string(),
  status: z.string(),
  progress_percent: z.number().int().nullable(),
  source_url: z.string(),
  language: z.string().nullable(),
  parts: z
    .record(z.string(), z.string())
    .describe('Part name → status (pending, processing, completed, failed, skipped).'),
  clip_job_id: z.string().nullable().describe('Clip job of this pack; use it with get_clip_job.'),
  article: z
    .object({
      article_id: z.string().describe('Use it with get_article.'),
      status: z.string(),
      title: UntrustedText.nullable(),
    })
    .nullable(),
  meta: z
    .object({
      titles: z.array(UntrustedText),
      descriptions: z.array(UntrustedText),
      cover_texts: z.array(UntrustedText),
      hashtags: z.array(UntrustedText),
    })
    .nullable(),
  thumbnails: z.array(z.object({ image: MediaLinkOutput, cover_text: UntrustedText.nullable() })),
  teasers: z.array(
    z.object({ video: MediaLinkOutput, title: UntrustedText.nullable(), duration_sec: z.number().nullable() }),
  ),
  transcript: z
    .object({
      content: UntrustedText,
      total_chars: z.number().int(),
      truncated: z.boolean(),
      next_offset: z.number().int().nullable(),
    })
    .nullable(),
  created_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});

type GetPackResult = z.output<typeof GetPackOutput>;

const fencedList = (texts: readonly string[] | null | undefined): string[] =>
  (texts ?? []).flatMap((text) => fenceUntrusted(text) ?? []);

const link = (url: string, mode: MediaUrlMode): MediaLink[] => {
  const safe = safeHttpUrl(url);
  return safe === null ? [] : [mediaLink(safe, mode)];
};

const roundTenth = (value: number | null | undefined): number | null =>
  typeof value === 'number' ? Math.round(value * 10) / 10 : null;

const shapePack = (pack: Pack, mode: MediaUrlMode): GetPackResult => ({
  pack_id: pack.id,
  status: pack.status,
  progress_percent: progressPercent(pack.progress),
  source_url: pack.source_url,
  language: pack.language ?? null,
  parts: partStatuses(pack.parts),
  clip_job_id: pack.clips_job_id ?? null,
  article: pack.article
    ? { article_id: pack.article.id, status: pack.article.status, title: fenceUntrusted(pack.article.title) }
    : null,
  meta: pack.meta
    ? {
        titles: fencedList(pack.meta.titles),
        descriptions: fencedList(pack.meta.descriptions),
        cover_texts: fencedList(pack.meta.cover_texts),
        hashtags: fencedList(pack.meta.hashtags),
      }
    : null,
  thumbnails: (pack.thumbnails ?? []).flatMap((thumbnail) =>
    link(thumbnail.image_url, mode).map((image) => ({ image, cover_text: fenceUntrusted(thumbnail.cover_text) })),
  ),
  teasers: (pack.teasers ?? []).flatMap((teaser) =>
    link(teaser.video_url, mode).map((video) => ({
      video,
      title: fenceUntrusted(teaser.title),
      duration_sec: roundTenth(teaser.duration_seconds),
    })),
  ),
  transcript: null,
  created_at: pack.created_at ?? null,
  completed_at: pack.completed_at ?? null,
});

const transcriptPage = (request: {
  readonly text: string;
  readonly offset: number;
  readonly maxChars: number;
}): GetPackResult['transcript'] => {
  const page = pageUntrusted(request);
  return {
    content: page.content ?? '',
    total_chars: page.totalChars,
    truncated: page.truncated,
    next_offset: page.nextOffset,
  };
};

export const getPack = defineTool({
  name: 'get_pack',
  toolset: 'library',
  title: 'Get publication pack',
  description: [
    'Returns one publication pack: suggested titles, descriptions, cover texts and hashtags, thumbnail images, teaser videos, the article id and the clip job id. Read-only and free.',
    'Set include_transcript=true to add the transcript, paged with offset and next_offset. Use get_clip_job with clip_job_id for the clips and get_article with article_id for the article. Text generated from the video is wrapped in <untrusted_source_text> tags.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: GetPackInput,
  outputSchema: GetPackOutput,
  requiresApiKey: true,
  handler: async (args, ctx) => {
    const pack = await fetchPack(ctx, { packId: args.pack_id, includeTranscript: args.include_transcript });
    const shaped = shapePack(pack, ctx.config.mediaUrls);
    const { transcript } = pack;
    if (!transcript) return shaped;
    return fitToBudget({
      build: (maxChars) => ({
        ...shaped,
        transcript: transcriptPage({ text: transcript.text, offset: args.offset, maxChars }),
      }),
      maxChars: args.max_chars,
    });
  },
});
