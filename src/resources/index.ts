import type { McpServer } from '@modelcontextprotocol/server';
import type { EffectiveConfig } from '../config.js';
import type { Deps } from '../runtime/deps.js';
import { GUIDES } from './guides.js';
import { enabledTemplates, registerJobTemplates } from './job-templates.js';

export type ResourceRegistration = {
  readonly server: McpServer;
  readonly config: EffectiveConfig;
  readonly apiKey: string | undefined;
  readonly clientIp: string | undefined;
  readonly deps: Deps;
};

export type ResourceDescriptions = {
  readonly resources: readonly Readonly<Record<string, unknown>>[];
  readonly resourceTemplates: readonly Readonly<Record<string, unknown>>[];
};

const GUIDE_MIME = 'text/markdown';
const GUIDE_CACHE = { ttlMs: 3_600_000, cacheScope: 'public' } as const;

export const registerResources = (options: ResourceRegistration): void => {
  GUIDES.forEach((guide) => {
    options.server.registerResource(
      guide.name,
      guide.uri,
      { title: guide.title, description: guide.description, mimeType: GUIDE_MIME, cacheHint: GUIDE_CACHE },
      (uri) => ({ contents: [{ uri: uri.href, mimeType: GUIDE_MIME, text: guide.render(options.config) }] }),
    );
  });
  registerJobTemplates(options);
};

export const describeResources = (config: EffectiveConfig): ResourceDescriptions => ({
  resources: GUIDES.map((guide) => ({
    uri: guide.uri,
    name: guide.name,
    title: guide.title,
    description: guide.description,
    mimeType: GUIDE_MIME,
  })),
  resourceTemplates: enabledTemplates(config).map((template) => ({
    name: template.name,
    uriTemplate: template.uriTemplate,
    title: template.title,
    description: template.description,
    mimeType: template.mimeType,
  })),
});
