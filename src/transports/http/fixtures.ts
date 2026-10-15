import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { onTestFinished } from 'vitest';
import { loadProcessConfig, type Env, type ProcessConfig } from '../../config.js';
import { createDeps, type Deps } from '../../runtime/deps.js';
import { z } from 'zod';
import { defineTool, type RegistrableTool } from '../../server/registry.js';
import { TOOLSETS } from '../../server/toolsets.js';
import { createCaptureLogger, type CapturedLogs } from '../../../test/support/capture-logger.js';
import { createFakeClock, type FakeClock } from '../../../test/support/clock.js';
import { createFakeApi, type FakeApi, type FakeRoute } from '../../../test/support/fake-api.js';
import { createHttpApp, type HttpApp } from './app.js';

export const USER_KEY = 'mrfrt_usr_TestKey0123456789abcdefXYZ';
export const SERVICE_KEY = 'mrfrt_svc_TestKey0123456789abcdefXYZ';
export const CLIENT_IP = '203.0.113.10';
export const BASE_URL = 'http://localhost:8080';

const OkOutput = z.object({ ok: z.boolean() });

export const paidTestTool = defineTool({
  name: 'create_clip_job',
  toolset: 'clips',
  title: 'Paid test tool',
  description: 'Spends credits in tests.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  inputSchema: z.object({}),
  outputSchema: OkOutput,
  requiresApiKey: true,
  handler: () => Promise.resolve({ ok: true }),
});

export const libraryTestTool = defineTool({
  name: 'list_packs',
  toolset: 'library',
  title: 'Library test tool',
  description: 'Reads the library in tests.',
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: z.object({}),
  outputSchema: OkOutput,
  requiresApiKey: false,
  handler: () => Promise.resolve({ ok: true }),
});

export const TEST_TOOLS: readonly RegistrableTool[] = [
  ...TOOLSETS.filter((toolset) => toolset.name === 'account').flatMap((toolset) => toolset.tools),
  paidTestTool,
  libraryTestTool,
];

export const processConfigFor = (env: Env = {}): ProcessConfig => {
  const loaded = loadProcessConfig({ env, forceHttp: true });
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.config;
};

export type TestApp = {
  readonly app: HttpApp;
  readonly api: FakeApi;
  readonly logs: CapturedLogs;
  readonly deps: Deps;
  readonly clock: FakeClock;
  readonly processConfig: ProcessConfig;
};

export const createTestApp = (
  options: {
    readonly env?: Env;
    readonly tools?: readonly RegistrableTool[];
    readonly routes?: readonly FakeRoute[];
  } = {},
): TestApp => {
  const api = createFakeApi(options.routes ?? []);
  const logs = createCaptureLogger();
  const clock = createFakeClock({ autoAdvance: true });
  const deps = createDeps({ fetch: api.fetch, clock, logger: logs.logger });
  const processConfig: ProcessConfig = { ...processConfigFor(options.env), apiUrl: api.baseUrl };
  const app = createHttpApp({ processConfig, deps, ...(options.tools ? { tools: options.tools } : {}) });
  onTestFinished(() => app.close());
  return { app, api, logs, deps, clock, processConfig };
};

export const httpRequest = (
  path: string,
  init: {
    readonly method?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string;
  } = {},
): Request =>
  new Request(`${BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: { host: 'localhost:8080', ...init.headers },
    ...(init.body === undefined ? {} : { body: init.body }),
  });

export const jsonRpc = (method: string, params: Readonly<Record<string, unknown>> = {}, id = 1): string =>
  JSON.stringify({ jsonrpc: '2.0', id, method, params });

export const mcpPost = (path: string, body: string, headers: Readonly<Record<string, string>> = {}): Request =>
  httpRequest(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body,
  });

export const connectClient = async (options: {
  readonly app: HttpApp;
  readonly path?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly clientIp?: string;
  readonly era?: 'modern' | 'legacy';
}): Promise<Client> => {
  const client = new Client(
    { name: 'transport-test-client', version: '1.0.0' },
    options.era === 'modern' ? { versionNegotiation: { mode: { pin: '2026-07-28' } } } : {},
  );
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}${options.path ?? '/mcp'}`), {
    fetch: (url, init) => {
      const request = new Request(url, init);
      const headers = new Headers(request.headers);
      headers.set('host', 'localhost:8080');
      Object.entries(options.headers ?? {}).forEach(([name, value]) => {
        headers.set(name, value);
      });
      return options.app.fetch(
        new Request(request, { headers }),
        options.clientIp === undefined ? {} : { clientIp: options.clientIp },
      );
    },
  });
  await client.connect(transport);
  onTestFinished(() => client.close());
  return client;
};
