import {
  Client,
  InMemoryTransport,
  StreamableHTTPClientTransport,
  type ClientCapabilities,
  type ElicitRequest,
  type ElicitResult,
} from '@modelcontextprotocol/client';
import { Client as V1Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport as V1HttpTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport as V1InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ElicitRequestSchema as V1ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadProcessConfig, resolveEffectiveConfig, type EffectiveConfig } from '../../src/config.js';
import { createDeps, type Clock, type Deps } from '../../src/runtime/deps.js';
import type { RegistrableTool } from '../../src/server/registry.js';
import { createMcpServer } from '../../src/server/create-server.js';
import { createCaptureLogger, type CapturedLogs } from './capture-logger.js';
import { createFakeClock } from './clock.js';
import { createFakeApi, type FakeApi, type FakeRoute } from './fake-api.js';

export const TEST_API_KEY = 'mrfrt_usr_TestKey0123456789abcdefXYZ';
export const TEST_CLIENT_IP = '203.0.113.10';

export type HarnessOptions = {
  readonly routes?: readonly FakeRoute[];
  readonly config?: Partial<EffectiveConfig>;
  readonly apiKey?: string | undefined;
  readonly era?: 'modern' | 'legacy';
  readonly transport?: 'http' | 'stdio';
  readonly clientCapabilities?: ClientCapabilities;
  readonly onElicit?: (request: ElicitRequest) => ElicitResult;
  readonly clock?: Clock;
  readonly tools?: readonly RegistrableTool[];
  readonly clientIp?: string | undefined;
  readonly deps?: Deps;
};

export type HarnessParts = {
  readonly api: FakeApi;
  readonly logs: CapturedLogs;
  readonly deps: Deps;
  readonly config: EffectiveConfig;
  readonly apiKey: string | undefined;
  readonly clientIp: string | undefined;
};

export type Harness = HarnessParts & {
  readonly client: Client;
  readonly close: () => Promise<void>;
};

const defaultConfig = (transport: 'http' | 'stdio'): EffectiveConfig => {
  const loaded = loadProcessConfig({ env: {}, forceHttp: transport === 'http' });
  if (!loaded.ok) throw new Error(loaded.error);
  return resolveEffectiveConfig({ process: loaded.config });
};

const buildParts = (options: HarnessOptions): HarnessParts => {
  const transport = options.transport ?? 'http';
  const api = createFakeApi(options.routes ?? []);
  const logs = createCaptureLogger();
  const deps =
    options.deps ??
    createDeps({
      fetch: api.fetch,
      clock: options.clock ?? createFakeClock({ autoAdvance: true }),
      logger: logs.logger,
    });
  const config: EffectiveConfig = {
    ...defaultConfig(transport),
    ...options.config,
    apiUrl: api.baseUrl,
  };
  return {
    api,
    logs,
    deps,
    config,
    apiKey: 'apiKey' in options ? options.apiKey : TEST_API_KEY,
    clientIp: 'clientIp' in options ? options.clientIp : transport === 'http' ? TEST_CLIENT_IP : undefined,
  };
};

const serverFactory = (parts: HarnessParts, tools: readonly RegistrableTool[] | undefined) => () =>
  createMcpServer({
    config: parts.config,
    apiKey: parts.apiKey,
    clientIp: parts.clientIp,
    deps: parts.deps,
    ...(tools ? { tools } : {}),
  });

const connectServer = async (
  parts: HarnessParts,
  options: HarnessOptions,
  connect: (transport: StreamableHTTPClientTransport | InMemoryTransport) => Promise<void>,
): Promise<() => Promise<void>> => {
  const factory = serverFactory(parts, options.tools);
  if ((options.transport ?? 'http') === 'stdio') {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const handle = serveStdio(factory, { transport: serverSide });
    await connect(clientSide);
    return () => handle.close();
  }
  const handler = createMcpHandler(factory, { legacy: 'stateless', responseMode: 'auto' });
  await connect(
    new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    }),
  );
  return () => handler.close();
};

export const createHarness = async (options: HarnessOptions = {}): Promise<Harness> => {
  const parts = buildParts(options);
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    {
      capabilities: options.clientCapabilities ?? {},
      ...((options.era ?? 'modern') === 'modern' ? { versionNegotiation: { mode: { pin: '2026-07-28' } } } : {}),
    },
  );
  const { onElicit } = options;
  if (onElicit) client.setRequestHandler('elicitation/create', (request) => onElicit(request));
  const closeServer = await connectServer(parts, options, (transport) => client.connect(transport));
  return {
    ...parts,
    client,
    close: async () => {
      await client.close();
      await closeServer();
      parts.api.assertAllMatched();
    },
  };
};

const connectV1Server = async (
  transport: 'stdio' | 'http',
  factory: ReturnType<typeof serverFactory>,
  client: V1Client,
): Promise<() => Promise<void>> => {
  if (transport === 'stdio') {
    const [clientSide, serverSide] = V1InMemoryTransport.createLinkedPair();
    const handle = serveStdio(factory, { transport: serverSide });
    await client.connect(clientSide);
    return () => handle.close();
  }
  const handler = createMcpHandler(factory, { legacy: 'stateless', responseMode: 'auto' });
  await client.connect(
    new V1HttpTransport(new URL('http://test.local/mcp'), {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    }),
  );
  return () => handler.close();
};

export type V1Harness = HarnessParts & {
  readonly client: V1Client;
  readonly close: () => Promise<void>;
};

export const createV1Harness = async (
  options: HarnessOptions & { readonly v1Transport?: 'stdio' | 'http' } = {},
): Promise<V1Harness> => {
  const transport = options.v1Transport ?? 'stdio';
  const parts = buildParts({ ...options, transport });
  const client = new V1Client(
    { name: 'v1-test-client', version: '1.0.0' },
    { capabilities: options.clientCapabilities ?? {} },
  );
  const { onElicit } = options;
  if (onElicit) client.setRequestHandler(V1ElicitRequestSchema, (request) => onElicit(request));
  const closeServer = await connectV1Server(transport, serverFactory(parts, options.tools), client);
  await client.listTools();
  return {
    ...parts,
    client,
    close: async () => {
      await client.close();
      await closeServer();
      parts.api.assertAllMatched();
    },
  };
};

export const textOf = (result: unknown): string => {
  const content: unknown =
    typeof result === 'object' && result !== null && 'content' in result ? result.content : undefined;
  const first: unknown = Array.isArray(content) ? content[0] : undefined;
  return typeof first === 'object' && first !== null && 'text' in first && typeof first.text === 'string'
    ? first.text
    : '';
};

export const errorJsonOf = (result: unknown): unknown => JSON.parse(textOf(result).split('\n')[1] ?? 'null');

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const structuredOf = (result: unknown): Readonly<Record<string, unknown>> => {
  const value: unknown = isRecord(result) ? result['structuredContent'] : undefined;
  return isRecord(value) ? value : {};
};
