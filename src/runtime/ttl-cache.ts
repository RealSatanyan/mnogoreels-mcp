import type { Clock } from './deps.js';

export type TtlCache<K, V> = {
  readonly get: (key: K) => V | undefined;
  readonly set: (key: K, value: V) => void;
  readonly delete: (key: K) => void;
  readonly size: () => number;
};

type Entry<V> = { readonly value: V; readonly expiresAt: number };

export const createTtlCache = <K, V>(options: {
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly clock: Clock;
}): TtlCache<K, V> => {
  const entries = new Map<K, Entry<V>>();

  const get = (key: K): V | undefined => {
    const entry = entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt > options.clock.now()) return entry.value;
    entries.delete(key);
    return undefined;
  };

  const set = (key: K, value: V): void => {
    entries.delete(key);
    const oldest = entries.size >= options.maxEntries ? entries.keys().next() : undefined;
    if (oldest && !oldest.done) entries.delete(oldest.value);
    entries.set(key, { value, expiresAt: options.clock.now() + options.ttlMs });
  };

  return { get, set, delete: (key) => entries.delete(key), size: () => entries.size };
};
