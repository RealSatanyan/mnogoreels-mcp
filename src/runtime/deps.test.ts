import { describe, expect, it } from 'vitest';
import { createCaptureLogger } from '../../test/support/capture-logger.js';
import { createFakeClock } from '../../test/support/clock.js';
import type { SourceProbe } from '../domain/source-url.js';
import { createDeps, systemClock } from './deps.js';

const aProbe = (): SourceProbe => ({
  platform: 'youtube',
  downloadable: true,
  reason: null,
  durationSec: 60,
  title: 't',
  thumbnailUrl: null,
  checkedWith: 'downloads',
});

describe('createDeps', () => {
  it('keeps probes for 10 minutes', () => {
    const clock = createFakeClock();
    const deps = createDeps({ clock, logger: createCaptureLogger().logger });
    deps.probeCache.set('t|u', aProbe());
    clock.advance(599_999);
    expect(deps.probeCache.get('t|u')).toEqual(aProbe());
    clock.advance(1);
    expect(deps.probeCache.get('t|u')).toBeUndefined();
  });

  it('holds at most 500 probes', () => {
    const deps = createDeps({ clock: createFakeClock(), logger: createCaptureLogger().logger });
    Array.from({ length: 501 }, (_unused, index) => index).forEach((index) => {
      deps.probeCache.set(`k${String(index)}`, aProbe());
    });
    expect(deps.probeCache.size()).toBe(500);
  });

  it('remembers submissions for 10 minutes and forgets definite rejections', async () => {
    const clock = createFakeClock();
    const deps = createDeps({ clock, logger: createCaptureLogger().logger });
    await deps.dedupe.run('k', () => Promise.resolve({ jobId: 'a', status: 'queued', credits: 1 }));
    clock.advance(599_999);
    expect(deps.dedupe.peek('k')?.kind).toBe('success');
    clock.advance(1);
    expect(deps.dedupe.peek('k')).toBeUndefined();
    const rejection = Object.assign(new Error('402'), { failure: { kind: 'http', status: 402 } });
    await expect(deps.dedupe.run('r', () => Promise.reject(rejection))).rejects.toBe(rejection);
    expect(deps.dedupe.peek('r')).toBeUndefined();
  });

  it('holds at most 1000 dedupe entries', async () => {
    const deps = createDeps({ clock: createFakeClock(), logger: createCaptureLogger().logger });
    await Promise.all(
      Array.from({ length: 1001 }, (_unused, index) =>
        deps.dedupe.run(`k${String(index)}`, () =>
          Promise.resolve({ jobId: String(index), status: 'queued', credits: 1 }),
        ),
      ),
    );
    expect(deps.dedupe.peek('k0')).toBeUndefined();
    expect(deps.dedupe.peek('k1')?.kind).toBe('success');
  });

  it('builds a rate limiter on the same clock', () => {
    const deps = createDeps({ clock: createFakeClock(), logger: createCaptureLogger().logger });
    expect(deps.limiter.hit('a', { limit: 1, windowSec: 60 })).toEqual({ allowed: true });
    expect(deps.limiter.hit('a', { limit: 1, windowSec: 60 })).toEqual({ allowed: false, retryAfterSec: 60 });
  });

  it('logs without error messages unless debug is on', () => {
    const writes: string[] = [];
    const original = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      writes.push(String(chunk));
      return true;
    };
    try {
      createDeps().logger.errorOf('internal_error', new Error('quiet detail'));
      createDeps({ debug: true }).logger.errorOf('internal_error', new Error('loud detail'));
    } finally {
      process.stderr.write = original;
    }
    expect(writes.join('')).not.toContain('quiet detail');
    expect(writes.join('')).toContain('loud detail');
  });

  it('defaults to global fetch, the system clock and a stderr logger', () => {
    const deps = createDeps();
    expect(deps.fetch).toBe(globalThis.fetch);
    expect(deps.clock).toBe(systemClock);
    expect(typeof deps.logger.errorOf).toBe('function');
  });
});

describe('systemClock', () => {
  it('tells the time', () => {
    const before = Date.now();
    expect(systemClock.now()).toBeGreaterThanOrEqual(before);
  });

  it('sleeps', async () => {
    const started = Date.now();
    await systemClock.sleep(20, new AbortController().signal);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });

  it('rejects with AbortError when aborted, also before starting', async () => {
    const controller = new AbortController();
    const sleeping = systemClock.sleep(60_000, controller.signal);
    controller.abort();
    await expect(sleeping).rejects.toMatchObject({ name: 'AbortError' });
    await expect(systemClock.sleep(10, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
