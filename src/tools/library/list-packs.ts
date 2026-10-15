import { z } from 'zod';
import { defineTool } from '../../server/registry.js';
import { Limit, Offset, progressPercent } from '../../shaping/fragments.js';
import { fetchPacks } from './api.js';
import type { Pack } from './schemas.js';

const ListPacksInput = z.object({ limit: Limit, offset: Offset });

const MAX_PACKS_PER_PAGE = 25;

export const partStatuses = (parts: Pack['parts']): Record<string, string> =>
  Object.fromEntries(Object.entries(parts ?? {}).map(([name, part]) => [name, part.status]));

const shapePackSummary = (pack: Pack) => ({
  pack_id: pack.id,
  status: pack.status,
  progress_percent: progressPercent(pack.progress),
  source_url: pack.source_url,
  created_at: pack.created_at ?? null,
  completed_at: pack.completed_at ?? null,
  parts: partStatuses(pack.parts),
  clip_job_id: pack.clips_job_id ?? null,
  article_id: pack.article?.id ?? null,
});

const ListPacksOutput = z.object({
  packs: z.array(
    z.object({
      pack_id: z.string(),
      status: z.string(),
      progress_percent: z.number().int().nullable(),
      source_url: z.string(),
      created_at: z.string().nullable(),
      completed_at: z.string().nullable(),
      parts: z
        .record(z.string(), z.string())
        .describe('Part name → status (pending, processing, completed, failed, skipped).'),
      clip_job_id: z.string().nullable().describe('Clip job of this pack; use it with get_clip_job.'),
      article_id: z.string().nullable(),
    }),
  ),
  next_offset: z.number().int().nullable(),
});

export const listPacks = defineTool({
  name: 'list_packs',
  toolset: 'library',
  title: 'List publication packs',
  description: [
    "Lists the user's publication packs, newest first. A pack is made on the MnogoReels website from one video link and bundles clips, a transcript, suggested titles, descriptions and hashtags, YouTube thumbnails, an article and teasers. Read-only and free; packs cannot be created through the API.",
    'Pages with limit (1 to 50, default 10) and offset. Returns pack_id, status, progress, source_url, created_at, the status of each part and clip_job_id (use it with get_clip_job). Next, call get_pack for titles, hashtags, thumbnails and teasers.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: ListPacksInput,
  outputSchema: ListPacksOutput,
  requiresApiKey: true,
  handler: async (args, ctx) => {
    const limit = Math.min(args.limit, MAX_PACKS_PER_PAGE);
    const page = await fetchPacks(ctx, { limit, offset: args.offset });
    return {
      packs: page.items.map(shapePackSummary),
      next_offset: page.items.length < limit ? null : args.offset + limit,
    };
  },
});
