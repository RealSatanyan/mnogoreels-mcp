import { describe, expect, it } from 'vitest';
import {
  clientIpOf,
  loadProcessConfig,
  parseConfigHeaders,
  profileForPath,
  resolveEffectiveConfig,
  type ProcessConfig,
} from './config.js';

const ALL_TOOLSETS = ['account', 'clips', 'transcripts', 'articles', 'library', 'thumbnails'];

const load = (env: Record<string, string | undefined> = {}, forceHttp = false) => loadProcessConfig({ env, forceHttp });

const loaded = (env: Record<string, string | undefined> = {}, forceHttp = false): ProcessConfig => {
  const result = load(env, forceHttp);
  if (!result.ok) throw new Error(result.error);
  return result.config;
};

const errorOf = (env: Record<string, string | undefined>): string => {
  const result = load(env);
  return result.ok ? '' : result.error;
};

const aProcessConfig = (overrides: Partial<ProcessConfig> = {}): ProcessConfig => ({ ...loaded(), ...overrides });

describe('loadProcessConfig defaults', () => {
  it('starts without any variable', () => {
    const config = loaded();
    expect(config).toEqual({
      transport: 'stdio',
      apiUrl: 'https://api.mnogo-reels.ru',
      apiKey: undefined,
      profile: 'default',
      toolsets: new Set(ALL_TOOLSETS),
      readOnly: false,
      maxCreditsPerCall: undefined,
      maxWindowSec: 1800,
      mediaUrls: 'direct',
      debug: false,
      http: {
        host: '127.0.0.1',
        port: 8080,
        publicUrl: 'https://mcp.mnogo-reels.ru/mcp',
        allowedHosts: ['localhost', '127.0.0.1', '[::1]'],
        allowedOrigins: ['localhost', '127.0.0.1', '[::1]'],
        trustedProxies: [],
      },
    });
  });

  it('reports no warnings by default', () => {
    expect(load()).toMatchObject({ ok: true, warnings: [] });
  });
});

describe('loadProcessConfig values', () => {
  it('reads the stdio key, trimmed', () => {
    expect(loaded({ MNOGOREELS_API_KEY: '  mrfrt_usr_abc  ' }).apiKey).toBe('mrfrt_usr_abc');
    expect(loaded({ MNOGOREELS_API_KEY: '' }).apiKey).toBeUndefined();
  });

  it('ignores the key in http mode with a warning', () => {
    const result = load({ MNOGOREELS_API_KEY: 'mrfrt_usr_abc', MNOGOREELS_TRANSPORT: 'http' });
    expect(result).toMatchObject({ ok: true, config: { apiKey: undefined, transport: 'http' } });
    expect(result.ok && result.warnings[0]).toContain('MNOGOREELS_API_KEY is ignored in HTTP mode');
  });

  it('switches to http with the --http flag', () => {
    expect(loaded({ MNOGOREELS_TRANSPORT: 'stdio' }, true).transport).toBe('http');
  });

  it('ignores debug in http mode', () => {
    expect(loaded({ MNOGOREELS_DEBUG: '1' }).debug).toBe(true);
    expect(loaded({ MNOGOREELS_DEBUG: '1', MNOGOREELS_TRANSPORT: 'http' }).debug).toBe(false);
  });

  it('strips a trailing slash from the API URL', () => {
    expect(loaded({ MNOGOREELS_API_URL: 'https://api.example.com/' }).apiUrl).toBe('https://api.example.com');
    expect(loaded({ MNOGOREELS_API_URL: 'https://api.example.com/base//' }).apiUrl).toBe(
      'https://api.example.com/base',
    );
  });

  it.each(['http://localhost:8000', 'http://127.0.0.1:9000/'])('allows plain http for local API %s', (url) => {
    expect(loaded({ MNOGOREELS_API_URL: url }).apiUrl).toBe(url.replace(/\/$/, ''));
  });

  it.each([
    ['1', true],
    ['true', true],
    ['YES', true],
    ['on', true],
    ['0', false],
    ['false', false],
    ['no', false],
    ['off', false],
    ['', false],
  ])('parses read-only boolean %j', (value, expected) => {
    expect(loaded({ MNOGOREELS_READ_ONLY: value }).readOnly).toBe(expected);
  });

  it.each([
    ['clips,library', ['account', 'clips', 'library']],
    [' clips , transcripts ', ['account', 'clips', 'transcripts']],
    ['all', ALL_TOOLSETS],
    ['default', ALL_TOOLSETS],
    ['', ALL_TOOLSETS],
    ['account', ['account']],
  ])('parses toolsets %j', (value, expected) => {
    expect([...loaded({ MNOGOREELS_TOOLSETS: value }).toolsets].sort()).toEqual([...expected].sort());
  });

  it('parses numbers, modes and lists', () => {
    const config = loaded({
      MNOGOREELS_PROFILE: 'directory',
      MNOGOREELS_MAX_CREDITS_PER_CALL: '25',
      MNOGOREELS_MAX_WINDOW_SEC: '600',
      MNOGOREELS_MEDIA_URLS: 'both',
      MNOGOREELS_HOST: '0.0.0.0',
      MNOGOREELS_PORT: '9090',
      MNOGOREELS_PUBLIC_URL: 'https://mcp.example.com/mcp',
      MNOGOREELS_ALLOWED_HOSTS: 'mcp.example.com, localhost',
      MNOGOREELS_ALLOWED_ORIGINS: '*',
      MNOGOREELS_TRUSTED_PROXIES: '10.0.0.0/8, 172.16.0.0/12,192.0.2.7,2001:db8::/32',
    });
    expect(config).toMatchObject({
      profile: 'directory',
      maxCreditsPerCall: 25,
      maxWindowSec: 600,
      mediaUrls: 'both',
      http: {
        host: '0.0.0.0',
        port: 9090,
        publicUrl: 'https://mcp.example.com/mcp',
        allowedHosts: ['mcp.example.com', 'localhost'],
        allowedOrigins: '*',
        trustedProxies: ['10.0.0.0/8', '172.16.0.0/12', '192.0.2.7', '2001:db8::/32'],
      },
    });
  });

  it('accepts an origin list', () => {
    expect(loaded({ MNOGOREELS_ALLOWED_ORIGINS: 'app.example.com,localhost' }).http.allowedOrigins).toEqual([
      'app.example.com',
      'localhost',
    ]);
  });
});

