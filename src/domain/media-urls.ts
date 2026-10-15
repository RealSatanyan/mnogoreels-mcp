export type MediaUrlMode = 'direct' | 'both';

export type MediaLink = { readonly url: string; readonly stream_url?: string };

const R2_PUBLIC_BASE = 'https://pub-d86608a8848d48d885d3865737f7f771.r2.dev';
const STREAM_PROXY = 'https://mnogo-reels.ru/api/video/stream?url=';
const LEGACY_BUCKET = 'mnogo-shorts';
const LEGACY_BUCKET_HOST_RE = /^mnogo-shorts\.s3([.-][a-z0-9-]+)?\.amazonaws\.com$/;
const MEDIA_KEY_PREFIX = 'smart-reels/';

const tryParse = (value: string): URL | undefined => (URL.canParse(value) ? new URL(value) : undefined);

const legacyObjectKey = (url: URL): string | undefined => {
  const path = url.pathname.slice(1);
  if (url.hostname.endsWith('.cloudfront.net') || LEGACY_BUCKET_HOST_RE.test(url.hostname)) return path;
  if (url.hostname === 's3.amazonaws.com' && path.startsWith(`${LEGACY_BUCKET}/`)) {
    return path.slice(LEGACY_BUCKET.length + 1);
  }
  return undefined;
};

export const toHttps = (url: string): string => url.replace(/^http:\/\//i, 'https://');

export const rewriteLegacyMediaUrl = (url: string): string => {
  const parsed = tryParse(url);
  const key = parsed ? legacyObjectKey(parsed) : undefined;
  return key?.startsWith(MEDIA_KEY_PREFIX) ? `${R2_PUBLIC_BASE}/${key}` : url;
};

export const isMnogoReelsMedia = (url: string): boolean => tryParse(url)?.hostname.endsWith('.r2.dev') ?? false;

export const mediaLink = (url: string, mode: MediaUrlMode): MediaLink => {
  const direct = rewriteLegacyMediaUrl(toHttps(url));
  return mode === 'both' && isMnogoReelsMedia(direct)
    ? { url: direct, stream_url: `${STREAM_PROXY}${encodeURIComponent(direct)}` }
    : { url: direct };
};

export const safeHttpUrl = (url: string | null | undefined): string | null => {
  const parsed = url ? tryParse(url) : undefined;
  if (!url || (parsed?.protocol !== 'https:' && parsed?.protocol !== 'http:')) return null;
  const rewritten = rewriteLegacyMediaUrl(url);
  return isMnogoReelsMedia(rewritten) ? toHttps(rewritten) : url;
};
