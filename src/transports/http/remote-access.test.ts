import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { parseConfigHeaders, resolveEffectiveConfig, type ProcessConfig } from '../../config.js';
import { selectTools } from '../../server/toolsets.js';
import {
  CLIENT_IP,
  SERVICE_KEY,
  TEST_TOOLS,
  USER_KEY,
  connectClient,
  createTestApp,
  httpRequest,
  jsonRpc,
  mcpPost,
} from './fixtures.js';

const ERAS = ['modern', 'legacy'] as const;

const MODERN_HEADERS = {
  'mcp-protocol-version': '2026-07-28',
  'mcp-method': 'tools/call',
  'mcp-name': 'create_clip_job',
};

const callBody = (era: 'modern' | 'legacy', name: string, id: number): string =>
  jsonRpc(
    'tools/call',
    {
      name,
      arguments: {},
      ...(era === 'modern'
        ? {
            _meta: {
              [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
              [CLIENT_CAPABILITIES_META_KEY]: {},
              [CLIENT_INFO_META_KEY]: { name: 'raw', version: '1.0.0' },
            },
          }
        : {}),
    },
    id,
  );

const expectedNames = (
  processConfig: ProcessConfig,
  path: string,
  headers: Readonly<Record<string, string>> = {},
): readonly string[] => {
  const parsed = parseConfigHeaders(new Headers(headers));
  const config = resolveEffectiveConfig({
    process: processConfig,
    path,
    ...(parsed.ok ? { headers: parsed.value } : {}),
  });
  return selectTools(config, TEST_TOOLS).map((tool) => tool.name);
};

const KEY_REQUIRED_MESSAGE =
  "MnogoReels API key required. Send 'Authorization: Bearer <key>' or 'X-API-Key: <key>'. Create a key at https://mnogo-reels.ru/dashboard/developers?tab=keys";

describe.each(ERAS)('API key pre-check (%s body)', (era) => {
  const headersFor = (extra: Readonly<Record<string, string>> = {}) => ({
    ...(era === 'modern' ? MODERN_HEADERS : {}),
    ...extra,
  });

  it('answers tools/call of a key-only tool without a key with 401 and a Bearer challenge', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });

    const response = await app.fetch(mcpPost('/mcp', callBody(era, 'create_clip_job', 41), headersFor()));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer realm="mnogoreels", error="invalid_token", error_description="MnogoReels API key required"',
    );
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 41,
      error: { code: -32001, message: KEY_REQUIRED_MESSAGE },
    });
  });

  it('answers a service key with 401 and the format message', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });

    const response = await app.fetch(
      mcpPost('/mcp', callBody(era, 'create_clip_job', 42), headersFor({ authorization: `Bearer ${SERVICE_KEY}` })),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 42,
      error: { code: -32001, message: 'The API key format is invalid (it must start with mrfrt_usr_)' },
    });
  });

  it('lets a tools/call of a key-only tool through when the key arrives in X-API-Key', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });

    const response = await app.fetch(
      mcpPost('/mcp', callBody(era, 'create_clip_job', 43), headersFor({ 'x-api-key': USER_KEY })),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"ok":true');
  });

  it('does not challenge a key-only tool that the path disables', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });

    const response = await app.fetch(mcpPost('/mcp/readonly', callBody(era, 'create_clip_job', 44), headersFor()));

    expect(response.status).not.toBe(401);
  });
});

describe('API key pre-check edge cases', () => {
  it('passes a malformed JSON body to the MCP handler instead of challenging it', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });

    const response = await app.fetch(mcpPost('/mcp', '{"method":"tools/call"'));

    expect(response.status).toBe(400);
  });

  it('does not challenge a batch', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });

    const response = await app.fetch(mcpPost('/mcp', `[${callBody('legacy', 'create_clip_job', 45)}]`));

    expect(response.status).not.toBe(401);
  });
});

