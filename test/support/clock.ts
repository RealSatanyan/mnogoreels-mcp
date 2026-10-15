import type { Clock } from '../../src/runtime/deps.js';

export type FakeClock = Clock & {
  readonly advance: (ms: number) => void;
  readonly pendingSleeps: () => number;
};

type Sleeper = { readonly wakeAt: number; readonly resolve: () => void };

const abortError = (): Error => new DOMException('The operation was aborted.', 'AbortError');

export const createFakeClock = (
  options: { readonly start?: number; readonly autoAdvance?: boolean } = {},
): FakeClock => {
  const state = { now: options.start ?? 1_700_000_000_000, sleepers: new Set<Sleeper>() };

  const advance = (ms: number): void => {
    state.now += ms;
    [...state.sleepers]
      .filter((sleeper) => sleeper.wakeAt <= state.now)
      .forEach((sleeper) => {
        state.sleepers.delete(sleeper);
        sleeper.resolve();
      });
  };

  const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      if (options.autoAdvance) {
        state.now += ms;
        resolve();
        return;
      }
      const sleeper: Sleeper = { wakeAt: state.now + ms, resolve };
      state.sleepers.add(sleeper);
      signal.addEventListener(
        'abort',
        () => {
          state.sleepers.delete(sleeper);
          reject(abortError());
        },
        { once: true },
      );
    });

  return { now: () => state.now, sleep, advance, pendingSleeps: () => state.sleepers.size };
};
