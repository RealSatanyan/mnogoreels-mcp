import { describe, expect, it } from 'vitest';
import { resolveEffectiveConfig } from '../../config.js';
import { buildServerCard } from '../../server/card.js';
import { VERSION } from '../../version.js';
import { createTestApp, httpRequest } from './fixtures.js';

const CARD_PATHS = ['/.well-known/mcp/server-card.json', '/mcp/server-card'] as const;

const SEP_2127_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET',
  'access-control-allow-headers': 'Content-Type, If-None-Match',
  'access-control-expose-headers': 'ETag',
};

const corsOf = (response: Response) =>
  Object.fromEntries(Object.keys(SEP_2127_CORS).map((name) => [name, response.headers.get(name)]));

describe('remote discovery routes', () => {
  it('answers /healthz with the version without calling the backend, whatever the Host', async () => {
    const { app, api } = createTestApp();

    const response = await app.fetch(httpRequest('/healthz', { headers: { host: 'evil.example' } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', version: VERSION });
    expect(api.requests()).toHaveLength(0);
  });

  it('redirects the root to the README', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest('/'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://github.com/RealSatanyan/mnogoreels-mcp#readme');
  });

  it.each(['/nope', '/.well-known/oauth-protected-resource', '/mcp/other'])('answers %s with 404', async (path) => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest(path));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('serves the same server card bytes on both card paths', async () => {
    const { app } = createTestApp({ env: { MNOGOREELS_PUBLIC_URL: 'https://mcp.example.test/mcp' } });

    const [first, second] = await Promise.all(CARD_PATHS.map((path) => app.fetch(httpRequest(path))));

    const firstText = await first?.text();
    expect(first?.status).toBe(200);
    expect(second?.status).toBe(200);
    expect(await second?.text()).toBe(firstText);
    expect(first?.headers.get('etag')).toBe(second?.headers.get('etag'));
  });

  it('serves the card built from the default profile with the public URL', async () => {
    const { app, processConfig } = createTestApp({ env: { MNOGOREELS_PUBLIC_URL: 'https://mcp.example.test/mcp' } });

    const response = await app.fetch(httpRequest('/.well-known/mcp/server-card.json'));

    const expected = buildServerCard({
      config: resolveEffectiveConfig({ process: processConfig, path: '/mcp' }),
      publicUrl: 'https://mcp.example.test/mcp',
    });
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  it.each(CARD_PATHS)('sends card headers and the SEP-2127 CORS set on %s', async (path) => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest(path));

    expect(response.headers.get('content-type')).toBe('application/mcp-server-card+json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(response.headers.get('etag')).toMatch(/^"sha256-[A-Za-z0-9_-]{43}"$/);
    expect(corsOf(response)).toEqual(SEP_2127_CORS);
  });

  it('derives the ETag from the SHA-256 of the body', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest('/mcp/server-card'));

    const digest = Buffer.from(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(await response.clone().text())),
    ).toString('base64url');
    expect(response.headers.get('etag')).toBe(`"sha256-${digest}"`);
  });

  it('answers a matching If-None-Match with 304 and no body', async () => {
    const { app } = createTestApp();
    const etag = (await app.fetch(httpRequest('/mcp/server-card'))).headers.get('etag') ?? '';

    const response = await app.fetch(httpRequest('/mcp/server-card', { headers: { 'if-none-match': `"x", ${etag}` } }));

    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
    expect(response.headers.get('etag')).toBe(etag);
    expect(corsOf(response)).toEqual(SEP_2127_CORS);
  });

  it('answers a stale If-None-Match with the full card', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest('/mcp/server-card', { headers: { 'if-none-match': '"stale"' } }));

    expect(response.status).toBe(200);
  });

  it('answers a card preflight with the SEP-2127 CORS set', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(
      httpRequest('/.well-known/mcp/server-card.json', {
        method: 'OPTIONS',
        headers: { origin: 'https://inspector.example', 'access-control-request-method': 'GET' },
      }),
    );

    expect(response.status).toBe(204);
    expect(corsOf(response)).toEqual(SEP_2127_CORS);
  });

  it('serves glama.json for connector attribution with open CORS', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest('/.well-known/glama.json'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(await response.json()).toEqual({
      $schema: 'https://glama.ai/mcp/schemas/server.json',
      maintainers: ['RealSatanyan'],
    });
  });

  it('applies the Host check to the card', async () => {
    const { app } = createTestApp();

    const response = await app.fetch(httpRequest('/mcp/server-card', { headers: { host: 'evil.example' } }));

    expect(response.status).toBe(403);
  });
});
