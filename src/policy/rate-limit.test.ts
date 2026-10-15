import { describe, expect, it } from 'vitest';
import { createFakeClock } from '../../test/support/clock.js';
import { createRateLimiter, ipBucketKey, ipLogPrefix } from './rate-limit.js';

const aLimiter = (maxKeys = 100) => {
  const clock = createFakeClock();
  return { limiter: createRateLimiter({ maxKeys, clock }), clock };
};

const PER_MINUTE = { limit: 3, windowSec: 60 };

describe('createRateLimiter', () => {
  it('allows up to the limit within a window, then reports seconds until reset', () => {
    const { limiter, clock } = aLimiter();
    expect([1, 2, 3].map(() => limiter.hit('k:all', PER_MINUTE))).toEqual([
      { allowed: true },
      { allowed: true },
      { allowed: true },
    ]);
    clock.advance(20_500);
    expect(limiter.hit('k:all', PER_MINUTE)).toEqual({ allowed: false, retryAfterSec: 40 });
  });

  it('opens a new window when the old one ends', () => {
    const { limiter, clock } = aLimiter();
    [1, 2, 3].forEach(() => limiter.hit('k:all', PER_MINUTE));
    clock.advance(60_000);
    expect(limiter.hit('k:all', PER_MINUTE)).toEqual({ allowed: true });
  });

  it('release gives back one hit of the current window', () => {
    const { limiter, clock } = aLimiter();
    [1, 2, 3].forEach(() => limiter.hit('k:paid', PER_MINUTE));
    limiter.release('k:paid');
    clock.advance(30_000);
    expect(limiter.hit('k:paid', PER_MINUTE)).toEqual({ allowed: true });
    expect(limiter.hit('k:paid', PER_MINUTE)).toEqual({ allowed: false, retryAfterSec: 30 });
  });

  it('release ignores unknown keys', () => {
    const { limiter } = aLimiter();
    limiter.release('unknown');
    expect(limiter.size()).toBe(0);
  });

  it('a release after the window ended does not carry into the next window', () => {
    const { limiter, clock } = aLimiter();
    [1, 2, 3].forEach(() => limiter.hit('k:paid', PER_MINUTE));
    clock.advance(60_000);
    limiter.release('k:paid');
    [1, 2, 3].forEach(() => limiter.hit('k:paid', PER_MINUTE));
    expect(limiter.hit('k:paid', PER_MINUTE).allowed).toBe(false);
  });

  it('release never goes below an empty window', () => {
    const { limiter } = aLimiter();
    limiter.hit('k:paid', PER_MINUTE);
    limiter.release('k:paid');
    limiter.release('k:paid');
    [1, 2, 3].forEach(() => limiter.hit('k:paid', PER_MINUTE));
    expect(limiter.hit('k:paid', PER_MINUTE).allowed).toBe(false);
  });

  it('keeps keys independent', () => {
    const { limiter } = aLimiter();
    [1, 2, 3].forEach(() => limiter.hit('a:all', PER_MINUTE));
    expect(limiter.hit('b:all', PER_MINUTE)).toEqual({ allowed: true });
    expect(limiter.hit('a:all', PER_MINUTE).allowed).toBe(false);
  });

  it('two keys sharing an 8-hex log prefix never share a bucket (full hash tenants)', () => {
    const { limiter } = aLimiter();
    const first = `abcdef01${'0'.repeat(56)}`;
    const second = `abcdef01${'1'.repeat(56)}`;
    [1, 2, 3].forEach(() => limiter.hit(`${first}:paid`, PER_MINUTE));
    expect(limiter.hit(`${second}:paid`, PER_MINUTE)).toEqual({ allowed: true });
  });

  it('holds at most maxKeys windows, evicting the oldest', () => {
    const { limiter } = aLimiter(2);
    [1, 2, 3].forEach(() => limiter.hit('a', PER_MINUTE));
    limiter.hit('b', PER_MINUTE);
    limiter.hit('c', PER_MINUTE);
    expect(limiter.size()).toBe(2);
    expect(limiter.hit('a', PER_MINUTE)).toEqual({ allowed: true });
  });

  it('sweep drops expired windows and keeps live ones', () => {
    const { limiter, clock } = aLimiter();
    const hourly = { limit: 3, windowSec: 3600 };
    limiter.hit('a', PER_MINUTE);
    limiter.hit('b', hourly);
    clock.advance(60_000);
    limiter.sweep();
    expect(limiter.size()).toBe(1);
    expect([limiter.hit('b', hourly), limiter.hit('b', hourly), limiter.hit('b', hourly)]).toEqual([
      { allowed: true },
      { allowed: true },
      { allowed: false, retryAfterSec: 3540 },
    ]);
  });

  it('renewing an expired window in a full limiter keeps the other windows', () => {
    const { limiter, clock } = aLimiter(2);
    const once = { limit: 1, windowSec: 60 };
    const hourly = { limit: 1, windowSec: 3600 };
    limiter.hit('b', hourly);
    clock.advance(1_000);
    limiter.hit('a', once);
    clock.advance(60_000);
    limiter.hit('a', once);
    expect(limiter.hit('b', hourly).allowed).toBe(false);
  });

  it('rotating fake keys cannot escape an IP bucket for key-optional tools', () => {
    const { limiter } = aLimiter();
    const ipBucket = `ip:${ipBucketKey('2001:db8:1:2:aaaa::1')}:probe`;
    [1, 2, 3].forEach(() => limiter.hit(ipBucket, PER_MINUTE));
    const rotated = `ip:${ipBucketKey('2001:db8:1:2:bbbb::9')}:probe`;
    expect(limiter.hit(rotated, PER_MINUTE).allowed).toBe(false);
  });
});

describe('ipBucketKey', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64'],
    ['2001:0DB8:0001:0002::1', '2001:db8:1:2::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['::1:2:3:4:5:6', '0:0:1:2::/64'],
    ['1::2:3:4:5:6', '1:0:0:2::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['not-an-ip', 'not-an-ip'],
  ])('%s → %s', (ip, bucket) => {
    expect(ipBucketKey(ip)).toBe(bucket);
  });
});

describe('ipLogPrefix', () => {
  it.each([
    ['203.0.113.7', '203.0.113.0/24'],
    ['::ffff:203.0.113.7', '203.0.113.0/24'],
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1::/48'],
    ['::1', '0:0:0::/48'],
    ['garbage', 'unknown'],
  ])('%s → %s', (ip, prefix) => {
    expect(ipLogPrefix(ip)).toBe(prefix);
  });
});
