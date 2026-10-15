import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it, onTestFinished } from 'vitest';
import { loadProcessConfig, resolveEffectiveConfig } from '../../src/config.js';
import { selectTools } from '../../src/server/toolsets.js';
import { VERSION } from '../../src/version.js';

const CLI = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const OFFLINE_API = 'http://127.0.0.1:9';

const cliEnv = (extra: Readonly<Record<string, string>> = {}): Record<string, string> => ({
  PATH: process.env['PATH'] ?? '',
  MNOGOREELS_API_URL: OFFLINE_API,
  ...extra,
});

const expectedToolNames = (): readonly string[] => {
  const loaded = loadProcessConfig({ env: {} });
  if (!loaded.ok) throw new Error(loaded.error);
  return selectTools(resolveEffectiveConfig({ process: loaded.config })).map((tool) => tool.name);
};

const runCli = (args: readonly string[], env: Readonly<Record<string, string>> = {}) =>
  spawnSync(process.execPath, [CLI, ...args], { env: cliEnv(env), encoding: 'utf8', timeout: 10_000, input: '' });

const connect = async (mode: 'legacy' | 'auto'): Promise<Client> => {
  const client = new Client(
    { name: 'stdio-integration', version: '1.0.0' },
    mode === 'auto' ? { versionNegotiation: { mode: 'auto' } } : {},
  );
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [CLI], env: cliEnv(), stderr: 'pipe' }),
  );
  onTestFinished(() => client.close());
  return client;
};

const exitOf = (child: ReturnType<typeof spawn>): Promise<{ readonly code: number | null; readonly ms: number }> => {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    child.once('exit', (code) => {
      resolve({ code, ms: Date.now() - startedAt });
    });
  });
};

const spawnServer = (env: Readonly<Record<string, string>> = {}) => {
  const child = spawn(process.execPath, [CLI], { env: cliEnv(env), stdio: ['pipe', 'pipe', 'pipe'] });
  onTestFinished(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  return child;
};

const collect = (stream: NodeJS.ReadableStream | null): (() => string) => {
  const chunks: string[] = [];
  stream?.on('data', (chunk: Buffer) => {
    chunks.push(chunk.toString('utf8'));
  });
  return () => chunks.join('');
};

const jsonRpcVersionOf = (line: string): unknown => {
  const parsed: unknown = JSON.parse(line);
  return typeof parsed === 'object' && parsed !== null && 'jsonrpc' in parsed ? parsed.jsonrpc : undefined;
};

const waitFor = async (condition: () => boolean, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  const poll = async (): Promise<void> => {
    if (condition() || Date.now() > deadline) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return poll();
  };
  await poll();
};

describe.each(['legacy', 'auto'] as const)('stdio server with a %s client and no key', (mode) => {
  it('lists every enabled tool in registration order', async () => {
    const client = await connect(mode);

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(expectedToolNames());
    expect(tools).toHaveLength(19);
  });

  it('answers get_options_guide', async () => {
    const client = await connect(mode);

    const result = await client.callTool({ name: 'get_options_guide', arguments: { topic: 'pricing' } });

    expect(result.isError).not.toBe(true);
  });

  it('reports get_account as not authenticated', async () => {
    const client = await connect(mode);

    const result = await client.callTool({ name: 'get_account', arguments: {} });

    expect(result.structuredContent).toMatchObject({ authenticated: false, key_configured: false });
  });
});

describe('stdio process', () => {
  it('writes nothing but JSON-RPC to stdout and exits within 2 s when stdin closes', async () => {
    const child = spawnServer();
    const stdout = collect(child.stdout);
    const exited = exitOf(child);
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'raw', version: '1.0.0' } } })}\n`,
    );
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
    await waitFor(() => stdout().includes('"id":2'), 10_000);

    child.stdin.end();
    const { code, ms } = await exited;

    const lines = stdout()
      .split('\n')
      .filter((line) => line !== '');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.map(jsonRpcVersionOf)).toEqual(lines.map(() => '2.0'));
    expect(code).toBe(0);
    expect(ms).toBeLessThan(2_000);
  });

  it('writes the startup line to stderr', async () => {
    const child = spawnServer();
    const stderr = collect(child.stderr);
    await waitFor(() => stderr().includes('startup'), 10_000);

    const startup = stderr()
      .split('\n')
      .find((line) => line.includes('"event":"startup"'));
    expect(JSON.parse(startup ?? '{}')).toMatchObject({ level: 'info', transport: 'stdio', version: VERSION });
  });

  it('exits 0 on SIGTERM', async () => {
    const child = spawnServer();
    const stderr = collect(child.stderr);
    await waitFor(() => stderr().includes('startup'), 10_000);
    const exited = exitOf(child);

    child.kill('SIGTERM');

    expect((await exited).code).toBe(0);
  });
});

describe('command line', () => {
  it('prints the version and exits 0', () => {
    const result = runCli(['--version']);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${VERSION}\n`);
  });

  it('prints usage and the environment variables with --help', () => {
    const result = runCli(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: mnogoreels-mcp [--http] [--help] [--version]');
    expect(result.stdout).toContain('MNOGOREELS_API_KEY');
    expect(result.stdout).toContain('MNOGOREELS_TRUSTED_PROXIES');
  });

  it('rejects an unknown argument with usage on stderr and exit code 2', () => {
    const result = runCli(['--stdio']);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Usage: mnogoreels-mcp');
  });

  it('rejects invalid configuration with the variable name and exit code 2', () => {
    const result = runCli([], { MNOGOREELS_PROFILE: 'everything' });

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('MNOGOREELS_PROFILE');
  });
});
