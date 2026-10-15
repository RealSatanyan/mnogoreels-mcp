import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createCaptureLogger } from '../../test/support/capture-logger.js';
import { createFakeClock, type FakeClock } from '../../test/support/clock.js';
import {
  createFakeApi,
  html,
  ok,
  status,
  type FakeRequest,
  type FakeResponse,
  type FakeRoute,
} from '../../test/support/fake-api.js';
import { hashKey } from '../shaping/redact.js';
import { VERSION } from '../version.js';
import { ApiError, type ApiFailure } from './errors.js';
import { createHttp, forwardedForValue, type RequestControl, type RequestSpec } from './http.js';

const KEY = 'mrfrt_usr_TESTKEY1234567890abcd';
const ItemSchema = z.object({ id: z.string(), n: z.number() });

const aSpec = (overrides: Partial<RequestSpec<typeof ItemSchema>> = {}): RequestSpec<typeof ItemSchema> => ({
  method: 'GET',
  path: '/videos/abc',
  schema: ItemSchema,
  auth: 'api_key',
  timeoutMs: 20_000,
  retry: 'safe',
  ...overrides,
});

const NO_CONTROL: RequestControl = { signal: undefined, deadline: undefined };

const aClient = (
  routes: readonly FakeRoute[],
  options: { apiKey?: string | undefined; forwardedFor?: string; clock?: FakeClock } = {},
) => {
  const api = createFakeApi(routes);
  const clock = options.clock ?? createFakeClock({ autoAdvance: true });
  const logs = createCaptureLogger();
  const http = createHttp({
    baseUrl: api.baseUrl,
    apiKey: 'apiKey' in options ? options.apiKey : KEY,
    forwardedFor: options.forwardedFor,
    deps: { fetch: api.fetch, clock, logger: logs.logger },
  });
  return { http, api, clock, logs };
};

const route = (
  respond: FakeRoute['respond'],
  method: 'GET' | 'POST' = 'GET',
  path: string | RegExp = /.*/,
): FakeRoute => ({
  method,
  path,
  respond,
});

const sequence = (...responses: readonly FakeResponse[]): FakeRoute['respond'] => {
  const state = { index: 0 };
  return () => {
    const response = responses[Math.min(state.index, responses.length - 1)] ?? ok({});
    state.index += 1;
    return response;
  };
};

const hangUntilAborted = (request: FakeRequest): Promise<FakeResponse> =>
  new Promise<FakeResponse>((_resolve, reject) => {
    request.signal?.addEventListener('abort', () => {
      reject(new DOMException('aborted', 'AbortError'));
    });
  });

const failureOf = async (promise: Promise<unknown>): Promise<ApiFailure> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.failure;
    throw error;
  }
  throw new Error('expected an ApiError');
};

