import { describe, expect, it, onTestFinished } from 'vitest';
import type { ProcessConfig } from '../../config.js';
import { createDeps, type Deps } from '../../runtime/deps.js';
import { createCaptureLogger, type CapturedLogs } from '../../../test/support/capture-logger.js';
import { createFakeApi } from '../../../test/support/fake-api.js';
import { createHttpApp, type HttpApp } from './app.js';
import { processConfigFor } from './fixtures.js';
import { serveHttp, type HttpServerHandle } from './node-server.js';

type Gate = { readonly promise: Promise<void>; readonly open: () => void };

const createGate = (): Gate => {
  const opener: { open?: () => void } = {};
  const promise = new Promise<void>((resolve) => {
    opener.open = resolve;
  });
  return { promise, open: () => opener.open?.() };
};

const localConfig = (env: Readonly<Record<string, string>> = {}): ProcessConfig => {
  const config = processConfigFor(env);
  return { ...config, http: { ...config.http, host: '127.0.0.1', port: 0 } };
};

const start = async (options: {
  readonly processConfig?: ProcessConfig;
  readonly app?: (deps: Deps, processConfig: ProcessConfig) => HttpApp;
}): Promise<{ readonly handle: HttpServerHandle; readonly deps: Deps; readonly logs: CapturedLogs }> => {
  const logs = createCaptureLogger();
  const deps = createDeps({ fetch: createFakeApi([]).fetch, logger: logs.logger });
  const processConfig = options.processConfig ?? localConfig();
  const app = options.app?.(deps, processConfig) ?? createHttpApp({ processConfig, deps });
  const handle = await serveHttp({ app, processConfig, deps });
  onTestFinished(() => handle.close());
  return { handle, deps, logs };
};

const settledFlag = (promise: Promise<unknown>): (() => boolean) => {
  const state = { settled: false };
  void promise.finally(() => {
    state.settled = true;
  });
  return () => state.settled;
};

const tick = (ms = 50): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('node HTTP server', () => {
  it('serves the app on the bound port', async () => {
    const { handle } = await start({});

    const response = await fetch(`http://127.0.0.1:${String(handle.port)}/healthz`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  it('uses the socket address as the client IP when no proxy is trusted', async () => {
    const { handle, logs } = await start({});

    await fetch(`http://127.0.0.1:${String(handle.port)}/.well-known/glama.json`, {
      headers: { 'x-forwarded-for': '198.51.100.20' },
    });

    const line = logs.entries().find((entry) => entry['event'] === 'http_request');
    expect(line?.['ip']).toBe('127.0.0.0/24');
  });

  it('takes the client IP from X-Forwarded-For when the peer is a trusted proxy', async () => {
    const { handle, logs } = await start({ processConfig: localConfig({ MNOGOREELS_TRUSTED_PROXIES: '127.0.0.0/8' }) });

    await fetch(`http://127.0.0.1:${String(handle.port)}/.well-known/glama.json`, {
      headers: { 'x-forwarded-for': '198.51.100.20' },
    });

    const line = logs.entries().find((entry) => entry['event'] === 'http_request');
    expect(line?.['ip']).toBe('198.51.100.0/24');
  });

  it('rejects a body over 1 MiB before it reaches the app', async () => {
    const { handle } = await start({});

    const response = await fetch(`http://127.0.0.1:${String(handle.port)}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: new ReadableStream({
        start: (controller) => {
          controller.enqueue(new TextEncoder().encode('x'.repeat(1_048_577)));
          controller.close();
        },
      }),
      duplex: 'half',
    });

    expect(response.status).toBe(413);
  });
});

describe('graceful shutdown', () => {
  it('waits for in-flight paid submissions to finish before closing', async () => {
    const { handle, deps } = await start({});
    const gate = createGate();
    const submission = deps.dedupe.run('paid-call', async () => {
      await gate.promise;
      return { jobId: 'job-1', status: 'queued', credits: 1 };
    });

    const closed = settledFlag(handle.close());
    await tick();
    expect(closed()).toBe(false);

    gate.open();
    await submission;
    await tick();
    expect(closed()).toBe(true);
  });

  it('lets in-flight requests finish before closing', async () => {
    const gate = createGate();
    const { handle } = await start({
      app: () => ({
        fetch: async () => {
          await gate.promise;
          return new Response('done');
        },
        close: () => Promise.resolve(),
      }),
    });
    const response = fetch(`http://127.0.0.1:${String(handle.port)}/slow`);
    await tick();

    const closed = settledFlag(handle.close());
    await tick();
    expect(closed()).toBe(false);

    gate.open();
    expect(await (await response).text()).toBe('done');
    await tick();
    expect(closed()).toBe(true);
  });

  it('stops accepting new connections once closing starts', async () => {
    const { handle } = await start({});
    const { port } = handle;

    await handle.close();

    await expect(fetch(`http://127.0.0.1:${String(port)}/healthz`)).rejects.toThrow();
  });
});
