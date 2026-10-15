import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadProcessConfig, resolveEffectiveConfig, type EffectiveConfig, type ToolsetName } from '../config.js';
import { defineTool } from './registry.js';
import { TOOLSETS, selectTools } from './toolsets.js';

const aTool = (name: string, toolset: ToolsetName, readOnly: boolean) =>
  defineTool({
    name,
    toolset,
    title: name,
    description: name,
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false },
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    requiresApiKey: false,
    handler: () => Promise.resolve({}),
  });

const TOOLS = [
  aTool('read_clips', 'clips', true),
  aTool('write_clips', 'clips', false),
  aTool('read_thumbnails', 'thumbnails', true),
  aTool('read_account', 'account', true),
];

const configFor = (overrides: Partial<EffectiveConfig> = {}): EffectiveConfig => {
  const loaded = loadProcessConfig({ env: {} });
  if (!loaded.ok) throw new Error(loaded.error);
  return { ...resolveEffectiveConfig({ process: loaded.config }), ...overrides };
};

const names = (config: EffectiveConfig) => selectTools(config, TOOLS).map((tool) => tool.name);

describe('selectTools', () => {
  it('keeps every tool of every enabled toolset in registration order', () => {
    expect(names(configFor())).toEqual(['read_clips', 'write_clips', 'read_thumbnails', 'read_account']);
  });

  it('hides tools that can change things in read-only mode', () => {
    expect(names(configFor({ readOnly: true }))).toEqual(['read_clips', 'read_thumbnails', 'read_account']);
  });

  it('hides tools of disabled toolsets', () => {
    expect(names(configFor({ toolsets: new Set<ToolsetName>(['account', 'clips']) }))).toEqual([
      'read_clips',
      'write_clips',
      'read_account',
    ]);
  });

  it('combines both rules', () => {
    expect(names(configFor({ readOnly: true, toolsets: new Set<ToolsetName>(['account', 'clips']) }))).toEqual([
      'read_clips',
      'read_account',
    ]);
  });

  it('registers the toolsets in the fixed order of the spec', () => {
    expect(TOOLSETS.map((toolset) => toolset.name)).toEqual([
      'account',
      'clips',
      'transcripts',
      'articles',
      'library',
      'thumbnails',
    ]);
    expect(
      selectTools(configFor())
        .map((tool) => tool.name)
        .slice(0, 2),
    ).toEqual(['get_account', 'get_options_guide']);
  });
});
