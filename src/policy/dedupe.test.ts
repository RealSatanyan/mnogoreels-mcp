import { describe, expect, it, vi } from 'vitest';
import { createFakeClock } from '../../test/support/clock.js';
import { createDedupeGuard, failureOf, isDefiniteApiRejection } from './dedupe.js';

type Job = { readonly jobId: string };

const httpFailure = (status: number, detail?: string) =>
  Object.assign(new Error(`http ${String(status)}`), {
    failure: { kind: 'http', status, detail, retryAfterSec: undefined, htmlLike: false },
  });
const timeoutFailure = () => Object.assign(new Error('timeout'), { failure: { kind: 'timeout' } });

const aGuard = (options: { maxEntries?: number } = {}) => {
  const clock = createFakeClock();
  const guard = createDedupeGuard<Job>({
    ttlMs: 600_000,
    maxEntries: options.maxEntries ?? 10,
    clock,
    isDefiniteRejection: isDefiniteApiRejection,
  });
  return { guard, clock };
};

const deferred = <T>() => {
  const handlers: { resolve: (value: T) => void; reject: (error: unknown) => void } = {
    resolve: () => undefined,
    reject: () => undefined,
  };
  const promise = new Promise<T>((resolve, reject) => {
    handlers.resolve = resolve;
    handlers.reject = reject;
  });
  return { promise, ...handlers };
};

describe('createDedupeGuard', () => {
  it('submits once and replays a success within the TTL', async () => {
    const { guard } = aGuard();
    const submit = vi.fn(() => Promise.resolve({ jobId: 'a' }));
    await expect(guard.run('k', submit)).resolves.toEqual({ value: { jobId: 'a' }, deduplicated: false });
    await expect(guard.run('k', submit)).resolves.toEqual({ value: { jobId: 'a' }, deduplicated: true });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(guard.peek('k')).toEqual({ kind: 'success', value: { jobId: 'a' } });
  });

  it('forgets a success after the TTL', async () => {
    const { guard, clock } = aGuard();
    const submit = vi.fn(() => Promise.resolve({ jobId: 'a' }));
    await guard.run('k', submit);
    clock.advance(600_000);
    expect(guard.peek('k')).toBeUndefined();
    await expect(guard.run('k', submit)).resolves.toMatchObject({ deduplicated: false });
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('single-flights concurrent identical submissions', async () => {
    const { guard } = aGuard();
    const pending = deferred<Job>();
    const submit = vi.fn(() => pending.promise);
    const first = guard.run('k', submit);
    const second = guard.run('k', submit);
    pending.resolve({ jobId: 'one' });
    await expect(first).resolves.toEqual({ value: { jobId: 'one' }, deduplicated: false });
    await expect(second).resolves.toEqual({ value: { jobId: 'one' }, deduplicated: true });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 402, 403, 404, 409, 422])('does not remember a definite %i rejection', async (status) => {
    const { guard } = aGuard();
    const submit = vi
      .fn<() => Promise<Job>>()
      .mockRejectedValueOnce(httpFailure(status))
      .mockResolvedValueOnce({ jobId: 'b' });
    await expect(guard.run('k', submit)).rejects.toThrow(`http ${String(status)}`);
    expect(guard.peek('k')).toBeUndefined();
    await expect(guard.run('k', submit)).resolves.toEqual({ value: { jobId: 'b' }, deduplicated: false });
  });

  it('treats "Billing is not configured" only on 503 as a definite rejection', async () => {
    const { guard } = aGuard();
    await expect(guard.run('k', () => Promise.reject(httpFailure(500, 'Billing is not configured')))).rejects.toThrow();
    expect(guard.peek('k')).toEqual({ kind: 'unknown' });
  });

  it('treats "Billing is not configured" as a definite rejection', async () => {
    const { guard } = aGuard();
    await expect(guard.run('k', () => Promise.reject(httpFailure(503, 'Billing is not configured')))).rejects.toThrow();
    expect(guard.peek('k')).toBeUndefined();
  });

  it.each([
    ['500', () => httpFailure(500)],
    ['503 billing unavailable', () => httpFailure(503, 'Billing service unavailable')],
    ['timeout', timeoutFailure],
    ['unexpected error', () => new Error('socket hang up')],
  ])('remembers an unknown outcome (%s) and replays the same failure without submitting', async (_label, makeError) => {
    const { guard } = aGuard();
    const error = makeError();
    const submit = vi.fn<() => Promise<Job>>().mockRejectedValue(error);
    await expect(guard.run('k', submit)).rejects.toBe(error);
    expect(guard.peek('k')).toEqual({ kind: 'unknown' });
    await expect(guard.run('k', submit)).rejects.toBe(error);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('isolates keys', async () => {
    const { guard } = aGuard();
    await guard.run('a', () => Promise.resolve({ jobId: 'a' }));
    await expect(guard.run('b', () => Promise.resolve({ jobId: 'b' }))).resolves.toEqual({
      value: { jobId: 'b' },
      deduplicated: false,
    });
  });

  it('evicts the oldest settled outcome when full', async () => {
    const { guard } = aGuard({ maxEntries: 2 });
    await guard.run('a', () => Promise.resolve({ jobId: 'a' }));
    await guard.run('b', () => Promise.resolve({ jobId: 'b' }));
    await guard.run('c', () => Promise.resolve({ jobId: 'c' }));
    expect([guard.peek('a'), guard.peek('b')?.kind, guard.peek('c')?.kind]).toEqual([undefined, 'success', 'success']);
  });

  it('drain waits for in-flight submissions', async () => {
    const { guard } = aGuard();
    const pending = deferred<Job>();
    const run = guard.run('k', () => pending.promise);
    const state = { drained: false };
    const drain = guard.drain(35_000).then(() => {
      state.drained = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(state.drained).toBe(false);
    pending.resolve({ jobId: 'k' });
    await drain;
    await run;
    expect(state.drained).toBe(true);
  });

  it('drain stops its timer once in-flight work settles', async () => {
    const { guard, clock } = aGuard();
    await guard.drain(35_000);
    const pending = deferred<Job>();
    const run = guard.run('k', () => pending.promise);
    const drain = guard.drain(35_000);
    pending.resolve({ jobId: 'k' });
    await drain;
    await run;
    expect(clock.pendingSleeps()).toBe(0);
  });

  it('drain gives up after the timeout', async () => {
    const { guard, clock } = aGuard();
    void guard.run('k', () => new Promise<Job>(() => undefined));
    const drain = guard.drain(35_000);
    clock.advance(35_000);
    await expect(drain).resolves.toBeUndefined();
  });

  it('drain resolves immediately when idle', async () => {
    await expect(aGuard().guard.drain(1)).resolves.toBeUndefined();
  });
});

describe('failureOf', () => {
  it('reads the failure carried by an API error', () => {
    expect(failureOf(httpFailure(402))).toMatchObject({ kind: 'http', status: 402 });
    expect(failureOf(new Error('plain'))).toBeUndefined();
    expect(failureOf(undefined)).toBeUndefined();
  });
});
