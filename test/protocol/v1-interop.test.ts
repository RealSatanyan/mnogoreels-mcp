import { describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod';
import { defineTool, type RegistrableTool } from '../../src/server/registry.js';
import { selectTools } from '../../src/server/toolsets.js';
import { ok, status } from '../support/fake-api.js';
import { createV1Harness, structuredOf, textOf, type HarnessOptions } from '../support/harness.js';

const TRANSPORTS = ['stdio', 'http'] as const;

const start = async (v1Transport: 'stdio' | 'http', options: HarnessOptions = {}) => {
  const harness = await createV1Harness({ ...options, v1Transport });
  onTestFinished(harness.close);
  return harness;
};

const keyedTool = defineTool({
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

const strayKeyTool: RegistrableTool = {
  ...keyedTool,
  name: 'stray_key_probe',
  requiresApiKey: false,
  register: (server) => {
    server.registerTool(
      'stray_key_probe',
      { description: 'Returns a key its output schema does not declare.', outputSchema: z.object({ ok: z.boolean() }) },
      () => ({ content: [{ type: 'text', text: '{"ok":true}' }], structuredContent: { ok: true, stray: 1 } }),
    );
  },
};

describe.each(TRANSPORTS)('v1 SDK client over %s', (transport) => {
  it('lists every enabled tool in registration order', async () => {
    const harness = await start(transport);
    const { tools } = await harness.client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(selectTools(harness.config).map((tool) => tool.name));
  });

  it('validates structuredContent against the advertised output schema', async () => {
    const harness = await start(transport, { tools: [strayKeyTool] });
    await expect(harness.client.callTool({ name: 'stray_key_probe', arguments: {} })).rejects.toThrow(/output schema/i);
  });

  it.each([
    'all',
    'video_mode',
    'clip_length',
    'caption_style',
    'hook_style',
    'story_arc_style',
    'outro',
    'framing',
    'language',
    'pricing',
  ])('get_options_guide %s passes ajv validation of structuredContent', async (topic) => {
    const harness = await start(transport, { apiKey: undefined });
    const result = await harness.client.callTool({ name: 'get_options_guide', arguments: { topic } });
    expect(result.isError).toBeFalsy();
    expect(structuredOf(result)['topic']).toBe(topic);
  });

  it('get_account without a key passes validation', async () => {
    const harness = await start(transport, { apiKey: undefined });
    const result = await harness.client.callTool({ name: 'get_account', arguments: {} });
    expect(structuredOf(result)).toMatchObject({ authenticated: false, api_key_hint: null });
  });

  it('get_account with a working key passes validation', async () => {
    const harness = await start(transport, {
      routes: [{ method: 'GET', path: '/videos', respond: () => ok({ items: [] }) }],
    });
    const result = await harness.client.callTool({ name: 'get_account', arguments: {} });
    expect(structuredOf(result)).toMatchObject({ authenticated: true });
  });

  it('get_account in the directory profile passes validation without buy_credits', async () => {
    const harness = await start(transport, {
      apiKey: undefined,
      config: { profile: 'directory', directory: true, maxCreditsPerCall: 10 },
    });
    const result = await harness.client.callTool({ name: 'get_account', arguments: {} });
    expect(structuredOf(result)).toMatchObject({ profile: 'directory', max_credits_per_call: 10 });
  });

  it('error results reach the v1 client as text, not as a schema failure', async () => {
    const harness = await start(transport, {
      routes: [{ method: 'GET', path: '/videos', respond: () => status(500) }],
    });
    const result = await harness.client.callTool({ name: 'get_account', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^Error \[upstream_error\]: /);
  });

  it('missing_api_key reaches the v1 client as a text-only error', async () => {
    const harness = await start(transport, { apiKey: undefined, tools: [keyedTool] });
    const result = await harness.client.callTool({ name: 'keyed_probe', arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]: /);
  });
});
