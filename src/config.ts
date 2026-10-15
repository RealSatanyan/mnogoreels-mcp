import { BlockList, isIP } from 'node:net';
import type { MediaUrlMode } from './domain/media-urls.js';

export type { MediaUrlMode } from './domain/media-urls.js';
export type Profile = 'default' | 'readonly' | 'directory';
export type ToolsetName = 'account' | 'clips' | 'transcripts' | 'articles' | 'library' | 'thumbnails';
export type Transport = 'stdio' | 'http';

export type ProcessConfig = {
  readonly transport: Transport;
  readonly apiUrl: string;
  readonly apiKey: string | undefined;
  readonly profile: Profile;
  readonly toolsets: ReadonlySet<ToolsetName>;
  readonly readOnly: boolean;
  readonly maxCreditsPerCall: number | undefined;
  readonly maxWindowSec: number;
  readonly mediaUrls: MediaUrlMode;
  readonly debug: boolean;
  readonly http: {
    readonly host: string;
    readonly port: number;
    readonly publicUrl: string;
    readonly allowedHosts: readonly string[];
    readonly allowedOrigins: readonly string[] | '*';
    readonly trustedProxies: readonly string[];
  };
};

export type EffectiveConfig = {
  readonly profile: Profile;
  readonly directory: boolean;
  readonly toolsets: ReadonlySet<ToolsetName>;
  readonly readOnly: boolean;
  readonly maxCreditsPerCall: number | undefined;
  readonly maxWindowSec: number;
  readonly mediaUrls: MediaUrlMode;
  readonly apiUrl: string;
  readonly transport: Transport;
};

export type HeaderNarrowing = {
  readonly toolsets?: ReadonlySet<ToolsetName>;
  readonly readOnly?: boolean;
  readonly maxCreditsPerCall?: number;
};

export type Env = Readonly<Record<string, string | undefined>>;

export type LoadResult =
  | { readonly ok: true; readonly config: ProcessConfig; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly error: string };

type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly allowed: string };

const PROFILES = ['default', 'readonly', 'directory'] as const;
const OPTIONAL_TOOLSETS = ['clips', 'transcripts', 'articles', 'library', 'thumbnails'] as const;
const ALL_TOOLSETS: readonly ToolsetName[] = ['account', ...OPTIONAL_TOOLSETS];
const TRUE_WORDS = ['1', 'true', 'yes', 'on'];
const FALSE_WORDS = ['0', 'false', 'no', 'off', ''];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const DEFAULT_API_URL = 'https://api.mnogo-reels.ru';
const DEFAULT_PUBLIC_URL = 'https://mcp.mnogo-reels.ru/mcp';
const DEFAULT_MAX_WINDOW_SEC = 1800;
const DEFAULT_PORT = 8080;
const DEFAULT_HOST = '127.0.0.1';
const MAX_PORT = 65_535;
const POSITIVE_INTEGER_RE = /^[1-9][0-9]*$/;
const PATH_PROFILES: Readonly<Record<string, Profile>> = {
  '/mcp': 'default',
  '/mcp/readonly': 'readonly',
  '/mcp/directory': 'directory',
};

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const bad = <T>(allowed: string): Parsed<T> => ({ ok: false, allowed });

const list = (raw: string): string[] =>
  raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

const isOneOf = <T extends string>(values: readonly T[], raw: string): raw is T =>
  values.some((value) => value === raw);

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (raw: string): Parsed<T> =>
    isOneOf(values, raw) ? ok(raw) : bad(values.join(', '));

const parseBoolean = (raw: string): Parsed<boolean> => {
  const word = raw.trim().toLowerCase();
  if (TRUE_WORDS.includes(word)) return ok(true);
  return FALSE_WORDS.includes(word) ? ok(false) : bad([...TRUE_WORDS, ...FALSE_WORDS.slice(0, -1)].join(', '));
};

const parsePositiveInteger = (raw: string): Parsed<number> =>
  POSITIVE_INTEGER_RE.test(raw.trim()) ? ok(Number(raw)) : bad('a positive integer');

const parsePort = (raw: string): Parsed<number> => {
  const port = parsePositiveInteger(raw);
  return port.ok && port.value <= MAX_PORT ? port : bad('a port number 1-65535');
};

const parseToolsets = (raw: string): Parsed<ReadonlySet<ToolsetName>> => {
  const names = list(raw.toLowerCase());
  if (names.length === 0 || names.includes('all') || names.includes('default')) return ok(new Set(ALL_TOOLSETS));
  const valid = names.filter((name) => isOneOf(ALL_TOOLSETS, name));
  return valid.length === names.length
    ? ok(new Set<ToolsetName>(['account', ...valid]))
    : bad(`a comma list of ${OPTIONAL_TOOLSETS.join(', ')} (or all)`);
};

