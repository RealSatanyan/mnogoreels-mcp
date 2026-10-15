import { z } from 'zod';
import { defineTool } from '../../server/registry.js';
import { fetchBrollAsset } from './api.js';
import { BrollCatalog, BrollItem, shapeBrollItem } from './broll-shape.js';

const GetBrollAssetInput = z.object({
  catalog: BrollCatalog.describe('The catalog the asset_id came from in search_broll: mine or shared.'),
  asset_id: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .describe('asset_id from search_broll (64 hex characters).'),
});

export const getBrollAsset = defineTool({
  name: 'get_broll_asset',
  toolset: 'library',
  title: 'Get B-roll asset',
  description: [
    'Returns one B-roll item by asset_id with fresh links. Read-only and free; needs an API key. Use it right before downloading an item found with search_broll, because catalog=mine download links expire after 15 minutes; to find items use search_broll instead. catalog must be the catalog the asset_id came from.',
    'For catalog=mine it returns media_url and poster_url, valid for links_expire_in_sec seconds. For catalog=shared it returns title, tags, a preview poster (videos only), attribution and web_url, because shared items are downloaded on the MnogoReels website. Text from videos and stock providers is wrapped in <untrusted_source_text> tags.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: GetBrollAssetInput,
  outputSchema: BrollItem,
  requiresApiKey: true,
  handler: async (args, ctx) =>
    shapeBrollItem(await fetchBrollAsset(ctx, { catalog: args.catalog, assetId: args.asset_id }), args.catalog),
});
