import { setTimeout as delay } from 'node:timers/promises';
import type { SourceProbe } from '../domain/source-url.js';
import { createDedupeGuard, isDefiniteApiRejection, type DedupeGuard } from '../policy/dedupe.js';
import { createRateLimiter, type RateLimiter } from '../policy/rate-limit.js';
import { createLogger, type Logger } from './logger.js';
import { createTtlCache, type TtlCache } from './ttl-cache.js';

export type Clock = {
  readonly now: () => number;
  readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
};

export type SubmittedJob = { readonly jobId: string; readonly status: string; readonly credits: number };

export type Deps = {
  readonly fetch: typeof globalThis.fetch;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly probeCache: TtlCache<string, SourceProbe>;
  readonly dedupe: DedupeGuard<SubmittedJob>;
  readonly limiter: RateLimiter;
};

const PROBE_TTL_MS = 600_000;
const PROBE_MAX_ENTRIES = 500;
const DEDUPE_TTL_MS = 600_000;
const DEDUPE_MAX_ENTRIES = 1000;
const LIMITER_MAX_KEYS = 20_000;
const LIMITER_SWEEP_MS = 60_000;

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) => delay(ms, undefined, { signal, ref: false }),
};

export const createDeps = (
  options: {
    readonly fetch?: typeof globalThis.fetch;
    readonly clock?: Clock;
    readonly logger?: Logger;
    readonly debug?: boolean;
  } = {},
): Deps => {
  const clock = options.clock ?? systemClock;
  const limiter = createRateLimiter({ maxKeys: LIMITER_MAX_KEYS, clock });
  setInterval(limiter.sweep, LIMITER_SWEEP_MS).unref();
  return {
    fetch: options.fetch ?? globalThis.fetch,
    clock,
    logger: options.logger ?? createLogger({ debug: options.debug ?? false }),
    probeCache: createTtlCache({ ttlMs: PROBE_TTL_MS, maxEntries: PROBE_MAX_ENTRIES, clock }),
    dedupe: createDedupeGuard({
      ttlMs: DEDUPE_TTL_MS,
      maxEntries: DEDUPE_MAX_ENTRIES,
      clock,
      isDefiniteRejection: isDefiniteApiRejection,
    }),
    limiter,
  };
};