describe('createHttp request basics', () => {
  it('sends identifying headers and parses the response through the schema', async () => {
    const { http, api } = aClient([route(() => ok({ id: 'abc', n: 1, extra: 'dropped' }))]);
    await expect(http.request(aSpec(), NO_CONTROL)).resolves.toEqual({ id: 'abc', n: 1 });
    const [request] = api.requests();
    expect(request).toMatchObject({
      method: 'GET',
      path: '/videos/abc',
      authorized: true,
      headers: {
        'user-agent': `mnogoreels-mcp/${VERSION} (+https://github.com/RealSatanyan/mnogoreels-mcp)`,
        accept: 'application/json',
      },
    });
    expect(request?.headers['x-forwarded-for']).toBeUndefined();
  });

  it('sends the key as a Bearer token', async () => {
    const seen: string[] = [];
    const api = createFakeApi([route(() => ok({ id: 'a', n: 1 }))]);
    const http = createHttp({
      baseUrl: api.baseUrl,
      apiKey: KEY,
      forwardedFor: undefined,
      deps: {
        fetch: (input, init) => {
          seen.push(new Headers(init?.headers).get('authorization') ?? '');
          return api.fetch(input, init);
        },
        clock: createFakeClock(),
        logger: createCaptureLogger().logger,
      },
    });
    await http.request(aSpec(), NO_CONTROL);
    expect(seen).toEqual([`Bearer ${KEY}`]);
  });

  it('omits auth for anonymous endpoints', async () => {
    const { http, api } = aClient([route(() => ok({ id: 'a', n: 1 }), 'POST')]);
    await http.request(aSpec({ method: 'POST', path: '/downloads/probe', auth: 'none', retry: 'probe' }), NO_CONTROL);
    expect(api.requests()[0]?.authorized).toBe(false);
  });

  it('works without a key for anonymous endpoints', async () => {
    const { http } = aClient([route(() => ok({ id: 'a', n: 1 }), 'POST')], { apiKey: undefined });
    await expect(http.request(aSpec({ method: 'POST', auth: 'none', retry: 'probe' }), NO_CONTROL)).resolves.toEqual({
      id: 'a',
      n: 1,
    });
  });

  it('throws missing_api_key before any network I/O', async () => {
    const { http, api } = aClient([route(() => ok({}))], { apiKey: undefined });
    await expect(failureOf(http.request(aSpec(), NO_CONTROL))).resolves.toEqual({ kind: 'missing_api_key' });
    expect(api.requests()).toHaveLength(0);
  });

  it('builds the query string, skipping undefined values', async () => {
    const { http, api } = aClient([route(() => ok({ id: 'a', n: 1 }))]);
    await http.request(
      aSpec({ path: '/videos', query: { limit: 10, offset: 0, caller_type: undefined, flag: true } }),
      NO_CONTROL,
    );
    expect(api.requests()[0]?.query).toEqual({ limit: '10', offset: '0', flag: 'true' });
  });

  it('sends JSON bodies with a JSON content type', async () => {
    const { http, api } = aClient([route(() => ok({ id: 'a', n: 1 }), 'POST')]);
    await http.request(
      aSpec({ method: 'POST', body: { kind: 'json', value: { url: 'https://x', start_sec: 0 } }, retry: 'never' }),
      NO_CONTROL,
    );
    expect(api.requests()[0]).toMatchObject({
      headers: { 'content-type': 'application/json' },
      body: { url: 'https://x', start_sec: 0 },
    });
  });

  it('sends multipart forms, skipping undefined fields', async () => {
    const { http, api } = aClient([route(() => ok({ id: 'a', n: 1 }), 'POST')]);
    await http.request(
      aSpec({
        method: 'POST',
        body: { kind: 'form', fields: { url: 'https://x', language: undefined, style: 'bold' } },
        retry: 'never',
      }),
      NO_CONTROL,
    );
    expect(api.requests()[0]?.body).toEqual({ url: 'https://x', style: 'bold' });
    expect(api.requests()[0]?.headers['content-type']).toContain('multipart/form-data');
  });

  it('sends no X-Forwarded-For when there is no value', async () => {
    const { http, api } = aClient([route(() => ok({ id: 'a', n: 1 }), 'POST')]);
    await http.request(aSpec({ method: 'POST', auth: 'none', retry: 'probe', forwardFor: true }), NO_CONTROL);
    expect(api.requests()[0]?.headers).not.toHaveProperty('x-forwarded-for');
  });

  it('adds X-Forwarded-For only when the spec asks and a value exists', async () => {
    const { http, api } = aClient([route(() => ok({ id: 'a', n: 1 }), 'POST')], {
      forwardedFor: 'mcp-0123456789abcdef',
    });
    await http.request(aSpec({ method: 'POST', auth: 'none', retry: 'probe', forwardFor: true }), NO_CONTROL);
    await http.request(aSpec({ method: 'POST', auth: 'none', retry: 'probe' }), NO_CONTROL);
    expect(api.requests().map((request) => request.headers['x-forwarded-for'])).toEqual([
      'mcp-0123456789abcdef',
      undefined,
    ]);
  });
});

describe('failure context', () => {
  const contextOf = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      if (error instanceof ApiError) return error.context;
    }
    return undefined;
  };

  it('marks retry=never requests as submissions of the named resource', async () => {
    const { http } = aClient([route(() => status(500), 'POST')]);
    await expect(
      contextOf(http.request(aSpec({ method: 'POST', retry: 'never', resource: 'transcription' }), NO_CONTROL)),
    ).resolves.toEqual({ operation: 'submit', resource: 'transcription' });
  });

  it('marks other requests as reads of an unnamed item by default', async () => {
    const { http } = aClient([route(() => status(404))]);
    await expect(contextOf(http.request(aSpec({ retry: 'probe' }), NO_CONTROL))).resolves.toEqual({
      operation: 'read',
      resource: 'item',
    });
  });

  it('keeps the context on missing keys and aborted retries', async () => {
    const noKey = aClient([route(() => ok({}))], { apiKey: undefined });
    await expect(contextOf(noKey.http.request(aSpec({ resource: 'article' }), NO_CONTROL))).resolves.toEqual({
      operation: 'read',
      resource: 'article',
    });
  });
});

