import type { ToolsetDefinition } from '../../server/registry.js';
import { createYoutubeThumbnails } from './create-youtube-thumbnails.js';
import { getYoutubeThumbnails } from './get-youtube-thumbnails.js';

export const thumbnailsToolset: ToolsetDefinition = {
  name: 'thumbnails',
  tools: [createYoutubeThumbnails, getYoutubeThumbnails],
};
