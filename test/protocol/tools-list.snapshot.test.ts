import { describe, expect, it, onTestFinished } from 'vitest';
import { loadProcessConfig, resolveEffectiveConfig, type EffectiveConfig } from '../../src/config.js';
import { createHarness } from '../support/harness.js';

const PROFILES = [
  { profile: 'default', path: '/mcp' },
  { profile: 'readonly', path: '/mcp/readonly' },
  { profile: 'directory', path: '/mcp/directory' },
] as const;

const configFor = (path: string): EffectiveConfig => {
  const loaded = loadProcessConfig({ env: {}, forceHttp: true });
  if (!loaded.ok) throw new Error(loaded.error);
  return resolveEffectiveConfig({ process: loaded.config, path });
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])]),
  );
};

const stable = (value: unknown): string => `${JSON.stringify(sortKeys(value), null, 2)}\n`;

describe.each(PROFILES)('listing snapshots: $profile', ({ profile, path }) => {
  const start = async () => {
    const harness = await createHarness({ config: configFor(path), apiKey: undefined, era: 'modern' });
    onTestFinished(harness.close);
    return harness;
  };

  it('tools/list', async () => {
    const { client } = await start();
    await expect(stable((await client.listTools()).tools)).toMatchFileSnapshot(`__snapshots__/tools-${profile}.json`);
  });

  it('prompts/list', async () => {
    const { client } = await start();
    await expect(stable((await client.listPrompts()).prompts)).toMatchFileSnapshot(
      `__snapshots__/prompts-${profile}.json`,
    );
  });

  it.each(['options', 'pricing', 'workflow'])('resources/read mnogoreels://guide/%s', async (guide) => {
    const { client } = await start();
    const { contents } = await client.readResource({ uri: `mnogoreels://guide/${guide}` });
    const [first] = contents;
    await expect(first !== undefined && 'text' in first ? first.text : '').toMatchFileSnapshot(
      `__snapshots__/guide-${guide}-${profile}.md`,
    );
  });

  it('resources/templates/list', async () => {
    const { client } = await start();
    await expect(stable((await client.listResourceTemplates()).resourceTemplates)).toMatchFileSnapshot(
      `__snapshots__/resource-templates-${profile}.json`,
    );
  });
});
