import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { clientIpOf, type ProcessConfig } from '../../config.js';
import type { Deps } from '../../runtime/deps.js';
import type { HttpApp } from './app.js';
import { MAX_BODY_BYTES } from './guards.js';

export type HttpServerHandle = {
  readonly port: number;
  readonly close: () => Promise<void>;
};

const PAID_DRAIN_MS = 35_000;
const IN_FLIGHT_GRACE_MS = 10_000;
const IDLE_POLL_MS = 50;

export const serveHttp = async (options: {
  readonly app: HttpApp;
  readonly processConfig: ProcessConfig;
  readonly deps: Deps;
}): Promise<HttpServerHandle> => {
  const { app, deps } = options;
  const { host, port, trustedProxies } = options.processConfig.http;
  const state = { inFlight: 0 };
  const onerror = (error: Error): void => {
    deps.logger.errorOf('node_handler_error', error);
  };

  const server = createServer((req, res) => {
    state.inFlight += 1;
    res.on('close', () => {
      state.inFlight -= 1;
    });
    const clientIp = clientIpOf({ remoteAddress: req.socket.remoteAddress, headers: req.headers, trustedProxies });
    void toNodeHandler(
      { fetch: (request) => app.fetch(request, clientIp === undefined ? {} : { clientIp }) },
      { maxRequestBodySize: MAX_BODY_BYTES, onerror },
    )(req, res);
  });
  server.keepAliveTimeout = 95_000;
  server.headersTimeout = 96_000;
  server.requestTimeout = 120_000;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const waitForIdle = async (deadline: number): Promise<void> => {
    if (state.inFlight === 0 || deps.clock.now() >= deadline) return;
    await deps.clock.sleep(IDLE_POLL_MS, new AbortController().signal);
    return waitForIdle(deadline);
  };

  const shutdown = async (): Promise<void> => {
    const stopped = new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    await deps.dedupe.drain(PAID_DRAIN_MS);
    await waitForIdle(deps.clock.now() + IN_FLIGHT_GRACE_MS);
    await app.close();
    server.closeAllConnections();
    await stopped;
  };

  const closing: { promise?: Promise<void> } = {};
  const address: AddressInfo | string | null = server.address();
  return {
    port: typeof address === 'object' && address !== null ? address.port : port,
    close: () => (closing.promise ??= shutdown()),
  };
};
