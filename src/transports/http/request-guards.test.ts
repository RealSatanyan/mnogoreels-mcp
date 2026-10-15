import { describe, expect, it } from 'vitest';
import { CLIENT_IP, USER_KEY, createTestApp, httpRequest, jsonRpc, mcpPost } from './fixtures.js';

const MCP_ALLOW_HEADERS =
  'Authorization, X-API-Key, Content-Type, Accept, Last-Event-ID, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, X-MnogoReels-Toolsets, X-MnogoReels-Read-Only, X-MnogoReels-Max-Credits-Per-Call';

const API_KEY_IN_URL = {
  error: 'api_key_in_url',
  message: "Never put the API key in the URL. Send it as 'Authorization: Bearer <key>' or 'X-API-Key: <key>'.",
};

const sendMany = async (count: number, send: () => Promise<Response>): Promise<readonly Response[]> =>
  Array.from({ length: count }).reduce<Promise<readonly Response[]>>(
    async (previous) => [...(await previous), await send()],
    Promise.resolve([]),
  );

describe('Host and Origin checks on MCP paths', () => {
  it('rejects a foreign Host with 403', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(mcpPost('/mcp', jsonRpc('ping'), { host: 'evil.example' }));

    expect(response.status).toBe(403);
  });

  it('accepts a Host from MNOGOREELS_ALLOWED_HOSTS', async () => {
    const { app } = createTestApp({ env: { MNOGOREELS_ALLOWED_HOSTS: 'mcp.example.test' } });

    const response = await app.fetch(httpRequest('/mcp', { headers: { host: 'mcp.example.test' } }));

    expect(response.status).toBe(405);
  });

  it.each(['https://evil.example', 'null'])('rejects Origin %s in origin-list mode', async (origin) => {
    const { app } = createTestApp();

    const response = await app.fetch(mcpPost('/mcp', jsonRpc('ping'), { origin }));

    expect(response.status).toBe(403);
  });

  it('echoes an allowed Origin with Vary: Origin in origin-list mode', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest('/mcp', { headers: { origin: 'http://localhost:5173' } }));

    expect(response.status).toBe(405);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('allows any Origin and answers with a wildcard when MNOGOREELS_ALLOWED_ORIGINS is *', async () => {
    const { app } = createTestApp({ env: { MNOGOREELS_ALLOWED_ORIGINS: '*' } });

    const response = await app.fetch(httpRequest('/mcp', { headers: { origin: 'https://claude.ai' } }));

    expect(response.status).toBe(405);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('marks MCP responses as uncacheable and exposes the auth and rate-limit headers', async () => {
    const { app } = createTestApp({ env: { MNOGOREELS_ALLOWED_ORIGINS: '*' } });

    const response = await app.fetch(httpRequest('/mcp'));

    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-expose-headers')).toBe(
      'WWW-Authenticate, Retry-After, Mcp-Session-Id, ETag',
    );
  });
});

