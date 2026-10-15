import { describe, expect, it } from 'vitest';
import { extractApiKey } from './auth.js';

const USER_KEY = 'mrfrt_usr_AbCdEf0123456789XyZ';
const SERVICE_KEY = 'mrfrt_svc_AbCdEf0123456789XyZ';

const headersWith = (entries: Readonly<Record<string, string>>): Headers => new Headers(entries);

describe('extractApiKey', () => {
  it('finds no key when neither header is sent', () => {
    expect(extractApiKey(headersWith({}))).toEqual({ kind: 'none' });
  });

  it('takes a well-formed user key from a Bearer authorization header in any case', () => {
    expect(extractApiKey(headersWith({ authorization: `bearer   ${USER_KEY}` }))).toEqual({
      kind: 'key',
      key: USER_KEY,
    });
  });

  it('takes the key from X-API-Key, trimmed, when Authorization is absent', () => {
    expect(extractApiKey(headersWith({ 'x-api-key': `  ${USER_KEY} ` }))).toEqual({ kind: 'key', key: USER_KEY });
  });

  it('prefers Authorization over X-API-Key', () => {
    const other = 'mrfrt_usr_ZzZzZzZz0123456789AbC';
    expect(extractApiKey(headersWith({ authorization: `Bearer ${USER_KEY}`, 'x-api-key': other }))).toEqual({
      kind: 'key',
      key: USER_KEY,
    });
  });

  it('falls back to X-API-Key when Authorization is not a Bearer credential', () => {
    expect(extractApiKey(headersWith({ authorization: 'Basic dXNlcjpwYXNz', 'x-api-key': USER_KEY }))).toEqual({
      kind: 'key',
      key: USER_KEY,
    });
  });

  it('ignores a non-Bearer Authorization header without X-API-Key', () => {
    expect(extractApiKey(headersWith({ authorization: 'Basic dXNlcjpwYXNz' }))).toEqual({ kind: 'none' });
  });

  it('treats an empty X-API-Key as no key', () => {
    expect(extractApiKey(headersWith({ 'x-api-key': '   ' }))).toEqual({ kind: 'none' });
  });

  it('rejects a service key in either header as an invalid format', () => {
    expect(extractApiKey(headersWith({ authorization: `Bearer ${SERVICE_KEY}` }))).toEqual({ kind: 'invalid_format' });
    expect(extractApiKey(headersWith({ 'x-api-key': SERVICE_KEY }))).toEqual({ kind: 'invalid_format' });
  });

  it('rejects keys that do not look like MnogoReels user keys', () => {
    expect(extractApiKey(headersWith({ authorization: 'Bearer sk-not-ours' }))).toEqual({ kind: 'invalid_format' });
    expect(extractApiKey(headersWith({ 'x-api-key': 'mrfrt_usr_short' }))).toEqual({ kind: 'invalid_format' });
  });
});
