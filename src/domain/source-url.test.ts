import { describe, expect, it } from 'vitest';
import { detectPlatform, parseSourceUrl } from './source-url.js';

describe('parseSourceUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://vkvideo.ru/video-1_2',
    'https://rutube.ru/video/abc/',
    'https://dzen.ru/video/watch/abc',
    'https://www.twitch.tv/videos/123',
    'https://disk.yandex.ru/i/abc',
    'https://drive.google.com/file/d/abc/view',
    'http://example.com/video.mp4',
  ])('accepts %s', (raw) => {
    const result = parseSourceUrl(raw);
    expect(result).toEqual({ kind: 'ok', href: new URL(raw).href, host: new URL(raw).hostname });
  });

  it('trims surrounding whitespace', () => {
    expect(parseSourceUrl('  https://youtu.be/x  ')).toEqual({
      kind: 'ok',
      href: 'https://youtu.be/x',
      host: 'youtu.be',
    });
  });

  it.each([
    ['not a url', 'not-a-url'],
    ['ftp scheme', 'ftp://example.com/video.mp4'],
    ['file scheme', 'file:///etc/passwd'],
    ['userinfo', 'https://user:pass@example.com/video.mp4'],
    ['username only', 'https://user@example.com/video.mp4'],
    ['localhost', 'http://localhost:8080/video.mp4'],
    ['sub.localhost', 'http://app.localhost/video.mp4'],
    ['private 10/8', 'http://10.0.0.1/video.mp4'],
    ['private 172.16/12', 'http://172.16.5.4/v.mp4'],
    ['private 172.31', 'http://172.31.255.255/v.mp4'],
    ['private 192.168/16', 'http://192.168.1.1/v.mp4'],
    ['loopback', 'http://127.0.0.1/v.mp4'],
    ['loopback hex form', 'http://0x7f.1/v.mp4'],
    ['link-local', 'http://169.254.169.254/latest/meta-data'],
    ['zero network', 'http://0.0.0.0/v.mp4'],
    ['ipv6 loopback', 'http://[::1]/v.mp4'],
    ['ipv6 unspecified', 'http://[::]/v.mp4'],
    ['ipv6 unique local', 'http://[fd12:3456::1]/v.mp4'],
    ['ipv6 link-local', 'http://[fe80::1]/v.mp4'],
    ['ipv4-mapped ipv6 loopback', 'http://[::ffff:127.0.0.1]/v.mp4'],
    ['too long', `https://example.com/${'a'.repeat(2084)}`],
  ])('rejects %s', (_label, raw) => {
    const result = parseSourceUrl(raw);
    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.message).toContain('https://www.youtube.com/watch?v=');
  });

  it.each(['http://172.15.0.1/v.mp4', 'http://172.32.0.1/v.mp4', 'http://8.8.8.8/v.mp4', 'http://[2001:db8::1]/v.mp4'])(
    'accepts public IP literal %s',
    (raw) => {
      expect(parseSourceUrl(raw).kind).toBe('ok');
    },
  );

  it.each([
    ['not-a-url', 'source_url is not a valid URL.'],
    ['ftp://example.com/v.mp4', 'source_url must start with http:// or https://.'],
    ['https://u:p@example.com/v.mp4', 'source_url must not contain a user name or password.'],
    ['http://10.0.0.1/v.mp4', 'source_url points to a local or private network address.'],
    [`https://example.com/${'a'.repeat(2084)}`, 'source_url is longer than 2083 characters.'],
  ])('explains why %s is rejected', (raw, problem) => {
    expect(parseSourceUrl(raw)).toEqual({
      kind: 'invalid',
      message: `${problem} Pass a public http(s) link to a video page or file, e.g. https://www.youtube.com/watch?v=…`,
    });
  });

  it('measures the length after trimming', () => {
    const raw = `https://example.com/${'a'.repeat(2083 - 'https://example.com/'.length)}`;
    expect(parseSourceUrl(`  ${raw}  `).kind).toBe('ok');
  });

  it('accepts a URL of exactly 2083 characters', () => {
    const raw = `https://example.com/${'a'.repeat(2083 - 'https://example.com/'.length)}`;
    expect(raw).toHaveLength(2083);
    expect(parseSourceUrl(raw).kind).toBe('ok');
  });
});

describe('detectPlatform', () => {
  it.each([
    ['https://www.youtube.com/watch?v=x', 'youtube'],
    ['https://youtube.com/shorts/x', 'youtube'],
    ['https://m.youtube.com/watch?v=x', 'youtube'],
    ['https://youtu.be/x', 'youtube'],
    ['https://notyoutube.com/x', 'other'],
    ['https://disk.yandex.ru/i/abc', 'yandex_disk'],
    ['https://disk.yandex.com/d/abc', 'yandex_disk'],
    ['https://disk.360.yandex.ru/i/abc', 'yandex_disk'],
    ['https://yadi.sk/i/abc', 'yandex_disk'],
    ['https://drive.google.com/file/d/abc/view', 'google_drive'],
    ['https://drive.google.com/open?id=abc', 'google_drive'],
    ['https://docs.google.com/uc?export=download&id=abc', 'google_drive'],
    ['https://drive.google.com/drive/folders/abc', 'other'],
    ['https://example.com/watch?id=5', 'other'],
    ['https://example.com/file/d/abc/view', 'other'],
    ['https://rutube.ru/video/abc/', 'rutube'],
    ['https://dzen.ru/video/watch/abc', 'dzen'],
    ['https://zen.yandex.ru/video/watch/abc', 'dzen'],
    ['https://vk.com/video-1_2', 'vk'],
    ['https://m.vk.com/video-1_2', 'vk'],
    ['https://vkvideo.ru/video-1_2', 'vk'],
    ['https://www.twitch.tv/videos/1', 'twitch'],
    ['https://clips.twitch.tv/abc', 'twitch'],
    ['https://example.com/a/video.MP4', 'direct_file'],
    ['https://example.com/a/video.mov?x=1', 'direct_file'],
    ...['avi', 'mkv', 'webm', 'm4v', 'ts', 'mts', 'm2ts'].map((ext) => [
      `https://cdn.example.com/v.${ext}`,
      'direct_file',
    ]),
    ['https://example.com/page.html', 'other'],
    ['https://example.com/mp4', 'other'],
  ])('%s → %s', (raw, platform) => {
    expect(detectPlatform(raw)).toBe(platform);
  });
});
