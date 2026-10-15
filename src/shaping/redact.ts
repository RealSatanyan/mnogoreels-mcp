import { createHash } from 'node:crypto';

const KEY_RE = /mrfrt_(usr|svc)_[A-Za-z0-9]+/g;
const KEY_PREFIX_RE = /^mrfrt_(usr|svc)_/;
const MIN_MASKABLE_LENGTH = 12;

export const redactSecrets = (text: string): string =>
  text.replace(KEY_RE, (match, kind: string) => `mrfrt_${kind}_…${match.slice(-4)}`);

export const maskKey = (key: string): string =>
  `${KEY_PREFIX_RE.exec(key)?.[0] ?? ''}…${key.length >= MIN_MASKABLE_LENGTH ? key.slice(-4) : ''}`;

export const hashKey = (key: string): string => createHash('sha256').update(key).digest('hex');

export const logKey = (key: string): string => hashKey(key).slice(0, 8);

const USER_KEY_RE = /^mrfrt_usr_[A-Za-z0-9]{16,256}$/;

export const isWellFormedUserKey = (key: string): boolean => USER_KEY_RE.test(key);