describe.each(ERAS)('serving tools over HTTP (%s client)', (era) => {
  it('calls get_options_guide without a key', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });
    const client = await connectClient({ app, era });

    const result = await client.callTool({ name: 'get_options_guide', arguments: { topic: 'pricing' } });

    expect(result.isError).not.toBe(true);
  });

  it('lists only the read-only tools on /mcp/readonly', async () => {
    const { app, processConfig } = createTestApp({ tools: TEST_TOOLS });
    const client = await connectClient({ app, era, path: '/mcp/readonly' });

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(expectedNames(processConfig, '/mcp/readonly'));
    expect(tools.map((tool) => tool.name)).not.toContain('create_clip_job');
  });

  it('narrows the toolsets with X-MnogoReels-Toolsets', async () => {
    const { app, processConfig } = createTestApp({ tools: TEST_TOOLS });
    const headers = { 'x-mnogoreels-toolsets': 'library' };
    const client = await connectClient({ app, era, headers });

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(expectedNames(processConfig, '/mcp', headers));
    expect(tools.map((tool) => tool.name)).toContain('list_packs');
    expect(tools.map((tool) => tool.name)).not.toContain('create_clip_job');
  });

  it('never widens /mcp/readonly with X-MnogoReels-Read-Only: false', async () => {
    const { app, processConfig } = createTestApp({ tools: TEST_TOOLS });
    const client = await connectClient({
      app,
      era,
      path: '/mcp/readonly',
      headers: { 'x-mnogoreels-read-only': 'false' },
    });

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(expectedNames(processConfig, '/mcp/readonly'));
  });

  it('serves the directory profile on /mcp/directory', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });
    const client = await connectClient({ app, era, path: '/mcp/directory' });

    const result = await client.callTool({ name: 'get_account', arguments: {} });

    expect(result.structuredContent).toMatchObject({ profile: 'directory', authenticated: false });
  });

  it('serves the key sent in the Authorization header', async () => {
    const { app } = createTestApp({ tools: TEST_TOOLS });
    const client = await connectClient({ app, era, headers: { authorization: `Bearer ${USER_KEY}` } });

    const result = await client.callTool({ name: 'create_clip_job', arguments: {} });

    expect(result.structuredContent).toEqual({ ok: true });
  });

  it('uses the client IP from the socket and ignores a spoofed X-MnogoReels-Client-Ip', async () => {
    const { app, logs } = createTestApp({ tools: TEST_TOOLS });
    const client = await connectClient({
      app,
      era,
      clientIp: CLIENT_IP,
      headers: { 'x-mnogoreels-client-ip': '192.0.2.99' },
    });

    await client.callTool({ name: 'get_options_guide', arguments: {} });

    const toolLine = logs.entries().find((entry) => entry['event'] === 'tool_call');
    expect(toolLine?.['ip']).toBe('203.0.113.0/24');
    expect(logs.text()).not.toContain('192.0.2.');
  });

  it('drops a spoofed X-MnogoReels-Client-Ip when the socket address is unknown', async () => {
    const { app, logs } = createTestApp({ tools: TEST_TOOLS });
    const client = await connectClient({ app, era, headers: { 'x-mnogoreels-client-ip': '192.0.2.99' } });

    await client.callTool({ name: 'get_options_guide', arguments: {} });

    expect(logs.text()).not.toContain('192.0.2.');
  });
});

describe('access log', () => {
  it('writes one http_request line without the query string', async () => {
    const { app, logs } = createTestApp();

    await app.fetch(mcpPost('/mcp/readonly?client=inspector', jsonRpc('ping'), { 'mcp-method': 'ping' }), {
      clientIp: CLIENT_IP,
    });

    const lines = logs.entries().filter((entry) => entry['event'] === 'http_request');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      method: 'POST',
      path: '/mcp/readonly',
      ip: '203.0.113.0/24',
      mcp_method: 'ping',
    });
    expect(lines[0]?.['status']).toEqual(expect.any(Number));
    expect(lines[0]?.['ms']).toBeGreaterThanOrEqual(0);
    expect(lines[0]?.['ms']).toBeLessThan(60_000);
    expect(logs.text()).not.toContain('inspector');
  });

  it('logs at most 64 characters of the MCP method header', async () => {
    const { app, logs } = createTestApp();

    await app.fetch(mcpPost('/mcp', jsonRpc('ping'), { 'mcp-method': 'm'.repeat(100) }));

    const line = logs.entries().find((entry) => entry['event'] === 'http_request');
    expect(line?.['mcp_method']).toBe('m'.repeat(64));
  });

  it('does not log successful /healthz probes', async () => {
    const { app, logs } = createTestApp();

    const response = await app.fetch(httpRequest('/healthz'), { clientIp: CLIENT_IP });

    expect(response.status).toBe(200);
    expect(logs.entries().filter((entry) => entry['event'] === 'http_request')).toEqual([]);
  });

  it('never logs a key or a query from a malformed request', async () => {
    const { app, logs } = createTestApp();

    await app.fetch(
      mcpPost(
        '/mcp?search=secret-term',
        `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"key":"${USER_KEY}"`,
        {
          authorization: `Bearer ${USER_KEY}`,
        },
      ),
    );

    expect(logs.text()).not.toContain('TestKey0123456789');
    expect(logs.text()).not.toContain('secret-term');
  });

  it('logs rejected MCP requests as structured errors without their message or arguments', async () => {
    const { app, logs } = createTestApp();

    await app.fetch(
      mcpPost(
        '/mcp?search=secret-term',
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'get_options_guide',
            arguments: { topic: USER_KEY },
            _meta: { [PROTOCOL_VERSION_META_KEY]: '2026-07-28' },
          },
        }),
        MODERN_HEADERS,
      ),
    );

    const errorLine = logs.entries().find((entry) => entry['event'] === 'mcp_handler_error');
    expect(errorLine).toMatchObject({ level: 'error' });
    expect(errorLine?.['error']).toHaveProperty('errorId');
    expect(logs.text()).not.toContain('TestKey0123456789');
    expect(logs.text()).not.toContain('secret-term');
    expect(logs.text()).not.toContain('clientCapabilities');
  });
});
