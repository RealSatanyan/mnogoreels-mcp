import { McpServer } from '@modelcontextprotocol/server';
import type { EffectiveConfig } from '../config.js';
import { registerPrompts } from '../prompts/index.js';
import { registerResources } from '../resources/index.js';
import type { Deps } from '../runtime/deps.js';
import { CACHE_HINTS, SERVER_INFO, buildInstructions } from './metadata.js';
import { registerToolsets, type RegistrableTool } from './registry.js';
import { selectTools } from './toolsets.js';

export const createMcpServer = (options: {
  readonly config: EffectiveConfig;
  readonly apiKey: string | undefined;
  readonly clientIp: string | undefined;
  readonly deps: Deps;
  readonly tools?: readonly RegistrableTool[];
}): McpServer => {
  const server = new McpServer(SERVER_INFO, {
    instructions: buildInstructions(options.config),
    cacheHints: CACHE_HINTS,
    maxToolInputElements: 2_000,
    capabilities: { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false } },
  });
  const runtime = { config: options.config, apiKey: options.apiKey, clientIp: options.clientIp, deps: options.deps };
  registerToolsets({ server, tools: selectTools(options.config, options.tools), runtime });
  registerResources({ server, ...runtime });
  registerPrompts({ server, ...runtime });
  return server;
};
