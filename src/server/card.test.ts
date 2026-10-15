import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadProcessConfig, resolveEffectiveConfig, type EffectiveConfig } from '../config.js';
import { VERSION } from '../version.js';
import { buildServerCard } from './card.js';
import { selectTools } from './toolsets.js';

const SepServerCardSchema = z.object({
  $schema: z.literal('https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json'),
  name: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/),
  version: z
    .string()
    .max(255)
    .regex(/^\d+\.\d+\.\d+/),
  description: z.string().min(1).max(100),
  title: z.string().min(1).max(100).optional(),
  websiteUrl: z.url().optional(),
  repository: z.object({ url: z.url(), source: z.string() }).optional(),
  icons: z
    .array(z.object({ src: z.url(), mimeType: z.string().optional(), sizes: z.array(z.string()).optional() }))
    .optional(),
  remotes: z
    .array(
      z
        .object({
          type: z.literal('streamable-http'),
          url: z.url(),
          headers: z.array(z.object({ name: z.string(), isRequired: z.boolean(), isSecret: z.boolean() }).loose()),
        })
        .loose(),
    )
    .optional(),
  serverInfo: z.object({ name: z.string(), version: z.string() }).loose(),
});

const configFor = (path?: string): EffectiveConfig => {
  const loaded = loadProcessConfig({ env: {}, forceHttp: true });
  if (!loaded.ok) throw new Error(loaded.error);
  return resolveEffectiveConfig({ process: loaded.config, ...(path ? { path } : {}) });
};

const PUBLIC_URL = 'https://mcp.mnogo-reels.ru/mcp';

describe('buildServerCard', () => {
  it('is a valid SEP-2127 card that also carries the Smithery fields', () => {
    const card = buildServerCard({ config: configFor(), publicUrl: PUBLIC_URL });
    expect(SepServerCardSchema.safeParse(card).success).toBe(true);
    expect(card).toMatchObject({
      name: 'ru.mnogo-reels/mnogoreels',
      version: VERSION,
      title: 'MnogoReels',
      websiteUrl: 'https://mnogo-reels.ru',
      repository: { url: 'https://github.com/RealSatanyan/mnogoreels-mcp', source: 'github' },
      serverInfo: { name: 'mnogoreels', title: 'MnogoReels', version: VERSION },
      authentication: { required: true, schemes: ['bearer'] },
    });
  });

  it('advertises the remote endpoint with the bearer header template', () => {
    const card = buildServerCard({ config: configFor(), publicUrl: 'https://mcp.example.com/mcp' });
    expect(card.remotes).toEqual([
      {
        type: 'streamable-http',
        url: 'https://mcp.example.com/mcp',
        headers: [
          {
            name: 'Authorization',
            description: 'MnogoReels API key from https://mnogo-reels.ru/dashboard/developers?tab=keys',
            isRequired: true,
            isSecret: true,
            value: 'Bearer {api_key}',
            variables: {
              api_key: {
                description: 'Personal API key (mrfrt_usr_...)',
                isRequired: true,
                isSecret: true,
                placeholder: 'mrfrt_usr_...',
              },
            },
          },
        ],
        supportedProtocolVersions: ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'],
      },
    ]);
  });

  it.each(['/mcp', '/mcp/readonly', '/mcp/directory'])('lists the enabled tools of %s through describe()', (path) => {
    const config = configFor(path);
    const card = buildServerCard({ config, publicUrl: PUBLIC_URL });
    expect(card.tools).toEqual(selectTools(config).map((tool) => tool.describe(config)));
    expect(card.tools.map((tool) => tool.name).slice(0, 2)).toEqual(['get_account', 'get_options_guide']);
  });

  it('lists resources, templates and prompts from their registries', () => {
    const card = buildServerCard({ config: configFor(), publicUrl: PUBLIC_URL });
    expect(Array.isArray(card.resources)).toBe(true);
    expect(Array.isArray(card.resourceTemplates)).toBe(true);
    expect(Array.isArray(card.prompts)).toBe(true);
  });
});
