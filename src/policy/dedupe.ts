import { z } from 'zod';
import type { Clock } from '../runtime/deps.js';
import { createTtlCache } from '../runtime/ttl-cache.js';

const FailureCarrierSchema = z.object({
  failure: z.object({ kind: z.string(), status: z.number().optional(), detail: z.string().nullish() }),
});

export type FailureLike = z.output<typeof FailureCarrierSchema>['failure'];

export const failureOf = (error: unknown): FailureLike | undefined =>
  FailureCarrierSchema.safeParse(error).data?.failure;

const DEFINITE_STATUSES = new Set([400, 401, 402, 403, 404, 409, 422]);
const BILLING_NOT_CONFIGURED = 'billing is not configured';

export const isDefiniteApiRejection = (error: unknown): boolean => {
  const failure = failureOf(error);
  if (failure?.kind !== 'http' || failure.status === undefined) return false;
  return (
    DEFINITE_STATUSES.has(failure.status) ||
    (failure.status === 503 && failure.detail?.toLowerCase().includes(BILLING_NOT_CONFIGURED) === true)
  );
};

export type DedupeOutcome<T> = { readonly kind: 'success'; readonly value: T } | { readonly kind: 'unknown' };

export type DedupeGuard<T> = {
  readonly peek: (key: string) => DedupeOutcome<T> | undefined;
  readonly run: (
    key: string,
    submit: () => Promise<T>,
  ) => Promise<{ readonly value: T; readonly deduplicated: boolean }>;
  readonly drain: (timeoutMs: number) => Promise<void>;
};

type Settled<T> =
  { readonly kind: 'success'; readonly value: T } | { readonly kind: 'unknown'; readonly error: unknown };

export const createDedupeGuard = <T>(options: {
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly clock: Clock;
  readonly isDefiniteRejection: (error: unknown) => boolean;
}): DedupeGuard<T> => {
  const settled = createTtlCache<string, Settled<T>>({
    ttlMs: options.ttlMs,
    maxEntries: options.maxEntries,
    clock: options.clock,
  });
  const inFlight = new Map<string, Promise<T>>();

  const submitOnce = async (key: string, submit: () => Promise<T>): Promise<T> => {
    try {
      const value = await submit();
      settled.set(key, { kind: 'success', value });
      return value;
    } catch (error) {
      if (!options.isDefiniteRejection(error)) settled.set(key, { kind: 'unknown', error });
      throw error;
    } finally {
      inFlight.delete(key);
    }
  };

  const run = async (key: string, submit: () => Promise<T>) => {
    const pending = inFlight.get(key);
    if (pending) return { value: await pending, deduplicated: true };
    const previous = settled.get(key);
    if (previous?.kind === 'success') return { value: previous.value, deduplicated: true };
    if (previous?.kind === 'unknown') throw previous.error;
    const submission = submitOnce(key, submit);
    inFlight.set(key, submission);
    return { value: await submission, deduplicated: false };
  };

  const peek = (key: string): DedupeOutcome<T> | undefined => {
    const outcome = settled.get(key);
    return outcome?.kind === 'unknown' ? { kind: 'unknown' } : outcome;
  };

  const drain = async (timeoutMs: number): Promise<void> => {
    const timer = new AbortController();
    const timeout = options.clock.sleep(timeoutMs, timer.signal).catch(() => undefined);
    await Promise.race([Promise.allSettled([...inFlight.values()]), timeout]);
    timer.abort();
  };

  return { peek, run, drain };
};