describe('loadProcessConfig edge values', () => {
  it('defaults to stdio when --http is not given', () => {
    expect(loadProcessConfig({ env: {} })).toMatchObject({ ok: true, config: { transport: 'stdio' } });
  });

  it('accepts an explicit stdio transport', () => {
    expect(loaded({ MNOGOREELS_TRANSPORT: 'stdio' }).transport).toBe('stdio');
  });

  it('trims values', () => {
    expect(
      loaded({
        MNOGOREELS_READ_ONLY: ' true ',
        MNOGOREELS_MAX_CREDITS_PER_CALL: ' 25 ',
        MNOGOREELS_API_URL: ' https://api.example.com/ ',
        MNOGOREELS_PUBLIC_URL: ' https://mcp.example.com/mcp ',
        MNOGOREELS_ALLOWED_ORIGINS: ' * ',
        MNOGOREELS_HOST: ' 0.0.0.0 ',
      }),
    ).toMatchObject({
      readOnly: true,
      maxCreditsPerCall: 25,
      apiUrl: 'https://api.example.com',
      http: { publicUrl: 'https://mcp.example.com/mcp', allowedOrigins: '*', host: '0.0.0.0' },
    });
  });

  it.each(['', ' '])('treats an empty cap %j as no cap', (value) => {
    expect(loaded({ MNOGOREELS_MAX_CREDITS_PER_CALL: value }).maxCreditsPerCall).toBeUndefined();
  });

  it.each(['', ' '])('treats an empty host %j as the default', (value) => {
    expect(loaded({ MNOGOREELS_HOST: value }).http.host).toBe('127.0.0.1');
  });

  it('accepts the highest port', () => {
    expect(loaded({ MNOGOREELS_PORT: '65535' }).http.port).toBe(65_535);
  });

  it('allows plain http for the IPv6 loopback API', () => {
    expect(loaded({ MNOGOREELS_API_URL: 'http://[::1]:8000' }).apiUrl).toBe('http://[::1]:8000');
  });

  it('accepts a plain http public URL for local testing', () => {
    expect(loaded({ MNOGOREELS_PUBLIC_URL: 'http://localhost:8080/mcp' }).http.publicUrl).toBe(
      'http://localhost:8080/mcp',
    );
  });

  it.each(['0.0.0.0/0', '2001:db8::/64', '::/0'])('accepts the CIDR %s', (cidr) => {
    expect(loaded({ MNOGOREELS_TRUSTED_PROXIES: cidr }).http.trustedProxies).toEqual([cidr]);
  });

  it('warns only when a key is set in HTTP mode', () => {
    expect(load({ MNOGOREELS_API_KEY: 'mrfrt_usr_abc' })).toMatchObject({ ok: true, warnings: [] });
    expect(load({ MNOGOREELS_TRANSPORT: 'http' })).toMatchObject({ ok: true, warnings: [] });
  });

  it('gives the exact message for an invalid boolean', () => {
    expect(errorOf({ MNOGOREELS_READ_ONLY: 'maybe' })).toBe(
      'Invalid MNOGOREELS_READ_ONLY. Valid values: 1, true, yes, on, 0, false, no, off.',
    );
  });

  it('gives the exact message for an invalid transport', () => {
    expect(errorOf({ MNOGOREELS_TRANSPORT: 'sse' })).toBe('Invalid MNOGOREELS_TRANSPORT. Valid values: stdio, http.');
  });
});

