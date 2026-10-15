import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { resolveEffectiveConfig, type ProcessConfig } from '../config.js';
import type { Deps } from '../runtime/deps.js';
import { createMcpServer } from '../server/create-server.js';

export const runStdio = (options: {
  readonly processConfig: ProcessConfig;
  readonly deps: Deps;
}): StdioServerHandle => {
  const config = resolveEffectiveConfig({ process: options.processConfig });
  return serveStdio(
    () => createMcpServer({ config, apiKey: options.processConfig.apiKey, clientIp: undefined, deps: options.deps }),
    {
      onerror: (error) => {
        options.deps.logger.errorOf('stdio_error', error);
      },
    },
  );
};
