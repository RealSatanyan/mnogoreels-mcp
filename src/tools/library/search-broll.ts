import { z } from 'zod';
import { ApiError, fail } from '../../api/errors.js';
import { defineTool } from '../../server/registry.js';
import { Limit } from '../../shaping/fragments.js';
import { fetchBrollPage } from './api.js';
import { BrollCatalog, BrollItem, shapeBrollItem } from './broll-shape.js';

const SearchBrollInput = z.object({
  catalog: BrollCatalog.describe('mine = your own B-roll; shared = public stock catalog.'),
  query: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe('Whole words matched in titles, descriptions and tags (no stemming); omit to list the newest items.'),
  kind: z
    .enum(['image', 'video', 'motion'])
    .optional()
    .describe('image, video or motion (motion graphics); omit for all.'),
  limit: Limit,
  cursor: z.string().min(1).max(512).optional().describe('next_cursor from the previous page.'),
});

const MAX_ITEMS_PER_PAGE = 10;

const isInvalidCursor = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.failure.kind === 'http' &&
  error.failure.status === 400 &&
  /invalid cursor/i.test(error.failure.detail ?? '');

const explainInvalidCursor = (error: unknown): never => {
  if (isInvalidCursor(error))
    fail('invalid_arguments', 'The cursor is invalid or expired; start again without cursor.');
  throw error;
};

const SearchBrollOutput = z.object({
  catalog: BrollCatalog,
  items: z.array(BrollItem),
  next_cursor: z.string().nullable(),
});

export const searchBroll = defineTool({
  name: 'search_broll',
  toolset: 'library',
  title: 'Search B-roll library',
  description: [
    "Searches B-roll videos and images. catalog=mine searches the user's own library (stock clips, AI images and motion graphics created for their past clip jobs) and returns temporary download links. catalog=shared searches the public MnogoReels stock catalog of about 5,000 reviewed items and returns titles, tags, previews and a website link; shared items are downloaded on the website. Read-only and free.",
    'query matches whole words in titles, descriptions and tags (no stemming); omit it to list the newest items. kind filters image, video or motion. Pages with limit (1 to 50, default 10) and cursor from next_cursor.',
    'Media links expire after 15 minutes; call get_broll_asset for fresh ones. Titles, descriptions, tags and attribution come from videos and stock providers and are wrapped in <untrusted_source_text> tags.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: SearchBrollInput,
  outputSchema: SearchBrollOutput,
  requiresApiKey: true,
  handler: async (args, ctx) => {
    const page = await fetchBrollPage(ctx, { ...args, limit: Math.min(args.limit, MAX_ITEMS_PER_PAGE) }).catch(
      explainInvalidCursor,
    );
    return {
      catalog: args.catalog,
      items: page.items.map((card) => shapeBrollItem(card, args.catalog)),
      next_cursor: page.next_cursor ?? null,
    };
  },
});
