import { describe, expect, it } from 'vitest';
import { isMnogoReelsMedia, mediaLink, rewriteLegacyMediaUrl, safeHttpUrl, toHttps } from './media-urls.js';

const R2 = 'https://pub-d86608a8848d48d885d3865737f7f771.r2.dev';
const STREAM = 'https://mnogo-reels.ru/api/video/stream?url=';

describe('toHttps', () => {
  it('upgrades http links', () => {
    expect(toHttps('http://api.mnogo-reels.ru/x.mp4')).toBe('https://api.mnogo-reels.ru/x.mp4');
    expect(toHttps('HTTP://example.com/a')).toBe('https://example.com/a');
  });

  it('only upgrades the scheme at the start', () => {
    expect(toHttps('https://example.com/?u=http://x')).toBe('https://example.com/?u=http://x');
  });

  it('keeps https links', () => {
    expect(toHttps('https://example.com/a')).toBe('https://example.com/a');
  });
});

describe('rewriteLegacyMediaUrl', () => {
  it.each([
    ['https://d1abc.cloudfront.net/smart-reels/job/clip_1.mp4', `${R2}/smart-reels/job/clip_1.mp4`],
    ['http://d1abc.cloudfront.net/smart-reels/job/clip_1.mp4?Expires=1', `${R2}/smart-reels/job/clip_1.mp4`],
    ['https://mnogo-shorts.s3.eu-central-1.amazonaws.com/smart-reels/a/b.jpg', `${R2}/smart-reels/a/b.jpg`],
    ['https://mnogo-shorts.s3-eu-central-1.amazonaws.com/smart-reels/a/b.jpg', `${R2}/smart-reels/a/b.jpg`],
    ['https://mnogo-shorts.s3.amazonaws.com/smart-reels/a/b.jpg', `${R2}/smart-reels/a/b.jpg`],
    ['https://s3.amazonaws.com/mnogo-shorts/smart-reels/a/b.jpg', `${R2}/smart-reels/a/b.jpg`],
  ])('rewrites %s', (legacy, rewritten) => {
    expect(rewriteLegacyMediaUrl(legacy)).toBe(rewritten);
  });

  it.each([
    'https://d1abc.cloudfront.net/other/clip.mp4',
    'https://s3.amazonaws.com/other-bucket/smart-reels/a.jpg',
    'https://other.s3.eu-central-1.amazonaws.com/smart-reels/a.jpg',
    'https://example.com/smart-reels/a.jpg',
    'https://example.com/mnogo-shorts/smart-reels/a.jpg',
    `${R2}/smart-reels/job/clip_1.mp4`,
    'not a url',
  ])('leaves %s unchanged', (url) => {
    expect(rewriteLegacyMediaUrl(url)).toBe(url);
  });

  it('is idempotent', () => {
    const once = rewriteLegacyMediaUrl('https://d1abc.cloudfront.net/smart-reels/x.mp4');
    expect(rewriteLegacyMediaUrl(once)).toBe(once);
  });
});

describe('isMnogoReelsMedia', () => {
  it('recognises the public r2.dev bucket only', () => {
    expect(isMnogoReelsMedia(`${R2}/smart-reels/x.mp4`)).toBe(true);
    expect(isMnogoReelsMedia('https://bucket.account.r2.cloudflarestorage.com/x.mp4?X-Amz=1')).toBe(false);
    expect(isMnogoReelsMedia('https://example.com/x.r2.dev')).toBe(false);
    expect(isMnogoReelsMedia('garbage')).toBe(false);
  });
});

describe('mediaLink', () => {
  it('emits only the direct https url in direct mode', () => {
    expect(mediaLink('http://d1abc.cloudfront.net/smart-reels/x.mp4', 'direct')).toEqual({
      url: `${R2}/smart-reels/x.mp4`,
    });
  });

  it('adds stream_url through the website proxy in both mode for MnogoReels media', () => {
    const url = `${R2}/smart-reels/job/clip_1.mp4?v=2&x=3`;
    expect(mediaLink(url, 'both')).toEqual({
      url,
      stream_url: `${STREAM}${encodeURIComponent(url)}`,
    });
  });

  it('never adds stream_url for presigned storage or third-party links', () => {
    expect(mediaLink('https://bucket.acc.r2.cloudflarestorage.com/x.mp4?sig=1', 'both')).toEqual({
      url: 'https://bucket.acc.r2.cloudflarestorage.com/x.mp4?sig=1',
    });
    expect(mediaLink('https://example.com/x.mp4', 'both')).toEqual({ url: 'https://example.com/x.mp4' });
  });
});

describe('safeHttpUrl', () => {
  it.each(['javascript:alert(1)', 'data:text/html,hi', '/relative/path', 'not a url', 'ftp://example.com/x', ''])(
    'nulls %j',
    (url) => {
      expect(safeHttpUrl(url)).toBeNull();
    },
  );

  it.each([null, undefined])('nulls %j', (url) => {
    expect(safeHttpUrl(url)).toBeNull();
  });

  it('keeps third-party http(s) links as they are', () => {
    expect(safeHttpUrl('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
    expect(safeHttpUrl('https://example.com/a')).toBe('https://example.com/a');
  });

  it('upgrades and rewrites MnogoReels media', () => {
    expect(safeHttpUrl(`http://pub-d86608a8848d48d885d3865737f7f771.r2.dev/smart-reels/x.jpg`)).toBe(
      `${R2}/smart-reels/x.jpg`,
    );
    expect(safeHttpUrl('http://d1.cloudfront.net/smart-reels/x.jpg')).toBe(`${R2}/smart-reels/x.jpg`);
  });
});