describe('loadProcessConfig errors name the variable and the valid values', () => {
  it.each([
    [{ MNOGOREELS_PROFILE: 'admin' }, 'MNOGOREELS_PROFILE', 'default, readonly, directory'],
    [
      { MNOGOREELS_TOOLSETS: 'clips,video' },
      'MNOGOREELS_TOOLSETS',
      'clips, transcripts, articles, library, thumbnails',
    ],
    [{ MNOGOREELS_READ_ONLY: 'maybe' }, 'MNOGOREELS_READ_ONLY', '1, true, yes, on, 0, false, no, off'],
    [{ MNOGOREELS_DEBUG: 'loud' }, 'MNOGOREELS_DEBUG', 'true'],
    [{ MNOGOREELS_MAX_CREDITS_PER_CALL: '0' }, 'MNOGOREELS_MAX_CREDITS_PER_CALL', 'positive integer'],
    [{ MNOGOREELS_MAX_CREDITS_PER_CALL: '2.5' }, 'MNOGOREELS_MAX_CREDITS_PER_CALL', 'positive integer'],
    [{ MNOGOREELS_MAX_CREDITS_PER_CALL: 'ten' }, 'MNOGOREELS_MAX_CREDITS_PER_CALL', 'positive integer'],
    [{ MNOGOREELS_MAX_WINDOW_SEC: '-1' }, 'MNOGOREELS_MAX_WINDOW_SEC', 'positive integer'],
    [{ MNOGOREELS_MEDIA_URLS: 'proxy' }, 'MNOGOREELS_MEDIA_URLS', 'direct, both'],
    [{ MNOGOREELS_TRANSPORT: 'sse' }, 'MNOGOREELS_TRANSPORT', 'stdio, http'],
    [{ MNOGOREELS_PORT: '70000' }, 'MNOGOREELS_PORT', '1-65535'],
    [{ MNOGOREELS_PORT: '0' }, 'MNOGOREELS_PORT', '1-65535'],
    [{ MNOGOREELS_API_URL: 'not a url' }, 'MNOGOREELS_API_URL', 'https://'],
    [{ MNOGOREELS_API_URL: 'http://api.example.com' }, 'MNOGOREELS_API_URL', 'https://'],
    [{ MNOGOREELS_API_URL: 'ftp://localhost' }, 'MNOGOREELS_API_URL', 'https://'],
    [{ MNOGOREELS_PUBLIC_URL: 'mcp.example.com' }, 'MNOGOREELS_PUBLIC_URL', 'https://'],
    [{ MNOGOREELS_TRUSTED_PROXIES: '10.0.0.0/33' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
    [{ MNOGOREELS_TRUSTED_PROXIES: 'proxy.local' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
    [{ MNOGOREELS_TRUSTED_PROXIES: '10.0.0.0/x' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
    [{ MNOGOREELS_TRUSTED_PROXIES: '10.0.0.0/0x8' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
    [{ MNOGOREELS_TRUSTED_PROXIES: '10.0.0.0/1e1' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
    [{ MNOGOREELS_TRUSTED_PROXIES: '10.0.0.0/' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
    [{ MNOGOREELS_TRUSTED_PROXIES: '10.0.0.0/8/9' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
    [{ MNOGOREELS_TRUSTED_PROXIES: '2001:db8::/129' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
    [{ MNOGOREELS_TRUSTED_PROXIES: '10.0.0.0/8,bogus' }, 'MNOGOREELS_TRUSTED_PROXIES', 'CIDR'],
  ])('%j', (env, variable, valid) => {
    const error = errorOf(env);
    expect(error).toContain(variable);
    expect(error).toContain(valid);
  });

  it('never echoes the API key in errors', () => {
    expect(errorOf({ MNOGOREELS_API_KEY: 'mrfrt_usr_secret1234567890', MNOGOREELS_PROFILE: 'x' })).not.toContain(
      'secret',
    );
  });
});

describe('profileForPath', () => {
  it.each([
    ['/mcp', 'default'],
    ['/mcp/', 'default'],
    ['/mcp//', 'default'],
    ['/', undefined],
    ['/mcp/readonly', 'readonly'],
    ['/mcp/directory', 'directory'],
    ['/other', undefined],
    ['/mcp/admin', undefined],
  ])('%s → %s', (path, profile) => {
    expect(profileForPath(path)).toBe(profile);
  });
});

describe('parseConfigHeaders', () => {
  it('returns no narrowing without headers', () => {
    expect(parseConfigHeaders(new Headers())).toStrictEqual({ ok: true, value: {} });
  });

  it('reads a false read-only header and trims it', () => {
    expect(parseConfigHeaders(new Headers({ 'X-MnogoReels-Read-Only': ' false ' }))).toStrictEqual({
      ok: true,
      value: { readOnly: false },
    });
  });

  it('names the allowed read-only values exactly', () => {
    expect(parseConfigHeaders(new Headers({ 'X-MnogoReels-Read-Only': '1' }))).toEqual({
      ok: false,
      error: { header: 'X-MnogoReels-Read-Only', allowed: 'true, false' },
    });
  });

  it('parses every header, case-insensitively', () => {
    const headers = new Headers({
      'x-mnogoreels-toolsets': 'clips, library',
      'X-MnogoReels-Read-Only': 'TRUE',
      'X-MNOGOREELS-MAX-CREDITS-PER-CALL': '7',
    });
    expect(parseConfigHeaders(headers)).toEqual({
      ok: true,
      value: { toolsets: new Set(['account', 'clips', 'library']), readOnly: true, maxCreditsPerCall: 7 },
    });
  });

  it.each([
    ['X-MnogoReels-Toolsets', 'clips,bad', 'clips, transcripts, articles, library, thumbnails'],
    ['X-MnogoReels-Read-Only', 'sure', 'true, false'],
    ['X-MnogoReels-Max-Credits-Per-Call', '-3', 'positive integer'],
  ])('rejects %s: %s', (header, value, allowed) => {
    const result = parseConfigHeaders(new Headers({ [header]: value }));
    expect(result).toMatchObject({ ok: false, error: { header } });
    expect(!result.ok && result.error.allowed).toContain(allowed);
  });
});

describe('resolveEffectiveConfig', () => {
  it('passes the operator settings through for stdio', () => {
    const config = resolveEffectiveConfig({ process: aProcessConfig({ maxCreditsPerCall: 40 }) });
    expect(config).toEqual({
      profile: 'default',
      directory: false,
      toolsets: new Set(ALL_TOOLSETS),
      readOnly: false,
      maxCreditsPerCall: 40,
      maxWindowSec: 1800,
      mediaUrls: 'direct',
      apiUrl: 'https://api.mnogo-reels.ru',
      transport: 'stdio',
    });
  });

  it('readonly path makes the connection read-only', () => {
    expect(resolveEffectiveConfig({ process: aProcessConfig(), path: '/mcp/readonly' })).toMatchObject({
      profile: 'readonly',
      readOnly: true,
      directory: false,
    });
  });

  it('read-only from the operator wins over everything', () => {
    const config = resolveEffectiveConfig({
      process: aProcessConfig({ readOnly: true }),
      path: '/mcp',
      headers: { readOnly: false },
    });
    expect(config.readOnly).toBe(true);
  });

  it('readonly operator profile is read-only', () => {
    expect(resolveEffectiveConfig({ process: aProcessConfig({ profile: 'readonly' }) }).readOnly).toBe(true);
  });

  it('a header can force read-only but never widen', () => {
    expect(resolveEffectiveConfig({ process: aProcessConfig(), headers: { readOnly: true } }).readOnly).toBe(true);
    expect(
      resolveEffectiveConfig({ process: aProcessConfig(), path: '/mcp/readonly', headers: { readOnly: false } })
        .readOnly,
    ).toBe(true);
  });

  it('directory removes thumbnails and combines with read-only', () => {
    const config = resolveEffectiveConfig({ process: aProcessConfig({ profile: 'directory' }), path: '/mcp/readonly' });
    expect(config).toMatchObject({ profile: 'directory', directory: true, readOnly: true });
    expect(config.toolsets.has('thumbnails')).toBe(false);
  });

  it('directory path applies the directory restrictions', () => {
    const config = resolveEffectiveConfig({ process: aProcessConfig(), path: '/mcp/directory' });
    expect(config).toMatchObject({ profile: 'directory', directory: true, readOnly: false });
    expect([...config.toolsets].sort()).toEqual(['account', 'articles', 'clips', 'library', 'transcripts']);
  });

  it('header toolsets intersect with the operator set and always keep account', () => {
    const config = resolveEffectiveConfig({
      process: aProcessConfig({ toolsets: new Set(['account', 'clips', 'library']) }),
      headers: { toolsets: new Set(['library', 'thumbnails']) },
    });
    expect([...config.toolsets].sort()).toEqual(['account', 'library']);
  });

  it.each([
    [undefined, undefined, undefined],
    [30, undefined, 30],
    [undefined, 12, 12],
    [30, 12, 12],
    [10, 50, 10],
  ])('caps: operator %s, header %s → %s', (operator, header, expected) => {
    const config = resolveEffectiveConfig({
      process: aProcessConfig({ maxCreditsPerCall: operator }),
      headers: header === undefined ? {} : { maxCreditsPerCall: header },
    });
    expect(config.maxCreditsPerCall).toBe(expected);
  });

  it('unknown paths fall back to the operator profile', () => {
    expect(resolveEffectiveConfig({ process: aProcessConfig(), path: '/whatever' }).profile).toBe('default');
  });
});

describe('clientIpOf', () => {
  const trustedProxies = ['10.0.0.0/8', '172.16.0.0/12'];

  it('uses the socket peer when it is not a trusted proxy, ignoring forwarded headers', () => {
    expect(
      clientIpOf({
        remoteAddress: '203.0.113.9',
        headers: { 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.2' },
        trustedProxies,
      }),
    ).toBe('203.0.113.9');
  });

  it('takes the right-most untrusted X-Forwarded-For hop from a trusted proxy', () => {
    expect(
      clientIpOf({
        remoteAddress: '10.0.1.5',
        headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.7, 172.16.0.3' },
        trustedProxies,
      }),
    ).toBe('198.51.100.7');
  });

  it('handles IPv4-mapped socket addresses of trusted proxies', () => {
    expect(
      clientIpOf({ remoteAddress: '::ffff:10.0.1.5', headers: { 'x-forwarded-for': '198.51.100.7' }, trustedProxies }),
    ).toBe('198.51.100.7');
  });

  it('falls back to X-Real-Ip when every forwarded hop is trusted or absent', () => {
    expect(
      clientIpOf({
        remoteAddress: '10.0.1.5',
        headers: { 'x-forwarded-for': '10.0.0.9', 'x-real-ip': '198.51.100.8' },
        trustedProxies,
      }),
    ).toBe('198.51.100.8');
    expect(clientIpOf({ remoteAddress: '10.0.1.5', headers: { 'x-real-ip': '198.51.100.8' }, trustedProxies })).toBe(
      '198.51.100.8',
    );
  });

  it('falls back to the peer when nothing usable is forwarded', () => {
    expect(clientIpOf({ remoteAddress: '10.0.1.5', headers: {}, trustedProxies })).toBe('10.0.1.5');
    expect(
      clientIpOf({
        remoteAddress: '10.0.1.5',
        headers: { 'x-forwarded-for': 'unknown', 'x-real-ip': 'junk' },
        trustedProxies,
      }),
    ).toBe('10.0.1.5');
  });

  it('trims X-Real-Ip', () => {
    expect(clientIpOf({ remoteAddress: '10.0.1.5', headers: { 'x-real-ip': ' 198.51.100.8 ' }, trustedProxies })).toBe(
      '198.51.100.8',
    );
  });

  it('reads array-valued headers', () => {
    expect(
      clientIpOf({
        remoteAddress: '10.0.1.5',
        headers: { 'x-forwarded-for': ['198.51.100.1', '198.51.100.2'] },
        trustedProxies,
      }),
    ).toBe('198.51.100.2');
  });

  it('trusts no one by default', () => {
    expect(
      clientIpOf({ remoteAddress: '10.0.1.5', headers: { 'x-forwarded-for': '1.1.1.1' }, trustedProxies: [] }),
    ).toBe('10.0.1.5');
  });

  it('supports bare-address and IPv6 trusted proxies', () => {
    expect(
      clientIpOf({
        remoteAddress: '2001:db8::5',
        headers: { 'x-forwarded-for': '2001:db9::1' },
        trustedProxies: ['192.0.2.7', '2001:db8::/32'],
      }),
    ).toBe('2001:db9::1');
    expect(
      clientIpOf({
        remoteAddress: '192.0.2.7',
        headers: { 'x-forwarded-for': '198.51.100.3' },
        trustedProxies: ['192.0.2.7'],
      }),
    ).toBe('198.51.100.3');
  });

  it('returns undefined without a peer address', () => {
    expect(clientIpOf({ remoteAddress: undefined, headers: {}, trustedProxies })).toBeUndefined();
  });
});