describe('forwardedForValue', () => {
  it('uses a key-derived pseudonym on HTTP when the key is well-formed', () => {
    expect(forwardedForValue({ transport: 'http', apiKey: KEY, clientIp: '203.0.113.5' })).toBe(
      `mcp-${hashKey(KEY).slice(0, 16)}`,
    );
  });

  it('uses the client IP on HTTP without a well-formed key', () => {
    expect(forwardedForValue({ transport: 'http', apiKey: undefined, clientIp: '203.0.113.5' })).toBe('203.0.113.5');
    expect(forwardedForValue({ transport: 'http', apiKey: 'garbage', clientIp: '203.0.113.5' })).toBe('203.0.113.5');
  });

  it('sends nothing on stdio', () => {
    expect(forwardedForValue({ transport: 'stdio', apiKey: KEY, clientIp: undefined })).toBeUndefined();
  });
});

describe('createHttp failures', () => {
  it('maps a JSON error body to status and detail', async () => {
    const { http } = aClient([route(() => status(404, 'Job not found'))]);
    await expect(failureOf(http.request(aSpec({ retry: 'never' }), NO_CONTROL))).resolves.toEqual({
      kind: 'http',
      status: 404,
      detail: 'Job not found',
      retryAfterSec: undefined,
      htmlLike: false,
    });
  });

  it('joins 422 validation details into one line', async () => {
    const detail = [
      { loc: ['body', 'start_sec'], msg: 'Input should be a number', type: 'x' },
      { loc: ['body', 'url'], msg: 'Field required' },
      { msg: 'Odd' },
      { loc: [], msg: 'Empty location' },
      { loc: ['query', 0], msg: null },
    ];
    const { http } = aClient([route(() => status(422, detail), 'POST')]);
    const failure = await failureOf(http.request(aSpec({ method: 'POST', retry: 'never' }), NO_CONTROL));
    expect(failure).toMatchObject({
      kind: 'http',
      status: 422,
      detail: 'body.start_sec: Input should be a number; body.url: Field required; Odd; Empty location; query.0',
    });
  });

  it('treats HTML error pages as html-like without detail', async () => {
    const { http } = aClient([route(() => html(403))]);
    await expect(failureOf(http.request(aSpec({ retry: 'never' }), NO_CONTROL))).resolves.toEqual({
      kind: 'http',
      status: 403,
      detail: undefined,
      retryAfterSec: undefined,
      htmlLike: true,
    });
  });

  it('treats an error without a content type as html-like', async () => {
    const { http } = aClient([route(() => status(403))]);
    await expect(failureOf(http.request(aSpec({ retry: 'never' }), NO_CONTROL))).resolves.toMatchObject({
      status: 403,
      htmlLike: true,
    });
  });

  it('treats a JSON error body without detail as no detail', async () => {
    const { http } = aClient([route(() => ({ status: 500, json: { message: 'x' } }))]);
    await expect(failureOf(http.request(aSpec({ retry: 'never' }), NO_CONTROL))).resolves.toMatchObject({
      detail: undefined,
      htmlLike: false,
    });
  });

  it('reads Retry-After seconds', async () => {
    const { http } = aClient([route(() => status(429, 'slow', { 'retry-after': '42' }))]);
    await expect(failureOf(http.request(aSpec({ retry: 'never' }), NO_CONTROL))).resolves.toMatchObject({
      status: 429,
      retryAfterSec: 42,
    });
  });

  it.each(['soon', '5s', 'x5', '-1'])('ignores a malformed Retry-After %j', async (value) => {
    const { http } = aClient([route(() => status(429, 'slow', { 'retry-after': value }))]);
    await expect(failureOf(http.request(aSpec({ retry: 'never' }), NO_CONTROL))).resolves.toMatchObject({
      retryAfterSec: undefined,
    });
  });

  it('rejects a response that does not match the schema and logs only issue paths', async () => {
    const NestedSchema = z.object({ items: z.array(z.object({ id: z.string() })), n: z.number() });
    const { http, logs } = aClient([
      route(() => ok({ items: [{ id: 'secret-value' }, { id: 7 }], n: 'not a number' })),
    ]);
    await expect(failureOf(http.request({ ...aSpec(), schema: NestedSchema }, NO_CONTROL))).resolves.toEqual({
      kind: 'invalid_response',
      issuePaths: ['items.1.id', 'n'],
    });
    expect(logs.entries()).toMatchObject([
      { level: 'warn', event: 'invalid_response', path: '/videos/abc', issues: 'items.1.id,n' },
    ]);
    expect(logs.text()).not.toContain('secret-value');
  });

  it('rejects malformed JSON', async () => {
    const { http } = aClient([
      route(() => ({ status: 200, text: '{not json', headers: { 'content-type': 'application/json' } })),
    ]);
    await expect(failureOf(http.request(aSpec(), NO_CONTROL))).resolves.toEqual({
      kind: 'invalid_response',
      issuePaths: [],
    });
  });

  it('rejects a 2xx answer that is not JSON', async () => {
    const { http } = aClient([route(() => html(200))]);
    await expect(failureOf(http.request(aSpec(), NO_CONTROL))).resolves.toEqual({
      kind: 'invalid_response',
      issuePaths: [],
    });
  });

  it('rejects 2xx bodies over the byte cap', async () => {
    const { http } = aClient([route(() => ok({ id: 'x'.repeat(5000), n: 1 }))]);
    await expect(failureOf(http.request(aSpec({ maxBytes: 1000 }), NO_CONTROL))).resolves.toEqual({
      kind: 'invalid_response',
      issuePaths: [],
    });
  });

  it('counts every chunk of a streamed body against the byte cap', async () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    const streamed = () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start: (controller) => {
            [
              encode('{"id":"'),
              encode('x'.repeat(400)),
              encode('x'.repeat(400)),
              encode('x'.repeat(400)),
              encode('","n":1}'),
            ].forEach((chunk) => {
              controller.enqueue(chunk);
            });
            controller.close();
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    const http = createHttp({
      baseUrl: 'https://api.test.local',
      apiKey: KEY,
      forwardedFor: undefined,
      deps: {
        fetch: () => Promise.resolve(streamed()),
        clock: createFakeClock(),
        logger: createCaptureLogger().logger,
      },
    });
    await expect(failureOf(http.request(aSpec({ maxBytes: 1000 }), NO_CONTROL))).resolves.toEqual({
      kind: 'invalid_response',
      issuePaths: [],
    });
    await expect(http.request(aSpec({ maxBytes: 1300 }), NO_CONTROL)).resolves.toMatchObject({ n: 1 });
  });

  it('treats a JSON answer without a body as invalid', async () => {
    const http = createHttp({
      baseUrl: 'https://api.test.local',
      apiKey: KEY,
      forwardedFor: undefined,
      deps: {
        fetch: () =>
          Promise.resolve(new Response(null, { status: 200, headers: { 'content-type': 'application/json' } })),
        clock: createFakeClock(),
        logger: createCaptureLogger().logger,
      },
    });
    await expect(failureOf(http.request(aSpec(), NO_CONTROL))).resolves.toEqual({
      kind: 'invalid_response',
      issuePaths: [],
    });
  });

  it('accepts bodies exactly at the byte cap', async () => {
    const body = JSON.stringify({ id: 'abc', n: 1 });
    const { http } = aClient([route(() => ok({ id: 'abc', n: 1 }))]);
    await expect(http.request(aSpec({ maxBytes: body.length }), NO_CONTROL)).resolves.toEqual({ id: 'abc', n: 1 });
  });

  it('maps a network failure', async () => {
    const { http } = aClient([route(() => 'network-error')]);
    await expect(failureOf(http.request(aSpec({ retry: 'never' }), NO_CONTROL))).resolves.toEqual({ kind: 'network' });
  });
});

