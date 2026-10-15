import { describe, expect, it, vi } from 'vitest';
import { createFakeClock, type FakeClock } from '../../test/support/clock.js';
import { pollUntil } from './poll.js';

type Snapshot = { readonly status: string; readonly n: number };

const budgetFailure = (kind: 'deadline' | 'timeout') => Object.assign(new Error(kind), { failure: { kind } });

const aPoll = (options: {
  readonly snapshots: readonly (Snapshot | Error)[];
  readonly waitSec?: number;
  readonly intervalMs?: number;
  readonly toolDeadlineInMs?: number;
  readonly loadMs?: number;
  readonly clock?: FakeClock;
  readonly signal?: AbortSignal;
}) => {
  const clock = options.clock ?? createFakeClock({ autoAdvance: true });
  const start = clock.now();
  const progress: { elapsedSec: number; totalSec: number; message: string }[] = [];
  const loads = { count: 0 };
  const run = pollUntil<Snapshot>({
    load: () => {
      const item = options.snapshots[Math.min(loads.count, options.snapshots.length - 1)];
      loads.count += 1;
      clock.advance(options.loadMs ?? 0);
      return item instanceof Error ? Promise.reject(item) : Promise.resolve(item ?? { status: 'x', n: -1 });
    },
    isTerminal: (value) => value.status === 'completed' || value.status === 'failed',
    describe: (value) => `${value.status} ${String(value.n)}`,
    waitSec: options.waitSec ?? 30,
    intervalMs: options.intervalMs ?? 10_000,
    clock,
    signal: options.signal ?? new AbortController().signal,
    toolDeadline: start + (options.toolDeadlineInMs ?? 52_000),
    onProgress: (update) => {
      progress.push(update);
      return Promise.resolve();
    },
  });
  return { run, progress, loads, clock };
};

describe('pollUntil', () => {
  it('waitSec 0 loads exactly once and returns the snapshot', async () => {
    const poll = aPoll({ snapshots: [{ status: 'processing', n: 1 }], waitSec: 0 });
    await expect(poll.run).resolves.toEqual({ value: { status: 'processing', n: 1 }, waitedSec: 0 });
    expect(poll.loads.count).toBe(1);
    expect(poll.progress).toEqual([]);
  });

  it('returns as soon as the value is terminal', async () => {
    const poll = aPoll({
      snapshots: [
        { status: 'queued', n: 1 },
        { status: 'processing', n: 2 },
        { status: 'completed', n: 3 },
      ],
    });
    await expect(poll.run).resolves.toEqual({ value: { status: 'completed', n: 3 }, waitedSec: 20 });
    expect(poll.loads.count).toBe(3);
  });

  it('reports strictly increasing progress with the described value', async () => {
    const poll = aPoll({ snapshots: [{ status: 'processing', n: 1 }], waitSec: 50, intervalMs: 5_000, loadMs: 300 });
    await poll.run;
    expect(poll.progress.length).toBeGreaterThan(2);
    expect(poll.progress[0]).toEqual({ elapsedSec: 0.3, totalSec: 50, message: 'processing 1' });
    poll.progress.slice(1).forEach((update, index) => {
      expect(update.elapsedSec).toBeGreaterThan(poll.progress[index]?.elapsedSec ?? Infinity);
    });
  });

  it('stops before waitSec runs out', async () => {
    const poll = aPoll({ snapshots: [{ status: 'processing', n: 1 }], waitSec: 30, intervalMs: 10_000 });
    const result = await poll.run;
    expect(result.waitedSec).toBe(30);
    expect(poll.loads.count).toBe(4);
  });

  it('keeps 8 seconds of the tool budget in reserve', async () => {
    const poll = aPoll({
      snapshots: [{ status: 'processing', n: 1 }],
      waitSec: 50,
      intervalMs: 10_000,
      toolDeadlineInMs: 30_000,
    });
    const result = await poll.run;
    expect(result.waitedSec).toBe(20);
  });

  it('a slow last load that hits the budget returns the previous snapshot', async () => {
    const poll = aPoll({
      snapshots: [{ status: 'processing', n: 1 }, { status: 'processing', n: 2 }, budgetFailure('deadline')],
      waitSec: 50,
    });
    await expect(poll.run).resolves.toEqual({ value: { status: 'processing', n: 2 }, waitedSec: 20 });
    expect(poll.loads.count).toBe(3);
  });

  it('a timeout after a successful load also returns the previous snapshot', async () => {
    const poll = aPoll({ snapshots: [{ status: 'queued', n: 1 }, budgetFailure('timeout')], waitSec: 50 });
    await expect(poll.run).resolves.toMatchObject({ value: { status: 'queued', n: 1 } });
  });

  it('rethrows a failure of the first load', async () => {
    const poll = aPoll({ snapshots: [budgetFailure('timeout')] });
    await expect(poll.run).rejects.toThrow('timeout');
  });

  it('rethrows other failures', async () => {
    const poll = aPoll({ snapshots: [{ status: 'queued', n: 1 }, new Error('boom')] });
    await expect(poll.run).rejects.toThrow('boom');
  });

  it('client abort during sleep rejects', async () => {
    const clock = createFakeClock();
    const controller = new AbortController();
    const poll = aPoll({ snapshots: [{ status: 'processing', n: 1 }], clock, signal: controller.signal });
    await vi.waitFor(() => {
      expect(clock.pendingSleeps()).toBe(1);
    });
    controller.abort();
    await expect(poll.run).rejects.toMatchObject({ name: 'AbortError' });
  });
});
