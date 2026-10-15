import { isWellFormedUserKey } from '../../shaping/redact.js';

export type ApiKeyExtraction =
  { readonly kind: 'none' } | { readonly kind: 'invalid_format' } | { readonly kind: 'key'; readonly key: string };

const BEARER_RE = /^Bearer\s+(\S+)$/i;

const candidateOf = (headers: Headers): string | undefined => {
  const bearer = BEARER_RE.exec(headers.get('authorization') ?? '')?.[1];
  if (bearer !== undefined) return bearer;
  const apiKey = headers.get('x-api-key') ?? '';
  return apiKey === '' ? undefined : apiKey;
};

export const extractApiKey = (headers: Headers): ApiKeyExtraction => {
  const candidate = candidateOf(headers);
  if (candidate === undefined) return { kind: 'none' };
  return isWellFormedUserKey(candidate) ? { kind: 'key', key: candidate } : { kind: 'invalid_format' };
};
