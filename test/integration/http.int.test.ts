import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { describe, expect, it, onTestFinished } from 'vitest';
import { loadProcessConfig, resolveEffectiveConfig } from '../../src/config.js';
import { selectTools } from '../../src/server/toolsets.js';
import { VERSION } from '../../src/version.js';

const CLI = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const FAKE_KEY = 'mrfrt_usr_IntegrationOnly0123456789';

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });

const expectedToolNames = (path: string): readonly string[] => {
  const loaded = loadProcessConfig({ env: {}, forceHttp: true });
  if (!loaded.ok) throw new Error(loaded.error);
  return selectTools(resolveEffectiveConfig({ process: loaded.config, path })).map((tool) => tool.name);
};

const collect = (stream: NodeJS.ReadableStream | null): (() => string) => {
  const chunks: string[] = [];
  stream?.on('data', (chunk: Buffer) => {
    chunks.push(chunk.toString('utf8'));
  });
  return () => chunks.join('');
};

const waitUntilHealthy = async (baseUrl: string, deadline: number): Promise<void> => {
  const healthy = await fetch(`${baseUrl}/healthz`).then(
    (response) => response.ok,
    () => false,
  );
  if (healthy) return;
  if (Date.now() > deadline) throw new Error('server did not become healthy');
  await new Promise((resolve) => setTimeout(resolve, 50));
  return waitUntilHealthy(baseUrl, deadline);
};

const startServer = async (env: Readonly<Record<string, string>> = {}) => {
  const port = await freePort();
  const child = spawn(process.execPath, [CLI, '--http'], {
    env: {
      PATH: process.env['PATH'] ?? '',
      MNOGOREELS_API_URL: 'http://127.0.0.1:9',
      MNOGOREELS_PORT: String(port),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  onTestFinished(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  const stdout = collect(child.stdout);
  const stderr = collect(child.stderr);
  const baseUrl = `http://127.0.0.1:${String(port)}`;
  await waitUntilHealthy(baseUrl, Date.now() + 10_000);
  return { child, port, baseUrl, stdout, stderr };
};

const connect = async (url: string, era: 'modern' | 'legacy'): Promise<Client> => {
  const client = new Client(
    { name: 'http-integration', version: '1.0.0' },
    era === 'modern' ? { versionNegotiation: { mode: { pin: '2026-07-28' } } } : {},
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  onTestFinished(() => client.close());
  return client;
};

describe.each(['modern', 'legacy'] as const)('HTTP server with a %s client', (era) => {
  it('answers get_options_guide on /mcp', async () => {
    const { baseUrl } = await startServer();
    const client = await connect(`${baseUrl}/mcp`, era);

    const result = await client.callTool({ name: 'get_options_guide', arguments: { topic: 'pricing' } });

    expect(result.isError).not.toBe(true);
  });

  it.each([
    ['/mcp', 19],
    ['/mcp/readonly', 13],
    ['/mcp/directory', 17],
  ])('lists the profile tools on %s (%i)', async (path, count) => {
    const { baseUrl } = await startServer();
    const client = await connect(`${baseUrl}${path}`, era);

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(expectedToolNames(path));
    expect(tools).toHaveLength(count);
  });
});

describe('HTTP process', () => {
  it('serves health and the server card without a key', async () => {
    const { baseUrl } = await startServer();

    const health = await fetch(`${baseUrl}/healthz`);
    const card = await fetch(`${baseUrl}/.well-known/mcp/server-card.json`);

    expect(await health.json()).toEqual({ status: 'ok', version: VERSION });
    expect(await card.json()).toMatchObject({ name: 'ru.mnogo-reels/mnogoreels' });
  });

  it('logs the startup line to stderr and keeps stdout empty', async () => {
    const { port, stdout, stderr } = await startServer();

    const startup = stderr()
      .split('\n')
      .find((line) => line.includes('"event":"startup"'));
    expect(JSON.parse(startup ?? '{}')).toMatchObject({
      transport: 'http',
      version: VERSION,
      host: '127.0.0.1',
      port,
      profile: 'default',
      allowed_hosts: 'localhost,127.0.0.1,[::1]',
    });
    expect(stdout()).toBe('');
  });

  it('warns that MNOGOREELS_API_KEY is ignored without printing it', async () => {
    const { stderr } = await startServer({ MNOGOREELS_API_KEY: FAKE_KEY });

    expect(stderr()).toContain('MNOGOREELS_API_KEY is ignored in HTTP mode');
    expect(stderr()).not.toContain('IntegrationOnly');
  });

  it('exits 0 within 12 s on SIGTERM', async () => {
    const { child } = await startServer();
    const startedAt = Date.now();
    const exited = new Promise<number | null>((resolve) => {
      child.once('exit', resolve);
    });

    child.kill('SIGTERM');

    expect(await exited).toBe(0);
    expect(Date.now() - startedAt).toBeLessThan(12_000);
  });

  it('fails with exit code 1 when the port is taken', async () => {
    const { port } = await startServer();
    const second = spawn(process.execPath, [CLI, '--http'], {
      env: { PATH: process.env['PATH'] ?? '', MNOGOREELS_PORT: String(port) },
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const code = await new Promise<number | null>((resolve) => {
      second.once('exit', resolve);
    });

    expect(code).toBe(1);
  });
});