describe('CORS preflight', () => {
  it.each(['/mcp', '/mcp/readonly', '/anything'])('answers OPTIONS %s with 204 and the MCP CORS set', async (path) => {
    const { app } = createTestApp({ env: { MNOGOREELS_ALLOWED_ORIGINS: '*' } });

    const response = await app.fetch(
      httpRequest(path, {
        method: 'OPTIONS',
        headers: { origin: 'https://claude.ai', 'access-control-request-method': 'POST' },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toBe(MCP_ALLOW_HEADERS);
    expect(response.headers.get('access-control-max-age')).toBe('86400');
  });

  it('does not grant a foreign Origin in origin-list mode', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(
      httpRequest('/mcp', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('API keys in the URL', () => {
  it.each([
    '/mcp?api_key=abc',
    '/mcp?apikey=abc',
    '/mcp?key=abc',
    '/mcp?token=abc',
    '/mcp?access_token=abc',
    '/mcp?authorization=Bearer%20abc',
    '/mcp?x-api-key=abc',
    '/mcp?MNOGOREELS_API_KEY=abc',
    '/mcp?mnogoreels_api_key=',
    '/mcp?q=mrfrt_usr_abc',
    '/mcp?q=MRFRT_SVC_abc',
    '/mcp?q=mrfrt%5Fusr%5Fabc',
    `/mcp?config=${Buffer.from(JSON.stringify({ apiKey: 'mrfrt_usr_abc' })).toString('base64')}`,
    `/mcp?config=${Buffer.from(JSON.stringify({ apiKey: 'mrfrt_usr_abc>>?' })).toString('base64url')}`,
    '/mcp/server-card?token=abc',
  ])('rejects %s with 400 and never forwards it', async (path) => {
    const { app, logs } = createTestApp();

    const response = await app.fetch(mcpPost(path, jsonRpc('ping')));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(API_KEY_IN_URL);
    expect(logs.text()).not.toContain('abc');
  });

  it('lets harmless query parameters through', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest('/mcp?client=inspector'));

    expect(response.status).toBe(405);
  });

  it('checks a query with broken percent-encoding as raw text', async () => {
    const { app } = createTestApp();

    const passed = await app.fetch(httpRequest('/mcp?q=%E0%A4%A'));
    const rejected = await app.fetch(httpRequest('/mcp?q=%E0%A4%A&q2=mrfrt_usr_abc'));

    expect(passed.status).toBe(405);
    expect(rejected.status).toBe(400);
  });
});

describe('request body size', () => {
  it('rejects a declared body over 1 MiB with 413', async () => {
    const { app } = createTestApp();
    const body = 'x'.repeat(1_048_577);

    const response = await app.fetch(mcpPost('/mcp', body, { 'content-length': String(body.length) }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'Request body too large.' },
    });
  });

  it('accepts a declared body of exactly 1 MiB', async () => {
    const { app } = createTestApp();
    const body = jsonRpc('ping', { pad: '' });
    const padded = `${body}${' '.repeat(1_048_576 - body.length)}`;

    const response = await app.fetch(mcpPost('/mcp', padded, { 'content-length': String(padded.length) }));

    expect(response.status).toBe(200);
  });

  it('rejects an undeclared body over 1 MiB with 413', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(mcpPost('/mcp', jsonRpc('ping', { pad: 'x'.repeat(1_048_576) })));

    expect(response.status).toBe(413);
  });
});

describe('per-IP rate limit', () => {
  it('answers the 121st keyless request in a minute with 429 and Retry-After', async () => {
    const { app } = createTestApp();

    const responses = await sendMany(121, () => app.fetch(httpRequest('/mcp'), { clientIp: CLIENT_IP }));

    expect(responses.slice(0, 120).every((response) => response.status === 405)).toBe(true);
    const limited = responses[120];
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get('retry-after')).toBe('60');
    expect(await limited?.json()).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'Too many requests from this IP; retry in 60 s.' },
    });
  });

  it('allows 121 requests carrying a well-formed key', async () => {
    const { app } = createTestApp();

    const responses = await sendMany(121, () =>
      app.fetch(httpRequest('/mcp', { headers: { authorization: `Bearer ${USER_KEY}` } }), { clientIp: CLIENT_IP }),
    );

    expect(responses.some((response) => response.status === 429)).toBe(false);
  });

  it('keeps separate budgets per address', async () => {
    const { app } = createTestApp();
    await sendMany(120, () => app.fetch(httpRequest('/mcp'), { clientIp: CLIENT_IP }));

    const other = await app.fetch(httpRequest('/mcp'), { clientIp: '198.51.100.7' });

    expect(other.status).toBe(405);
  });

  it('does not count discovery routes', async () => {
    const { app } = createTestApp();
    await sendMany(121, () => app.fetch(httpRequest('/mcp/server-card'), { clientIp: CLIENT_IP }));

    const response = await app.fetch(httpRequest('/mcp'), { clientIp: CLIENT_IP });

    expect(response.status).toBe(405);
  });
});

describe('configuration headers', () => {
  it.each([
    ['X-MnogoReels-Read-Only', 'maybe', 'true, false'],
    ['X-MnogoReels-Max-Credits-Per-Call', '0', 'a positive integer'],
    [
      'X-MnogoReels-Toolsets',
      'clips,videos',
      'a comma list of clips, transcripts, articles, library, thumbnails (or all)',
    ],
  ])('rejects an invalid %s with 400 before the MCP handler', async (header, value, allowed) => {
    const { app } = createTestApp();

    const response = await app.fetch(mcpPost('/mcp', jsonRpc('tools/list'), { [header]: value }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_header', header, allowed });
  });
});
