import { BlockList, isIP } from 'node:net';

export type Platform =
  'youtube' | 'vk' | 'rutube' | 'dzen' | 'twitch' | 'yandex_disk' | 'google_drive' | 'direct_file' | 'other';

export type SourceProbe = {
  readonly platform: Platform;
  readonly downloadable: boolean;
  readonly reason: string | null;
  readonly durationSec: number | null;
  readonly title: string | null;
  readonly thumbnailUrl: string | null;
  readonly checkedWith: 'downloads' | 'yandex_disk' | 'google_drive';
};

export type ParsedSourceUrl =
  | { readonly kind: 'ok'; readonly href: string; readonly host: string }
  | { readonly kind: 'invalid'; readonly message: string };

const MAX_URL_LENGTH = 2083;
const EXAMPLE = 'https://www.youtube.com/watch?v=…';
const DIRECT_FILE_RE = /\.(mp4|mov|avi|mkv|webm|m4v|ts|mts|m2ts)$/i;
const YANDEX_DISK_RE = /^disk\.(360\.)?yandex\.[a-z]+$/;

const PRIVATE_RANGES: readonly (readonly [string, number, 'ipv4' | 'ipv6'])[] = [
  ['0.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['::', 128, 'ipv6'],
  ['::1', 128, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
];

const privateRanges = PRIVATE_RANGES.reduce((list, [network, prefix, family]) => {
  list.addSubnet(network, prefix, family);
  return list;
}, new BlockList());

const isPrivateAddress = (hostname: string): boolean => {
  const address = hostname.replace(/[[\]]/g, '');
  return privateRanges.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');
};

const isHost = (host: string, domain: string): boolean => host === domain || host.endsWith(`.${domain}`);

const invalid = (problem: string): ParsedSourceUrl => ({
  kind: 'invalid',
  message: `source_url ${problem}. Pass a public http(s) link to a video page or file, e.g. ${EXAMPLE}`,
});

const tryParse = (raw: string): URL | undefined => (URL.canParse(raw) ? new URL(raw) : undefined);

export const parseSourceUrl = (raw: string): ParsedSourceUrl => {
  const trimmed = raw.trim();
  if (trimmed.length > MAX_URL_LENGTH) return invalid(`is longer than ${String(MAX_URL_LENGTH)} characters`);
  const url = tryParse(trimmed);
  if (!url) return invalid('is not a valid URL');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return invalid('must start with http:// or https://');
  if (url.username || url.password) return invalid('must not contain a user name or password');
  if (isHost(url.hostname, 'localhost') || isPrivateAddress(url.hostname)) {
    return invalid('points to a local or private network address');
  }
  return { kind: 'ok', href: url.href, host: url.hostname };
};

const isGoogleDriveFile = (url: URL): boolean =>
  (url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com') &&
  (url.pathname.includes('/file/d/') || url.searchParams.has('id'));

export const detectPlatform = (href: string): Platform => {
  const url = new URL(href);
  const host = url.hostname;
  if (isHost(host, 'youtube.com') || host === 'youtu.be') return 'youtube';
  if (YANDEX_DISK_RE.test(host) || host === 'yadi.sk') return 'yandex_disk';
  if (isGoogleDriveFile(url)) return 'google_drive';
  if (host.includes('rutube')) return 'rutube';
  if (isHost(host, 'dzen.ru') || host === 'zen.yandex.ru') return 'dzen';
  if (isHost(host, 'vk.com') || isHost(host, 'vkvideo.ru')) return 'vk';
  if (host.includes('twitch.tv')) return 'twitch';
  if (DIRECT_FILE_RE.test(url.pathname)) return 'direct_file';
  return 'other';
};
