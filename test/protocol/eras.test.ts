import { describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod';
import { resolveEffectiveConfig, loadProcessConfig, type EffectiveConfig } from '../../src/config.js';
import { buildServerCard } from '../../src/server/card.js';
import { SERVER_INFO, buildInstructions } from '../../src/server/metadata.js';
import { defineTool } from '../../src/server/registry.js';
import { selectTools } from '../../src/server/toolsets.js';
import { ok, status } from '../support/fake-api.js';
import { createHarness, structuredOf, textOf, type HarnessOptions } from '../support/harness.js';

type Mode = { readonly label: string; readonly transport: 'http' | 'stdio'; readonly era: 'modern' | 'legacy' };

const MODES: readonly Mode[] = [
  { label: 'http modern', transport: 'http', era: 'modern' },
  { label: 'http legacy', transport: 'http', era: 'legacy' },
  { label: 'stdio legacy', transport: 'stdio', era: 'legacy' },
  { label: 'stdio modern', transport: 'stdio', era: 'modern' },
];

const PATHS = ['/mcp', '/mcp/readonly', '/mcp/directory'] as const;

const configFor = (transport: 'http' | 'stdio', path: string): EffectiveConfig => {
  const loaded = loadProcessConfig({ env: {}, forceHttp: transport === 'http' });
  if (!loaded.ok) throw new Error(loaded.error);
  return resolveEffectiveConfig({ process: loaded.config, path });
};

const start = async (mode: Mode, options: HarnessOptions = {}) => {
  const harness = await createHarness({ transport: mode.transport, era: mode.era, ...options });
  onTestFinished(harness.close);
  return harness;
};

const collectKeys = (value: unknown, keys: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (typeof value === 'object' && value !== null) {
    Object.entries(value).forEach(([key, nested]) => {
      keys.add(key);
      collectKeys(nested, keys);
    });
  }
  return keys;
};

const hasAnyOfWithDefault = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasAnyOfWithDefault);
  if (typeof value !== 'object' || value === null) return false;
  const entries = Object.entries(value);
  const keys = new Set(entries.map(([key]) => key));
  return (keys.has('anyOf') && keys.has('default')) || entries.some(([, nested]) => hasAnyOfWithDefault(nested));
};

const PropertiesSchema = z.record(z.string(), z.object({ description: z.string().min(1) }).loose());

describe.each(MODES)('protocol eras: $label', (mode) => {
  it('identifies the server and sends the profile instructions', async () => {
    const harness = await start(mode);
    expect(harness.client.getProtocolEra()).toBe(mode.era);
    expect(harness.client.getServerVersion()).toMatchObject({
      name: SERVER_INFO.name,
      title: SERVER_INFO.title,
      version: SERVER_INFO.version,
      websiteUrl: SERVER_INFO.websiteUrl,
      icons: SERVER_INFO.icons,
    });
    const instructions = harness.client.getInstructions() ?? '';
    expect(instructions).toBe(buildInstructions(harness.config));
    expect(instructions.split('\n\n')[0]?.length).toBeLessThanOrEqual(512);
  });

  it('declares fixed lists without change notifications', async () => {
    const harness = await start(mode);
    expect(harness.client.getServerCapabilities()).toMatchObject({
      tools: { listChanged: false },
      prompts: { listChanged: false },
      resources: { listChanged: false },
    });
  });

  it.each(PATHS)('tools/list for %s is ordered, annotated, described and matches the server card', async (path) => {
    const config = configFor(mode.transport, path);
    const harness = await start(mode, { config });
    const { tools } = await harness.client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(selectTools(config).map((tool) => tool.name));
    expect(tools.map((tool) => tool.name).slice(0, 2)).toEqual(['get_account', 'get_options_guide']);
    tools.forEach((tool) => {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]{0,47}$/);
      expect(tool.title?.length).toBeGreaterThan(0);
      expect(Object.keys(tool.annotations ?? {}).sort()).toEqual(
        ['destructiveHint', 'idempotentHint', 'openWorldHint', 'readOnlyHint', 'title'].sort(),
      );
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.['type']).toBe('object');
      expect(PropertiesSchema.safeParse(tool.inputSchema.properties ?? {}).success).toBe(true);
      expect(collectKeys(tool).has('$ref')).toBe(false);
      expect(hasAnyOfWithDefault(tool)).toBe(false);
    });
    const card = buildServerCard({ config, publicUrl: 'https://mcp.mnogo-reels.ru/mcp' });
    expect(card.tools).toEqual(tools);
  });

  it('server card prompts, resources and templates match the live lists', async () => {
    const config = configFor(mode.transport, '/mcp');
    const harness = await start(mode, { config, apiKey: undefined });
    const card = buildServerCard({ config, publicUrl: 'https://mcp.mnogo-reels.ru/mcp' });
    expect(card.prompts).toEqual((await harness.client.listPrompts()).prompts);
    expect(card.resources).toEqual((await harness.client.listResources()).resources);
    expect(card.resourceTemplates).toEqual((await harness.client.listResourceTemplates()).resourceTemplates);
  });

  it('get_options_guide works without a key and returns validated structured content', async () => {
    const harness = await start(mode, { apiKey: undefined });
    const result = await harness.client.callTool({ name: 'get_options_guide', arguments: { topic: 'outro' } });
    expect(result.isError).toBeFalsy();
    expect(structuredOf(result)['topic']).toBe('outro');
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  });

  it('get_account reports a working key and a rejected key', async () => {
    const working = await start(mode, {
      routes: [{ method: 'GET', path: '/videos', respond: () => ok({ items: [] }) }],
    });
    const accepted = await working.client.callTool({ name: 'get_account', arguments: {} });
    expect(structuredOf(accepted)).toMatchObject({ authenticated: true, transport: mode.transport });
    const rejecting = await start(mode, {
      routes: [{ method: 'GET', path: '/videos', respond: () => status(401, 'bad') }],
    });
    const rejected = await rejecting.client.callTool({ name: 'get_account', arguments: {} });
    expect(structuredOf(rejected)).toMatchObject({ authenticated: false });
  });

  it('a key-only tool without a key is a text-only missing_api_key error', async () => {
    const keyed = defineTool({
      name: 'keyed_probe',
      toolset: 'account',
      title: 'Keyed probe',
      description: 'Needs a key.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      requiresApiKey: true,
      handler: () => Promise.resolve({ ok: true }),
    });
    const harness = await start(mode, { apiKey: undefined, tools: [keyed] });
    const result = await harness.client.callTool({ name: 'keyed_probe', arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]: /);
  });

  it('calling an unknown tool is a JSON-RPC -32602 error', async () => {
    const harness = await start(mode);
    await expect(harness.client.callTool({ name: 'no_such_tool', arguments: {} })).rejects.toMatchObject({
      code: -32602,
    });
  });

  it('calling a tool disabled by the read-only profile is a JSON-RPC -32602 error', async () => {
    const harness = await start(mode, { config: configFor(mode.transport, '/mcp/readonly') });
    await expect(
      harness.client.callTool({
        name: 'create_clip_job',
        arguments: { source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', max_credits: 1 },
      }),
    ).rejects.toMatchObject({ code: -32602 });
    expect(harness.api.requests()).toEqual([]);
  });

  it('invalid arguments come back as an SDK error result', async () => {
    const harness = await start(mode);
    const result = await harness.client.callTool({ name: 'get_options_guide', arguments: { topic: 'nope' } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });
});
