import { failureOf } from '../policy/dedupe.js';
import type { Clock } from './deps.js';

const FOLLOW_UP_RESERVE_MS = 8_000;
const BUDGET_FAILURES = new Set(['deadline', 'timeout']);

export type ProgressUpdate = { readonly elapsedSec: number; readonly totalSec: number; readonly message: string };

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const pollUntil = async <T>(options: {
  readonly load: (signal: AbortSignal) => Promise<T>;
  readonly isTerminal: (value: T) => boolean;
  readonly describe: (value: T) => string;
  readonly waitSec: number;
  readonly intervalMs: number;
  readonly clock: Clock;
  readonly signal: AbortSignal;
  readonly toolDeadline: number;
  readonly onProgress: (update: ProgressUpdate) => Promise<void>;
}): Promise<{ readonly value: T; readonly waitedSec: number }> => {
  const { clock } = options;
  const start = clock.now();
  const waitUntil = Math.min(start + options.waitSec * 1000, options.toolDeadline - FOLLOW_UP_RESERVE_MS);
  const elapsedSec = (): number => round1((clock.now() - start) / 1000);

  const loadOrKeep = async (
    previous: { readonly value: T } | undefined,
  ): Promise<{ readonly value: T; readonly final: boolean }> => {
    try {
      return { value: await options.load(options.signal), final: false };
    } catch (error) {
      if (previous && BUDGET_FAILURES.has(String(failureOf(error)?.kind)))
        return { value: previous.value, final: true };
      throw error;
    }
  };

  const step = async (
    previous: { readonly value: T } | undefined,
  ): Promise<{ readonly value: T; readonly waitedSec: number }> => {
    const { value, final } = await loadOrKeep(previous);
    const done = final || options.isTerminal(value) || clock.now() + options.intervalMs > waitUntil;
    if (done) return { value, waitedSec: elapsedSec() };
    await options.onProgress({ elapsedSec: elapsedSec(), totalSec: options.waitSec, message: options.describe(value) });
    await clock.sleep(options.intervalMs, options.signal);
    return step({ value });
  };

  return step(undefined);
};
