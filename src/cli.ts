#!/usr/bin/env node
import { loadProcessConfig, type ProcessConfig } from './config.js';
import { createDeps, type Deps } from './runtime/deps.js';
import { createLogger } from './runtime/logger.js';
import { createHttpApp } from './transports/http/app.js';
import { serveHttp } from './transports/http/node-server.js';
import { runStdio } from './transports/stdio.js';
import { VERSION } from './version.js';

const USAGE = 'Usage: mnogoreels-mcp [--http] [--help] [--version]';

const HELP = `${USAGE}

MCP server for MnogoReels: long videos to captioned vertical shorts, transcripts and articles.
Serves stdio by default; --http (or MNOGOREELS_TRANSPORT=http) serves Streamable HTTP at /mcp.

Environment variables:
  MNOGOREELS_API_KEY               personal key mrfrt_usr_... (stdio only; not needed to start or list tools)
  MNOGOREELS_API_URL               backend URL (default https://api.mnogo-reels.ru)
  MNOGOREELS_PROFILE               default | readonly | directory (default default)
  MNOGOREELS_TOOLSETS              comma list of clips,transcripts,articles,library,thumbnails or all (default all)
  MNOGOREELS_READ_ONLY             true | false (default false): hide every tool that creates jobs
  MNOGOREELS_MAX_CREDITS_PER_CALL  positive integer: hard credit cap per call (default none)
  MNOGOREELS_MAX_WINDOW_SEC        positive integer: longest range per paid job (default 1800)
  MNOGOREELS_MEDIA_URLS            direct | both (default direct)
  MNOGOREELS_DEBUG                 true | false (default false): full error messages in stdio logs
  MNOGOREELS_TRANSPORT             stdio | http (default stdio)
  MNOGOREELS_HOST, MNOGOREELS_PORT HTTP bind address (default 127.0.0.1, 8080)
  MNOGOREELS_PUBLIC_URL            public MCP URL for the server card (default https://mcp.mnogo-reels.ru/mcp)
  MNOGOREELS_ALLOWED_HOSTS         comma list of Host names (default localhost,127.0.0.1,[::1])
  MNOGOREELS_ALLOWED_ORIGINS       comma list of Origin host names, or * (default localhost,127.0.0.1,[::1])
  MNOGOREELS_TRUSTED_PROXIES       comma list of proxy CIDRs whose forwarded headers are trusted (default none)

Docs: https://github.com/RealSatanyan/mnogoreels-mcp#readme
`;

const FLAGS = new Set(['--http', '--help', '--version']);
const PAID_DRAIN_MS = 35_000;

type Command =
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'serve'; readonly http: boolean };

const parseArgs = (args: readonly string[]): Command => {
  if (args.some((arg) => !FLAGS.has(arg))) return { kind: 'invalid' };
  if (args.includes('--help')) return { kind: 'help' };
  if (args.includes('--version')) return { kind: 'version' };
  return { kind: 'serve', http: args.includes('--http') };
};

const onShutdownSignal = (deps: Deps, close: () => Promise<void>): void => {
  const shutdown = (): void => {
    void close().then(() => {
      deps.logger.info('shutdown');
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
};

const startStdio = (processConfig: ProcessConfig, deps: Deps): void => {
  const handle = runStdio({ processConfig, deps });
  deps.logger.info('startup', { transport: 'stdio', version: VERSION, profile: processConfig.profile });
  onShutdownSignal(deps, async () => {
    await deps.dedupe.drain(PAID_DRAIN_MS);
    await handle.close();
  });
};

const startHttp = async (processConfig: ProcessConfig, deps: Deps): Promise<void> => {
  const app = createHttpApp({ processConfig, deps });
  const handle = await serveHttp({ app, processConfig, deps });
  deps.logger.info('startup', {
    transport: 'http',
    version: VERSION,
    host: processConfig.http.host,
    port: handle.port,
    profile: processConfig.profile,
    allowed_hosts: processConfig.http.allowedHosts.join(','),
  });
  onShutdownSignal(deps, handle.close);
};

const serve = async (http: boolean): Promise<void> => {
  const loaded = loadProcessConfig({ env: process.env, forceHttp: http });
  if (!loaded.ok) {
    process.stderr.write(`mnogoreels-mcp: ${loaded.error}\n`);
    process.exitCode = 2;
    return;
  }
  const { config, warnings } = loaded;
  const deps = createDeps({ debug: config.debug });
  warnings.forEach((message) => {
    deps.logger.warn('startup', { message });
  });
  if (config.transport === 'http') await startHttp(config, deps);
  else startStdio(config, deps);
};

const main = async (args: readonly string[]): Promise<void> => {
  const command = parseArgs(args);
  switch (command.kind) {
    case 'help':
      process.stdout.write(HELP);
      return;
    case 'version':
      process.stdout.write(`${VERSION}\n`);
      return;
    case 'invalid':
      process.stderr.write(`${USAGE}\nRun mnogoreels-mcp --help for the environment variables.\n`);
      process.exitCode = 2;
      return;
    case 'serve':
      await serve(command.http);
  }
};

main(process.argv.slice(2)).catch((error: unknown) => {
  createLogger({ debug: false }).errorOf('internal_error', error);
  process.exit(1);
});
