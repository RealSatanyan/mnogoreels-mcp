import type { ToolsetDefinition } from '../../server/registry.js';
import { getBrollAsset } from './get-broll-asset.js';
import { getPack } from './get-pack.js';
import { listPacks } from './list-packs.js';
import { searchBroll } from './search-broll.js';

export const libraryToolset: ToolsetDefinition = {
  name: 'library',
  tools: [searchBroll, getBrollAsset, listPacks, getPack],
};
