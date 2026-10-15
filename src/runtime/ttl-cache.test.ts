import { describe, expect, it } from 'vitest';
import { createFakeClock } from '../../test/support/clock.js';
import { createTtlCache } from './ttl-cache.js';

const aCache = (options: { ttlMs?: number; maxEntries?: number } = {}) => {
  const clock = createFakeClock();
  const cache = createTtlCache<string, number>({
    ttlMs: options.ttlMs ?? 1000,
    maxEntries: options.maxEntries ?? 3,
    clock,
  });
  return { cache, clock };
};

describe('createTtlCache', () => {
  it('returns stored values until they expire', () => {
    const { cache, clock } = aCache();
    cache.set('a', 1);
    clock.advance(999);
    expect(cache.get('a')).toBe(1);
    clock.advance(1);
    expect(cache.get('a')).toBeUndefined();
  });

  it('returns undefined for unknown keys', () => {
    expect(aCache().cache.get('missing')).toBeUndefined();
  });

  it('evicts the oldest entry when full', () => {
    const { cache } = aCache({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect([cache.get('a'), cache.get('b'), cache.get('c')]).toEqual([undefined, 2, 3]);
    expect(cache.size()).toBe(2);
  });

  it('overwriting a key refreshes its age and does not evict others', () => {
    const { cache, clock } = aCache({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    clock.advance(500);
    cache.set('a', 10);
    cache.set('c', 3);
    expect([cache.get('a'), cache.get('b'), cache.get('c')]).toEqual([10, undefined, 3]);
    clock.advance(600);
    expect(cache.get('a')).toBe(10);
  });

  it('drops an expired entry when it is read', () => {
    const { cache, clock } = aCache();
    cache.set('a', 1);
    clock.advance(1000);
    cache.get('a');
    expect(cache.size()).toBe(0);
  });

  it('overwriting a key in a full cache does not evict another key', () => {
    const { cache } = aCache({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('b', 3);
    expect([cache.get('a'), cache.get('b')]).toEqual([1, 3]);
  });

  it('deletes entries', () => {
    const { cache } = aCache();
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size()).toBe(0);
  });
});
