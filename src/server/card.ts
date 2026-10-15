import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/server';
import type { EffectiveConfig } from '../config.js';
import { describePrompts } from '../prompts/index.js';
import { describeResources } from '../resources/index.js';
import { SERVER_INFO } from './metadata.js';
import type { ToolDescription } from './registry.js';
import { selectTools } from './toolsets.js';

const MODERN_PROTOCOL_VERSION = '2026-07-28';
const DROPPED_PROTOCOL_VERSIONS = new Set(['2024-10-07']);

export const REGISTRY_NAME = 'ru.mnogo-reels/mnogoreels';

export type ServerCard = {
  readonly $schema: string;
  readonly name: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly websiteUrl: string;
  readonly repository: { readonly url: string; readonly source: string };
  readonly icons: typeof SERVER_INFO.icons;
  readonly remotes: readonly Readonly<Record<string, unknown>>[];
  readonly serverInfo: { readonly name: string; readonly title: string; readonly version: string };
  readonly authentication: { readonly required: boolean; readonly schemes: readonly string[] };
  readonly tools: readonly ToolDescription[];
  readonly resources: readonly Readonly<Record<string, unknown>>[];
  readonly resourceTemplates: readonly Readonly<Record<string, unknown>>[];
  readonly prompts: readonly Readonly<Record<string, unknown>>[];
};

export const buildServerCard = (options: {
  readonly config: EffectiveConfig;
  readonly publicUrl: string;
}): ServerCard => {
  const { config } = options;
  const { resources, resourceTemplates } = describeResources(config);
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
    name: REGISTRY_NAME,
    version: SERVER_INFO.version,
    title: SERVER_INFO.title,
    description: SERVER_INFO.description,
    websiteUrl: SERVER_INFO.websiteUrl,
    repository: { url: 'https://github.com/RealSatanyan/mnogoreels-mcp', source: 'github' },
    icons: SERVER_INFO.icons,
    remotes: [
      {
        type: 'streamable-http',
        url: options.publicUrl,
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
        supportedProtocolVersions: [
          MODERN_PROTOCOL_VERSION,
          ...SUPPORTED_PROTOCOL_VERSIONS.filter((version) => !DROPPED_PROTOCOL_VERSIONS.has(version)),
        ],
      },
    ],
    serverInfo: { name: SERVER_INFO.name, title: SERVER_INFO.title, version: SERVER_INFO.version },
    authentication: { required: true, schemes: ['bearer'] },
    tools: selectTools(config).map((tool) => tool.describe(config)),
    resources,
    resourceTemplates,
    prompts: describePrompts(config),
  };
};
