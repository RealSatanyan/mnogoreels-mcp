import { isIP } from 'node:net';
import type { Clock } from '../runtime/deps.js';

export type RateRule = { readonly limit: number; readonly windowSec: number };
export type RateDecision = { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSec: number };

export type RateLimiter = {
  readonly hit: (key: string, rule: RateRule) => RateDecision;
  readonly release: (key: string) => void;
  readonly sweep: () => void;
  readonly size: () => number;
};

type Window = { readonly count: number; readonly resetAt: number };

export const createRateLimiter = (options: { readonly maxKeys: number; readonly clock: Clock }): RateLimiter => {
  const windows = new Map<string, Window>();

  const evictOldest = (): void => {
    const oldest = windows.keys().next();
    if (!oldest.done) windows.delete(oldest.value);
  };

  const hit = (key: string, rule: RateRule): RateDecision => {
    const now = options.clock.now();
    const current = windows.get(key);
    if (current !== undefined && current.resetAt > now) {
      if (current.count >= rule.limit) {
        return { allowed: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) };
      }
      windows.set(key, { count: current.count + 1, resetAt: current.resetAt });
      return { allowed: true };
    }
    windows.delete(key);
    if (windows.size >= options.maxKeys) evictOldest();
    windows.set(key, { count: 1, resetAt: now + rule.windowSec * 1000 });
    return { allowed: true };
  };

  const release = (key: string): void => {
    const current = windows.get(key);
    if (current === undefined || current.count === 0) return;
    windows.set(key, { count: current.count - 1, resetAt: current.resetAt });
  };

  const sweep = (): void => {
    const now = options.clock.now();
    [...windows].filter(([, window]) => window.resetAt <= now).forEach(([key]) => windows.delete(key));
  };

  return { hit, release, sweep, size: () => windows.size };
};

const MAPPED_V4_RE = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

const groupsOf = (part: string): string[] => (part === '' ? [] : part.split(':'));

const ipv6Groups = (address: string): string[] => {
  const [head = '', tail] = address.split('%')[0]?.split('::') ?? [];
  const headGroups = groupsOf(head);
  const tailGroups = tail === undefined ? [] : groupsOf(tail);
  const zeros: string[] = Array.from({ length: 8 - headGroups.length - tailGroups.length }, () => '0');
  return [...headGroups, ...zeros, ...tailGroups].map((group) => group.toLowerCase().replace(/^0+(?=.)/, ''));
};

const normalize = (ip: string): { readonly family: 4 | 6 | 0; readonly address: string } => {
  const mapped = MAPPED_V4_RE.exec(ip)?.[1];
  if (mapped !== undefined) return { family: 4, address: mapped };
  const family = isIP(ip);
  return { family: family === 4 || family === 6 ? family : 0, address: ip };
};

export const ipBucketKey = (ip: string): string => {
  const { family, address } = normalize(ip);
  if (family !== 6) return address;
  return `${ipv6Groups(address).slice(0, 4).join(':')}::/64`;
};

export const ipLogPrefix = (ip: string): string => {
  const { family, address } = normalize(ip);
  if (family === 4) return `${address.split('.').slice(0, 3).join('.')}.0/24`;
  if (family === 6) return `${ipv6Groups(address).slice(0, 3).join(':')}::/48`;
  return 'unknown';
};
