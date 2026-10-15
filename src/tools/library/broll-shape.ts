import { z } from 'zod';
import { safeHttpUrl } from '../../domain/media-urls.js';
import { fenceUntrusted } from '../../shaping/fence.js';
import { UNTRUSTED_TEXT_NOTE } from '../../shaping/fragments.js';
import { AttributionSchema, type BrollCard } from './schemas.js';

export const BrollCatalog = z.enum(['mine', 'shared']);

export type Catalog = z.output<typeof BrollCatalog>;

export const BrollItem = z.object({
  asset_id: z.string(),
  catalog: BrollCatalog,
  kind: z.string(),
  title: z.string().nullable().describe(UNTRUSTED_TEXT_NOTE),
  description: z.string().nullable().describe(UNTRUSTED_TEXT_NOTE),
  tags: z.string().nullable().describe('Comma-separated, wrapped in <untrusted_source_text>.'),
  duration_sec: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  size_bytes: z.number().nullable(),
  source: z.string().nullable(),
  preview_state: z.string().nullable(),
  attribution: z
    .object({
      author_name: z.string().nullable().describe(UNTRUSTED_TEXT_NOTE),
      author_url: z.string().nullable(),
      page_url: z.string().nullable(),
    })
    .nullable(),
  media_url: z.string().nullable().describe('Download link (own items only); expires after links_expire_in_sec.'),
  poster_url: z.string().nullable(),
  links_expire_in_sec: z.number().int().nullable(),
  web_url: z.string().nullable().describe('Where to view and download the item on the website (shared items).'),
});

export type BrollItemOutput = z.output<typeof BrollItem>;

export const SHARED_WEB_URL = 'https://mnogo-reels.ru/dashboard/b-roll';
const LINK_TTL_SEC = 900;
const MAX_TEXT_CHARS = 300;

const fenceShort = (text: string | null | undefined): string | null => fenceUntrusted(text?.slice(0, MAX_TEXT_CHARS));

const shapeAttribution = (raw: unknown): BrollItemOutput['attribution'] => {
  const parsed = AttributionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { author, page_url, video_page } = parsed.data;
  return {
    author_name: fenceUntrusted(author?.name),
    author_url: safeHttpUrl(author?.url),
    page_url: safeHttpUrl(page_url ?? video_page),
  };
};

const links = (card: BrollCard, catalog: Catalog) => {
  if (catalog === 'mine') return { media_url: safeHttpUrl(card.media_url), poster_url: safeHttpUrl(card.poster_url) };
  return { media_url: null, poster_url: card.kind === 'image' ? null : safeHttpUrl(card.poster_url) };
};

export const shapeBrollItem = (card: BrollCard, catalog: Catalog): BrollItemOutput => {
  const { media_url, poster_url } = links(card, catalog);
  return {
    asset_id: card.id,
    catalog,
    kind: card.kind,
    title: fenceUntrusted(card.title),
    description: fenceShort(card.description),
    tags: fenceShort(card.tags?.join(', ')),
    duration_sec: card.duration_sec ?? null,
    width: card.width ?? null,
    height: card.height ?? null,
    size_bytes: card.bytes ?? null,
    source: card.source ?? null,
    preview_state: card.preview_state ?? null,
    attribution: shapeAttribution(card.attribution),
    media_url,
    poster_url,
    links_expire_in_sec: (media_url ?? poster_url) ? LINK_TTL_SEC : null,
    web_url: catalog === 'shared' ? SHARED_WEB_URL : null,
  };
};
