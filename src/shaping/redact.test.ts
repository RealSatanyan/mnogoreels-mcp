import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashKey, isWellFormedUserKey, logKey, maskKey, redactSecrets } from './redact.js';

const aUserKey = (body = 'AbCdEfGh12345678wxyz') => `mrfrt_usr_${body}`;
const aServiceKey = (body = 'ZyXwVuTs98765432abcd') => `mrfrt_svc_${body}`;

describe('redactSecrets', () => {
  it('replaces user and service keys anywhere in text, keeping prefix and last 4 characters', () => {
    const text = `auth ${aUserKey()} and (${aServiceKey()}) end`;
    expect(redactSecrets(text)).toBe('auth mrfrt_usr_…wxyz and (mrfrt_svc_…abcd) end');
  });

  it('leaves text without keys unchanged', () => {
    expect(redactSecrets('nothing secret here mrfrt_ only')).toBe('nothing secret here mrfrt_ only');
  });

  it('redacts every occurrence', () => {
    expect(redactSecrets(`${aUserKey()} ${aUserKey('0000000000000000qqqq')}`)).toBe('mrfrt_usr_…wxyz mrfrt_usr_…qqqq');
  });
});

describe('maskKey', () => {
  it('keeps the prefix and only the last 4 characters', () => {
    expect(maskKey(aUserKey())).toBe('mrfrt_usr_…wxyz');
  });

  it('keeps the service prefix for service keys', () => {
    expect(maskKey(aServiceKey())).toBe('mrfrt_svc_…abcd');
  });

  it('shows no prefix for foreign strings', () => {
    expect(maskKey('sk-abcdefghijklmnop')).toBe('…mnop');
  });

  it('shows nothing of very short strings', () => {
    expect(maskKey('abcdefghijk')).toBe('…');
    expect(maskKey('abcdefghijkl')).toBe('…ijkl');
  });
});

describe('hashKey and logKey', () => {
  it('hashKey is the full SHA-256 hex of the key', () => {
    const key = aUserKey();
    expect(hashKey(key)).toBe(createHash('sha256').update(key).digest('hex'));
    expect(hashKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('logKey is the first 8 hex characters of the hash', () => {
    const key = aUserKey();
    expect(logKey(key)).toBe(hashKey(key).slice(0, 8));
  });

  it('different keys get different tenant hashes', () => {
    expect(hashKey(aUserKey())).not.toBe(hashKey(aUserKey('AbCdEfGh12345678wxyZ')));
  });
});

describe('isWellFormedUserKey', () => {
  it.each([
    ['mrfrt_usr_' + 'a'.repeat(16), true],
    ['mrfrt_usr_' + 'A1'.repeat(128), true],
    ['mrfrt_usr_' + 'a'.repeat(15), false],
    ['mrfrt_usr_' + 'a'.repeat(257), false],
    ['mrfrt_svc_' + 'a'.repeat(20), false],
    ['mrfrt_usr_' + 'a'.repeat(15) + '-', false],
    [' mrfrt_usr_' + 'a'.repeat(16), false],
  ])('%s → %s', (key, expected) => {
    expect(isWellFormedUserKey(key)).toBe(expected);
  });
});
