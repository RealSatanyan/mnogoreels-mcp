import { describe, expect, it } from 'vitest';
import { createFakeClock } from '../../../test/support/clock.js';
import { createFakeApi } from '../../../test/support/fake-api.js';
import type { Http } from '../../api/http.js';
import { createDeps } from '../../runtime/deps.js';
import { aDownloadProbe } from './fixtures.js';
import { probeForPricing, probeSource } from './probe.js';

const recordingHttp = () => {
  const seen: { path: string; timeoutMs: number; forwardFor: boolean | undefined; auth: string }[] = [];
  const http: Http = {
    request: (spec) => {
      seen.push({ path: spec.path, timeoutMs: spec.timeoutMs, forwardFor: spec.forwardFor, auth: spec.auth });
      return Promise.resolve(spec.schema.parse({ ...aDownloadProbe(), duration_sec: 90 }));
    },
  };
  return { http, seen };
};

const context = (http: Http) => ({
  http,
  keyHash: 'tenant',
  deps: createDeps({ fetch: createFakeApi([]).fetch, clock: createFakeClock() }),
  signal: new AbortController().signal,
  deadline: Number.MAX_SAFE_INTEGER,
});

describe('source probe requests', () => {
  it.each([
    ['https://www.youtube.com/watch?v=x', '/downloads/probe', 45_000],
    ['https://disk.yandex.ru/i/abc', '/yandex-disk/probe', 35_000],
    ['https://drive.google.com/file/d/abc/view', '/google-drive/probe', 35_000],
  ])('checks %s anonymously with a forwarding id and its own time limit', async (href, path, timeoutMs) => {
    const { http, seen } = recordingHttp();
    await probeSource({
      ...context(http),
      href,
      tenant: 'tenant',
      control: { signal: undefined, deadline: undefined },
    });
    expect(seen).toEqual([{ path, timeoutMs, forwardFor: true, auth: 'none' }]);
  });

  it('uses the shorter limit given for a complete window', async () => {
    const { http, seen } = recordingHttp();
    await probeForPricing({
      ctx: context(http),
      href: 'https://disk.yandex.ru/i/abc',
      windowComplete: true,
      timeoutMs: 15_000,
    });
    expect(seen.map((request) => request.timeoutMs)).toEqual([15_000]);
  });
});