const tryUrl = (raw: string): URL | undefined => (URL.canParse(raw) ? new URL(raw) : undefined);

const parseApiUrl = (raw: string): Parsed<string> => {
  const url = tryUrl(raw);
  const local = url?.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return url && (url.protocol === 'https:' || local)
    ? ok(raw.trim().replace(/\/+$/, ''))
    : bad('an https:// URL (http:// only for localhost or 127.0.0.1)');
};

const parsePublicUrl = (raw: string): Parsed<string> => {
  const url = tryUrl(raw);
  return url?.protocol === 'https:' || url?.protocol === 'http:' ? ok(raw.trim()) : bad('an https:// URL');
};

const parseCidr = (raw: string): readonly [string, number, 'ipv4' | 'ipv6'] | undefined => {
  const [address = '', prefix, ...rest] = raw.split('/');
  const family = isIP(address);
  const max = family === 4 ? 32 : 128;
  const bits = prefix === undefined ? max : /^[0-9]{1,3}$/.test(prefix) ? Number(prefix) : Number.NaN;
  return family === 0 || rest.length > 0 || !(bits <= max)
    ? undefined
    : [address, bits, family === 4 ? 'ipv4' : 'ipv6'];
};

const parseCidrList = (raw: string): Parsed<readonly string[]> => {
  const entries = list(raw);
  return entries.every((entry) => parseCidr(entry) !== undefined)
    ? ok(entries)
    : bad('a comma list of IP addresses or CIDR ranges, e.g. 10.0.0.0/8,172.16.0.0/12');
};

const parseOrigins = (raw: string): Parsed<readonly string[] | '*'> => ok(raw.trim() === '*' ? '*' : list(raw));

const read = <T>(env: Env, name: string, parse: (raw: string) => Parsed<T>, fallback: T): T => {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const parsed = parse(raw);
  if (!parsed.ok) throw new Error(`Invalid ${name}. Valid values: ${parsed.allowed}.`);
  return parsed.value;
};

const parseOptionalPositiveInteger = (raw: string): Parsed<number | undefined> =>
  raw.trim() === '' ? ok(undefined) : parsePositiveInteger(raw);

const readConfig = (env: Env, forceHttp: boolean): LoadResult => {
  const transport = read(env, 'MNOGOREELS_TRANSPORT', oneOf<Transport>(['stdio', 'http']), 'stdio');
  const http = forceHttp || transport === 'http';
  const rawKey = env['MNOGOREELS_API_KEY']?.trim() ?? '';
  const debug = read(env, 'MNOGOREELS_DEBUG', parseBoolean, false);
  const config: ProcessConfig = {
    transport: http ? 'http' : 'stdio',
    apiUrl: read(env, 'MNOGOREELS_API_URL', parseApiUrl, DEFAULT_API_URL),
    apiKey: http || rawKey === '' ? undefined : rawKey,
    profile: read(env, 'MNOGOREELS_PROFILE', oneOf<Profile>(PROFILES), 'default'),
    toolsets: read(env, 'MNOGOREELS_TOOLSETS', parseToolsets, new Set(ALL_TOOLSETS)),
    readOnly: read(env, 'MNOGOREELS_READ_ONLY', parseBoolean, false),
    maxCreditsPerCall: read(env, 'MNOGOREELS_MAX_CREDITS_PER_CALL', parseOptionalPositiveInteger, undefined),
    maxWindowSec: read(env, 'MNOGOREELS_MAX_WINDOW_SEC', parsePositiveInteger, DEFAULT_MAX_WINDOW_SEC),
    mediaUrls: read(env, 'MNOGOREELS_MEDIA_URLS', oneOf<MediaUrlMode>(['direct', 'both']), 'direct'),
    debug: debug && !http,
    http: {
      host: read(env, 'MNOGOREELS_HOST', (raw) => ok(raw.trim() === '' ? DEFAULT_HOST : raw.trim()), DEFAULT_HOST),
      port: read(env, 'MNOGOREELS_PORT', parsePort, DEFAULT_PORT),
      publicUrl: read(env, 'MNOGOREELS_PUBLIC_URL', parsePublicUrl, DEFAULT_PUBLIC_URL),
      allowedHosts: read(env, 'MNOGOREELS_ALLOWED_HOSTS', (raw) => ok(list(raw)), LOCAL_HOSTS),
      allowedOrigins: read(env, 'MNOGOREELS_ALLOWED_ORIGINS', parseOrigins, LOCAL_HOSTS),
      trustedProxies: read(env, 'MNOGOREELS_TRUSTED_PROXIES', parseCidrList, []),
    },
  };
  const warnings =
    http && rawKey !== ''
      ? ['MNOGOREELS_API_KEY is ignored in HTTP mode: callers must send their own key in the Authorization header.']
      : [];
  return { ok: true, config, warnings };
};

