import type { EffectiveConfig } from '../config.js';
import { accountToolset } from '../tools/account/index.js';
import { articlesToolset } from '../tools/articles/index.js';
import { clipsToolset } from '../tools/clips/index.js';
import { libraryToolset } from '../tools/library/index.js';
import { thumbnailsToolset } from '../tools/thumbnails/index.js';
import { transcriptsToolset } from '../tools/transcripts/index.js';
import type { RegistrableTool, ToolsetDefinition } from './registry.js';

export const TOOLSETS: readonly ToolsetDefinition[] = [
  accountToolset,
  clipsToolset,
  transcriptsToolset,
  articlesToolset,
  libraryToolset,
  thumbnailsToolset,
];

export const isToolEnabled = (tool: RegistrableTool, config: EffectiveConfig): boolean =>
  config.toolsets.has(tool.toolset) && (!config.readOnly || tool.readOnly);

export const selectTools = (
  config: EffectiveConfig,
  tools: readonly RegistrableTool[] = TOOLSETS.flatMap((toolset) => toolset.tools),
): readonly RegistrableTool[] => tools.filter((tool) => isToolEnabled(tool, config));
