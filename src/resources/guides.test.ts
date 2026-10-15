import { describe, expect, it, onTestFinished } from 'vitest';
import { loadProcessConfig, resolveEffectiveConfig, type EffectiveConfig } from '../config.js';
import { LANGUAGE, OPTION_CATALOG, PAID_JOB_NOTICE, pricingGuide } from '../domain/options.js';
import { buildServerCard } from '../server/card.js';
import { buildInstructions } from '../server/metadata.js';
import { createHarness, type HarnessOptions } from '../../test/support/harness.js';

type Mode = { readonly label: string; readonly transport: 'http' | 'stdio'; readonly era: 'modern' | 'legacy' };

const MODES: readonly Mode[] = [
  { label: 'http modern', transport: 'http', era: 'modern' },
  { label: 'http legacy', transport: 'http', era: 'legacy' },
  { label: 'stdio legacy', transport: 'stdio', era: 'legacy' },
  { label: 'stdio modern', transport: 'stdio', era: 'modern' },
];

const PATHS = ['/mcp', '/mcp/readonly', '/mcp/directory'] as const;

const configFor = (path: string): EffectiveConfig => {
  const loaded = loadProcessConfig({ env: {}, forceHttp: true });
  if (!loaded.ok) throw new Error(loaded.error);
  return resolveEffectiveConfig({ process: loaded.config, path });
};

const start = async (options: HarnessOptions = {}) => {
  const harness = await createHarness(options);
  onTestFinished(harness.close);
  return harness;
};

const readText = async (options: HarnessOptions & { readonly uri: string }) => {
  const harness = await start(options);
  const result = await harness.client.readResource({ uri: options.uri });
  const [content] = result.contents;
  return { content, text: content && 'text' in content ? content.text : '', harness };
};

const GUIDES = [
  { uri: 'mnogoreels://guide/options', name: 'guide-options', title: 'Clip options guide' },
  { uri: 'mnogoreels://guide/pricing', name: 'guide-pricing', title: 'Pricing and credits' },
  { uri: 'mnogoreels://guide/workflow', name: 'guide-workflow', title: 'How to use MnogoReels tools' },
];

describe.each(MODES)('guide resources: $label', ({ transport, era }) => {
  it('lists the three Markdown guides without an API key and without calling the API', async () => {
    const harness = await start({ transport, era, apiKey: undefined });
    const { resources } = await harness.client.listResources();
    expect(resources.map(({ uri, name, title, mimeType }) => ({ uri, name, title, mimeType }))).toEqual(
      GUIDES.map((guide) => ({ ...guide, mimeType: 'text/markdown' })),
    );
    expect(harness.api.requests()).toEqual([]);
  });

  it('reads the pricing guide without an API key', async () => {
    const { content, text, harness } = await readText({ transport, era, apiKey: undefined, uri: GUIDES[1]?.uri ?? '' });
    expect(content).toMatchObject({ uri: 'mnogoreels://guide/pricing', mimeType: 'text/markdown' });
    expect(text).toContain('# Pricing and credits');
    expect(harness.api.requests()).toEqual([]);
  });
});

describe('guide caching', () => {
  it('lets 2026 clients cache a guide publicly for an hour', async () => {
    const harness = await start({ era: 'modern' });
    expect(await harness.client.readResource({ uri: 'mnogoreels://guide/options' })).toMatchObject({
      ttlMs: 3_600_000,
      cacheScope: 'public',
    });
  });
});

describe('guide-pricing', () => {
  it('states the price rule with the window limit, the examples, the free operations and the no-refund fact', async () => {
    const { text } = await readText({ uri: 'mnogoreels://guide/pricing' });
    const pricing = pricingGuide(1800);
    expect(pricing.rule).toContain('30 minutes');
    expect(text).toContain(pricing.rule);
    pricing.examples.forEach((example) => {
      expect(text).toContain(`- ${example}`);
    });
    expect(text).toContain(`Free: ${pricing.free.join(', ')}.`);
    expect(text).toContain(PAID_JOB_NOTICE);
  });

  it('follows the operator window limit', async () => {
    const { text } = await readText({ uri: 'mnogoreels://guide/pricing', config: { maxWindowSec: 600 } });
    expect(text).toContain('at most 10 minutes');
    expect(text).not.toContain('30 minutes');
  });
});

describe('guide-options', () => {
  it('has a Markdown table for every catalog option with every value, its description and the default', async () => {
    const { text } = await readText({ uri: 'mnogoreels://guide/options' });
    expect(text).toContain('# Clip options guide');
    [...OPTION_CATALOG, LANGUAGE].forEach((option) => {
      expect(text).toContain(
        `## ${option.option}\n\n${option.description}\n\n| Value | Description | Default |\n|---|---|---|\n`,
      );
      option.entries.forEach((entry) => {
        expect(text).toContain(`| \`${entry.value}\` | ${entry.description} | ${entry.isDefault ? 'yes' : ''} |\n`);
      });
    });
  });

  it('marks exactly one default per clip option', async () => {
    const { text } = await readText({ uri: 'mnogoreels://guide/options' });
    expect(text.match(/\| yes \|/g)).toHaveLength(OPTION_CATALOG.length);
  });
});

describe('guide-workflow', () => {
  it.each(PATHS)('is the server instructions of the %s profile as Markdown', async (path) => {
    const config = configFor(path);
    const { text } = await readText({ uri: 'mnogoreels://guide/workflow', config });
    expect(text).toBe(`# How to use MnogoReels tools\n\n${buildInstructions(config)}\n`);
  });
});

describe('server card resources', () => {
  it.each(PATHS)('lists the same static resources as resources/list for %s', async (path) => {
    const config = configFor(path);
    const harness = await start({ config, apiKey: undefined });
    const card = buildServerCard({ config, publicUrl: 'https://mcp.mnogo-reels.ru/mcp' });
    expect(card.resources).toEqual((await harness.client.listResources()).resources);
  });
});