export const loadProcessConfig = (options: { readonly env: Env; readonly forceHttp?: boolean }): LoadResult => {
  try {
    return readConfig(options.env, options.forceHttp ?? false);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid configuration.' };
  }
};

export const profileForPath = (path: string): Profile | undefined => PATH_PROFILES[path.replace(/\/+$/, '')];

export type HeaderParseResult =
  | { readonly ok: true; readonly value: HeaderNarrowing }
  | { readonly ok: false; readonly error: { readonly header: string; readonly allowed: string } };

const parseHeaderBoolean = (raw: string): Parsed<boolean> => {
  const word = raw.toLowerCase();
  return word === 'true' || word === 'false' ? ok(word === 'true') : bad('true, false');
};

const headerValue = <T>(headers: Headers, parse: (raw: string) => Parsed<T>, header: string) => {
  const raw = headers.get(header);
  return { header, parsed: raw === null ? ok(undefined) : parse(raw) };
};

export const parseConfigHeaders = (headers: Headers): HeaderParseResult => {
  const toolsets = headerValue(headers, parseToolsets, 'X-MnogoReels-Toolsets');
  const readOnly = headerValue(headers, parseHeaderBoolean, 'X-MnogoReels-Read-Only');
  const maxCredits = headerValue(headers, parsePositiveInteger, 'X-MnogoReels-Max-Credits-Per-Call');
  const failed = [toolsets, readOnly, maxCredits].find((entry) => !entry.parsed.ok);
  if (failed && !failed.parsed.ok)
    return { ok: false, error: { header: failed.header, allowed: failed.parsed.allowed } };
  return {
    ok: true,
    value: {
      ...(toolsets.parsed.ok && toolsets.parsed.value ? { toolsets: toolsets.parsed.value } : {}),
      ...(readOnly.parsed.ok && readOnly.parsed.value !== undefined ? { readOnly: readOnly.parsed.value } : {}),
      ...(maxCredits.parsed.ok && maxCredits.parsed.value ? { maxCreditsPerCall: maxCredits.parsed.value } : {}),
    },
  };
};

const minDefined = (values: readonly (number | undefined)[]): number | undefined => {
  const defined = values.filter((value): value is number => value !== undefined);
  return defined.length === 0 ? undefined : Math.min(...defined);
};

export const resolveEffectiveConfig = (options: {
  readonly process: ProcessConfig;
  readonly path?: string;
  readonly headers?: HeaderNarrowing;
}): EffectiveConfig => {
  const { process, headers = {} } = options;
  const pathProfile = options.path === undefined ? undefined : profileForPath(options.path);
  const directory = process.profile === 'directory' || pathProfile === 'directory';
  const readOnly =
    process.readOnly || process.profile === 'readonly' || pathProfile === 'readonly' || headers.readOnly === true;
  const narrowed = [...process.toolsets].filter((name) => headers.toolsets?.has(name) ?? true);
  const toolsets = new Set<ToolsetName>(
    ['account' as const, ...narrowed].filter((name) => !(directory && name === 'thumbnails')),
  );
  return {
    profile: directory ? 'directory' : readOnly ? 'readonly' : 'default',
    directory,
    toolsets,
    readOnly,
    maxCreditsPerCall: minDefined([process.maxCreditsPerCall, headers.maxCreditsPerCall]),
    maxWindowSec: process.maxWindowSec,
    mediaUrls: process.mediaUrls,
    apiUrl: process.apiUrl,
    transport: process.transport,
  };
};

const subnetsOf = (cidrs: readonly string[]): BlockList =>
  cidrs.reduce((blockList, cidr) => {
    const parsed = parseCidr(cidr);
    if (parsed) blockList.addSubnet(...parsed);
    return blockList;
  }, new BlockList());

const isTrusted = (subnets: BlockList, address: string): boolean =>
  subnets.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');

const headerText = (value: string | readonly string[] | undefined): string =>
  typeof value === 'string' ? value : (value ?? []).join(',');

export const clientIpOf = (options: {
  readonly remoteAddress: string | undefined;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly trustedProxies: readonly string[];
}): string | undefined => {
  const { remoteAddress, headers } = options;
  const subnets = subnetsOf(options.trustedProxies);
  if (remoteAddress === undefined || !isTrusted(subnets, remoteAddress)) return remoteAddress;
  const hops = list(headerText(headers['x-forwarded-for']));
  const hop = hops.reverse().find((candidate) => !isTrusted(subnets, candidate));
  if (hop !== undefined && isIP(hop) !== 0) return hop;
  const realIp = headerText(headers['x-real-ip']).trim();
  return isIP(realIp) === 0 ? remoteAddress : realIp;
};