describe('createHttp time limits', () => {
  it('does not send when less than 3 s of the budget remain', async () => {
    const clock = createFakeClock();
    const { http, api } = aClient([route(() => ok({ id: 'a', n: 1 }))], { clock });
    const control = { signal: undefined, deadline: clock.now() + 3_999 };
    await expect(failureOf(http.request(aSpec(), control))).resolves.toEqual({ kind: 'deadline' });
    expect(api.requests()).toHaveLength(0);
  });

  it('sends when exactly 3 s remain after the safety margin', async () => {
    const clock = createFakeClock();
    const { http } = aClient([route(() => ok({ id: 'a', n: 1 }))], { clock });
    await expect(http.request(aSpec(), { signal: undefined, deadline: clock.now() + 4_000 })).resolves.toEqual({
      id: 'a',
      n: 1,
    });
  });

  it('times out on its own timer as timeout, not as a client cancel', async () => {
    const { http } = aClient([route(hangUntilAborted)]);
    await expect(failureOf(http.request(aSpec({ retry: 'never', timeoutMs: 3_000 }), NO_CONTROL))).resolves.toEqual({
      kind: 'timeout',
    });
  });

  it('caps the timeout by the deadline', async () => {
    const clock = createFakeClock();
    const { http } = aClient([route(hangUntilAborted)], { clock });
    const control = { signal: undefined, deadline: clock.now() + 4_000 };
    const started = Date.now();
    await expect(failureOf(http.request(aSpec({ retry: 'never', timeoutMs: 60_000 }), control))).resolves.toEqual({
      kind: 'timeout',
    });
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('reports a client cancel as aborted', async () => {
    const controller = new AbortController();
    const { http } = aClient([
      route(
        (request) =>
          new Promise<FakeResponse>((_resolve, reject) => {
            request.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
            controller.abort();
          }),
      ),
    ]);
    await expect(failureOf(http.request(aSpec(), { signal: controller.signal, deadline: undefined }))).resolves.toEqual(
      {
        kind: 'aborted',
      },
    );
  });

  it('reports an already-cancelled request as aborted without sending', async () => {
    const controller = new AbortController();
    controller.abort();
    const { http, api } = aClient([route(() => ok({ id: 'a', n: 1 }))]);
    await expect(failureOf(http.request(aSpec(), { signal: controller.signal, deadline: undefined }))).resolves.toEqual(
      {
        kind: 'aborted',
      },
    );
    expect(api.requests()).toHaveLength(0);
  });
});

describe('createHttp retries', () => {
  it.each([502, 503, 504, 524])('safe GETs retry %i up to twice with 1 s and 3 s backoff', async (code) => {
    const clock = createFakeClock({ autoAdvance: true });
    const start = clock.now();
    const { http, api } = aClient([route(sequence(status(code), status(code), ok({ id: 'a', n: 1 })))], { clock });
    await expect(http.request(aSpec(), NO_CONTROL)).resolves.toEqual({ id: 'a', n: 1 });
    expect(api.requests()).toHaveLength(3);
    expect(clock.now() - start).toBe(4_000);
  });

  it('gives up after two retries', async () => {
    const { http, api } = aClient([route(sequence(status(503), status(503), status(503), ok({ id: 'a', n: 1 })))]);
    await expect(failureOf(http.request(aSpec(), NO_CONTROL))).resolves.toMatchObject({ status: 503 });
    expect(api.requests()).toHaveLength(3);
  });

  it('safe GETs retry network errors', async () => {
    const { http, api } = aClient([route(sequence('network-error', ok({ id: 'a', n: 1 })))]);
    await expect(http.request(aSpec(), NO_CONTROL)).resolves.toEqual({ id: 'a', n: 1 });
    expect(api.requests()).toHaveLength(2);
  });

  it('honours Retry-After up to 10 s on 429', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const start = clock.now();
    const { http, api } = aClient([route(sequence(status(429, 'x', { 'retry-after': '7' }), ok({ id: 'a', n: 1 })))], {
      clock,
    });
    await expect(http.request(aSpec(), NO_CONTROL)).resolves.toEqual({ id: 'a', n: 1 });
    expect(api.requests()).toHaveLength(2);
    expect(clock.now() - start).toBe(7_000);
  });

  it('honours a Retry-After of exactly 10 s', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const start = clock.now();
    const { http, api } = aClient([route(sequence(status(503, 'x', { 'retry-after': '10' }), ok({ id: 'a', n: 1 })))], {
      clock,
    });
    await expect(http.request(aSpec(), NO_CONTROL)).resolves.toEqual({ id: 'a', n: 1 });
    expect(api.requests()).toHaveLength(2);
    expect(clock.now() - start).toBe(10_000);
  });

  it('retries a 429 with a Retry-After of exactly 10 s', async () => {
    const { http, api } = aClient([route(sequence(status(429, 'x', { 'retry-after': '10' }), ok({ id: 'a', n: 1 })))]);
    await expect(http.request(aSpec(), NO_CONTROL)).resolves.toEqual({ id: 'a', n: 1 });
    expect(api.requests()).toHaveLength(2);
  });

  it('honours Retry-After on 503 instead of the backoff', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const start = clock.now();
    const { http } = aClient([route(sequence(status(503, 'x', { 'retry-after': '2' }), ok({ id: 'a', n: 1 })))], {
      clock,
    });
    await http.request(aSpec(), NO_CONTROL);
    expect(clock.now() - start).toBe(2_000);
  });

  it('uses the backoff when a 503 asks to wait more than 10 s', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const start = clock.now();
    const { http } = aClient([route(sequence(status(503, 'x', { 'retry-after': '30' }), ok({ id: 'a', n: 1 })))], {
      clock,
    });
    await http.request(aSpec(), NO_CONTROL);
    expect(clock.now() - start).toBe(1_000);
  });

  it.each([
    ['429 without Retry-After', status(429, 'x')],
    ['429 with Retry-After over 10 s', status(429, 'x', { 'retry-after': '11' })],
    ['500', status(500)],
    ['500 with a short Retry-After', status(500, 'x', { 'retry-after': '1' })],
    ['404', status(404)],
  ])('safe GETs do not retry %s', async (_label, response) => {
    const { http, api } = aClient([route(sequence(response, ok({ id: 'a', n: 1 })))]);
    await expect(failureOf(http.request(aSpec(), NO_CONTROL))).resolves.toMatchObject({ kind: 'http' });
    expect(api.requests()).toHaveLength(1);
  });

  it('probe requests retry only 503 and short 429', async () => {
    const probe = aSpec({ method: 'POST', auth: 'none', retry: 'probe' });
    const retried = aClient([
      route(sequence(status(503), status(429, 'x', { 'retry-after': '1' }), ok({ id: 'a', n: 1 })), 'POST'),
    ]);
    await expect(retried.http.request(probe, NO_CONTROL)).resolves.toEqual({ id: 'a', n: 1 });
    expect(retried.api.requests()).toHaveLength(3);
    const gateway = aClient([route(sequence(status(504), ok({ id: 'a', n: 1 })), 'POST')]);
    await expect(failureOf(gateway.http.request(probe, NO_CONTROL))).resolves.toMatchObject({ status: 504 });
    expect(gateway.api.requests()).toHaveLength(1);
    const network = aClient([route(sequence('network-error', ok({ id: 'a', n: 1 })), 'POST')]);
    await expect(failureOf(network.http.request(probe, NO_CONTROL))).resolves.toEqual({ kind: 'network' });
    expect(network.api.requests()).toHaveLength(1);
  });

  it.each([
    ['429 without Retry-After', status(429, 'x')],
    ['404', status(404)],
    ['502', status(502)],
    ['502 with a short Retry-After', status(502, 'x', { 'retry-after': '1' })],
  ])('probe requests do not retry %s', async (_label, response) => {
    const { http, api } = aClient([route(sequence(response, ok({ id: 'a', n: 1 })), 'POST')]);
    await expect(
      failureOf(http.request(aSpec({ method: 'POST', auth: 'none', retry: 'probe' }), NO_CONTROL)),
    ).resolves.toMatchObject({ kind: 'http' });
    expect(api.requests()).toHaveLength(1);
  });

  it('never retries paid or job-creating requests', async () => {
    const { http, api } = aClient([route(sequence(status(503), ok({ id: 'a', n: 1 })), 'POST')]);
    await expect(failureOf(http.request(aSpec({ method: 'POST', retry: 'never' }), NO_CONTROL))).resolves.toMatchObject(
      {
        status: 503,
      },
    );
    expect(api.requests()).toHaveLength(1);
  });

  it('skips a retry whose wait plus 3 s would pass the deadline', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const { http, api } = aClient([route(sequence(status(503), ok({ id: 'a', n: 1 })))], { clock });
    const control = { signal: undefined, deadline: clock.now() + 4_999 };
    await expect(failureOf(http.request(aSpec(), control))).resolves.toMatchObject({ status: 503 });
    expect(api.requests()).toHaveLength(1);
  });

  it('allows a retry that fits the deadline exactly', async () => {
    const clock = createFakeClock({ autoAdvance: true });
    const { http, api } = aClient([route(sequence(status(503), ok({ id: 'a', n: 1 })))], { clock });
    const control = { signal: undefined, deadline: clock.now() + 5_000 };
    await expect(http.request(aSpec(), control)).resolves.toEqual({ id: 'a', n: 1 });
    expect(api.requests()).toHaveLength(2);
  });

  it('a client cancel during the backoff stops retrying', async () => {
    const clock = createFakeClock();
    const controller = new AbortController();
    const { http, api } = aClient(
      [
        route(() => {
          setTimeout(() => {
            controller.abort();
          }, 0);
          return status(503);
        }),
      ],
      { clock },
    );
    await expect(failureOf(http.request(aSpec(), { signal: controller.signal, deadline: undefined }))).resolves.toEqual(
      {
        kind: 'aborted',
      },
    );
    expect(api.requests()).toHaveLength(1);
  });
});
