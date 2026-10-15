import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod';
import { createFakeClock } from '../../test/support/clock.js';
import { ok, status } from '../../test/support/fake-api.js';
import {
  TEST_API_KEY,
  TEST_CLIENT_IP,
  createHarness,
  createV1Harness,
  errorJsonOf,
  textOf,
  type HarnessOptions,
} from '../../test/support/harness.js';
import { ApiError, fail } from '../api/errors.js';
import { ipBucketKey } from '../policy/rate-limit.js';
import { hashKey } from '../shaping/redact.js';
import { toSuccessResult } from '../shaping/result.js';
import { defineTool, type ToolContext, type ToolSpec } from './registry.js';

const EchoInput = z.object({
  text: z.string().describe('Text to echo.'),
  secret_flag: z.boolean().optional().describe('Flag.'),
});
const EchoOutput = z.object({ echoed: z.string(), key_hash: z.string() });

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const echoSpec = (
  overrides: Partial<ToolSpec<typeof EchoInput, typeof EchoOutput>> = {},
): ToolSpec<typeof EchoInput, typeof EchoOutput> => ({
  name: 'echo_text',
  toolset: 'account',
  title: 'Echo text',
  description: 'Echoes the text back.',
  annotations: READ_ONLY,
  inputSchema: EchoInput,
  outputSchema: EchoOutput,
  requiresApiKey: false,
  handler: (args, ctx) => Promise.resolve({ echoed: args.text, key_hash: ctx.keyHash }),
  ...overrides,
});

const start = async (options: HarnessOptions & { spec?: ToolSpec<typeof EchoInput, typeof EchoOutput> }) => {
  const harness = await createHarness({ ...options, tools: [defineTool(options.spec ?? echoSpec())] });
  onTestFinished(harness.close);
  return harness;
};

const call = (harness: Awaited<ReturnType<typeof start>>, args: Record<string, unknown> = { text: 'hi' }) =>
  harness.client.callTool({ name: 'echo_text', arguments: args });

describe('registered tools', () => {
  it('lists the tool with title, all four annotations and both schemas', async () => {
    const harness = await start({});
    const { tools } = await harness.client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      name: 'echo_text',
      title: 'Echo text',
      description: 'Echoes the text back.',
      annotations: { title: 'Echo text', ...READ_ONLY },
      inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Text to echo.' } } },
      outputSchema: { type: 'object', additionalProperties: false },
    });
  });

  it('describe() matches the live tools/list entry', async () => {
    const tool = defineTool(echoSpec());
    const harness = await createHarness({ tools: [tool] });
    onTestFinished(harness.close);
    const { tools } = await harness.client.listTools();
    expect(tools[0]).toEqual(tool.describe(harness.config));
  });

  it('exposes toolset, read-only flag and key requirement for filtering', () => {
    const tool = defineTool(echoSpec({ requiresApiKey: true, toolset: 'clips' }));
    expect({
      name: tool.name,
      toolset: tool.toolset,
      readOnly: tool.readOnly,
      requiresApiKey: tool.requiresApiKey,
    }).toEqual({
      name: 'echo_text',
      toolset: 'clips',
      readOnly: true,
      requiresApiKey: true,
    });
  });

  it('uses the directory input schema in the directory profile', async () => {
    const directoryInputSchema = EchoInput.omit({ secret_flag: true });
    const spec = echoSpec({ directoryInputSchema });
    const plain = await start({ spec });
    const directory = await start({ spec, config: { directory: true, profile: 'directory' } });
    const [plainTool] = (await plain.client.listTools()).tools;
    const [directoryTool] = (await directory.client.listTools()).tools;
    expect(Object.keys(plainTool?.inputSchema.properties ?? {})).toEqual(['text', 'secret_flag']);
    expect(Object.keys(directoryTool?.inputSchema.properties ?? {})).toEqual(['text']);
    expect(defineTool(spec).describe({ ...directory.config }).inputSchema).toEqual(directoryTool?.inputSchema);
  });
});

describe('successful calls', () => {
  it('returns structuredContent and the same JSON as text, without stray keys', async () => {
    const harness = await start({
      spec: echoSpec({
        handler: (args, ctx) => Promise.resolve({ echoed: args.text, key_hash: ctx.keyHash, stray: 1 }),
      }),
    });
    const result = await call(harness);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ echoed: 'hi', key_hash: hashKey(TEST_API_KEY) });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  });

  it.each(['modern', 'legacy'] as const)('works over HTTP in the %s era', async (era) => {
    const harness = await start({ era });
    expect((await call(harness)).structuredContent).toMatchObject({ echoed: 'hi' });
  });

  it.each(['modern', 'legacy'] as const)('works over stdio in the %s era', async (era) => {
    const harness = await start({ era, transport: 'stdio' });
    expect((await call(harness)).structuredContent).toMatchObject({ echoed: 'hi' });
  });

  it('passes v1 client validation', async () => {
    const harness = await createV1Harness({ tools: [defineTool(echoSpec())] });
    onTestFinished(harness.close);
    const result = await harness.client.callTool({ name: 'echo_text', arguments: { text: 'v1' } });
    expect(result.structuredContent).toMatchObject({ echoed: 'v1' });
  });
});

describe('tenant identity', () => {
  it('uses the full key hash with a key', async () => {
    const harness = await start({});
    expect((await call(harness)).structuredContent).toMatchObject({ key_hash: hashKey(TEST_API_KEY) });
  });

  it('uses the IP bucket on HTTP without a key', async () => {
    const harness = await start({ apiKey: undefined });
    expect((await call(harness)).structuredContent).toMatchObject({ key_hash: `ip:${ipBucketKey(TEST_CLIENT_IP)}` });
  });

  it('uses an unknown-address bucket on HTTP without a client IP', async () => {
    const harness = await start({ apiKey: undefined, clientIp: undefined });
    expect((await call(harness)).structuredContent).toMatchObject({ key_hash: 'ip:unknown' });
  });

  it('is anonymous on stdio without a key', async () => {
    const harness = await start({ apiKey: undefined, transport: 'stdio' });
    expect((await call(harness)).structuredContent).toMatchObject({ key_hash: 'anonymous' });
  });

  it('gives the handler a 52 s budget and the client signal', async () => {
    const clock = createFakeClock();
    const seen: ToolContext[] = [];
    const abortedDuringCall: boolean[] = [];
    const harness = await start({
      clock,
      spec: echoSpec({
        handler: (args, ctx) => {
          seen.push(ctx);
          abortedDuringCall.push(ctx.signal.aborted);
          return Promise.resolve({ echoed: args.text, key_hash: '' });
        },
      }),
    });
    await call(harness);
    expect(seen[0]?.startedAt).toBe(clock.now());
    expect(seen[0]?.deadline).toBe(clock.now() + 52_000);
    expect(abortedDuringCall).toEqual([false]);
    expect(seen[0]?.hasApiKey).toBe(true);
    expect(seen[0]?.config).toBe(harness.config);
  });
});

describe('API key checks', () => {
  const keyed = echoSpec({ requiresApiKey: true });

  it('refuses tools that need a key when none is configured, without calling the handler', async () => {
    const handler = vi.fn(echoSpec().handler);
    const harness = await start({ apiKey: undefined, spec: { ...keyed, handler } });
    const result = await call(harness);
    expect(result.isError).toBe(true);
    expect(result).not.toHaveProperty('structuredContent');
    expect(textOf(result)).toMatch(/^Error \[missing_api_key\]: No MnogoReels API key is configured/);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(['mrfrt_svc_abcdefghijklmnopqrst', 'mrfrt_usr_short', 'sk-not-ours-1234567890'])(
    'refuses malformed key %s',
    async (apiKey) => {
      const harness = await start({ apiKey, spec: keyed });
      expect(textOf(await call(harness))).toMatch(/^Error \[invalid_api_key_format\]:/);
    },
  );

  it('lets key-optional tools run without a key', async () => {
    const harness = await start({ apiKey: undefined });
    expect((await call(harness)).isError).toBeFalsy();
  });
});

describe('error results', () => {
  it('renders ToolFailure as a text-only error', async () => {
    const harness = await start({
      spec: echoSpec({
        handler: () => Promise.resolve(fail('invalid_arguments', 'text must not be empty', { field: 'text' })),
      }),
    });
    const result = await call(harness);
    expect({ content: result.content, isError: result.isError, structuredContent: result.structuredContent }).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error [invalid_arguments]: text must not be empty\n{"error":{"code":"invalid_arguments","message":"text must not be empty","retryable":false,"retry_after_sec":null,"details":{"field":"text"}}}',
        },
      ],
      isError: true,
      structuredContent: undefined,
    });
  });

  it('maps backend failures using the request operation and resource', async () => {
    const harness = await start({
      routes: [{ method: 'GET', path: '/videos/abc', respond: () => status(404, 'Not found') }],
      spec: echoSpec({
        handler: async (_args, ctx) => {
          await ctx.http.request(
            {
              method: 'GET',
              path: '/videos/abc',
              schema: z.object({}),
              auth: 'api_key',
              timeoutMs: 20_000,
              retry: 'safe',
              resource: 'clip job',
            },
            { signal: ctx.signal, deadline: ctx.deadline },
          );
          return { echoed: '', key_hash: '' };
        },
      }),
    });
    const result = await call(harness);
    expect(textOf(result)).toMatch(/^Error \[not_found\]: No clip job with this id exists/);
    expect(errorJsonOf(result)).toMatchObject({ error: { code: 'not_found', retryable: false } });
  });

  it('treats retry=never requests as submissions', async () => {
    const harness = await start({
      routes: [{ method: 'POST', path: '/videos', respond: () => status(500, 'boom') }],
      spec: echoSpec({
        handler: async (_args, ctx) => {
          await ctx.http.request(
            {
              method: 'POST',
              path: '/videos',
              schema: z.object({}),
              auth: 'api_key',
              timeoutMs: 30_000,
              retry: 'never',
              resource: 'clip job',
            },
            { signal: undefined, deadline: undefined },
          );
          return { echoed: '', key_hash: '' };
        },
      }),
    });
    expect(textOf(await call(harness))).toMatch(
      /^Error \[outcome_unknown\]: MnogoReels returned an internal error while creating the clip job/,
    );
  });

  it('reports unexpected exceptions as internal_error with a logged error id', async () => {
    const harness = await start({
      spec: echoSpec({ handler: () => Promise.reject(new TypeError(`bad ${TEST_API_KEY}`)) }),
    });
    const text = textOf(await call(harness));
    const errorId = /\(([0-9a-f]{8})\)/.exec(text)?.[1];
    expect(text).toMatch(
      /^Error \[internal_error\]: Unexpected server error \([0-9a-f]{8}\)\. Nothing was charged unless a job id was returned\./,
    );
    expect(harness.logs.entries().find((entry) => JSON.stringify(entry).includes(String(errorId)))).toMatchObject({
      level: 'error',
      event: 'internal_error',
    });
    expect(errorJsonOf(await call(harness))).toMatchObject({ error: { retryable: false } });
    expect(harness.logs.text()).not.toContain(TEST_API_KEY);
  });

  it('treats other DOM exceptions as internal errors', async () => {
    const harness = await start({
      spec: echoSpec({ handler: () => Promise.reject(new DOMException('cannot clone', 'DataCloneError')) }),
    });
    expect(textOf(await call(harness))).toMatch(/^Error \[internal_error\]:/);
  });

  it('maps an abort that is not a client cancel to upstream_timeout', async () => {
    const harness = await start({
      spec: echoSpec({ handler: () => Promise.reject(new DOMException('timed out', 'AbortError')) }),
    });
    const result = await call(harness);
    expect(textOf(result)).toMatch(/^Error \[upstream_timeout\]: MnogoReels did not answer in time\./);
    expect(errorJsonOf(result)).toMatchObject({ error: { retryable: true } });
  });

  it('maps a TimeoutError to upstream_timeout', async () => {
    const harness = await start({
      spec: echoSpec({ handler: () => Promise.reject(new DOMException('timed out', 'TimeoutError')) }),
    });
    expect(textOf(await call(harness))).toMatch(/^Error \[upstream_timeout\]:/);
  });

  it('maps an ApiError deadline on a read to upstream_timeout', async () => {
    const harness = await start({
      spec: echoSpec({ handler: () => Promise.reject(new ApiError({ kind: 'deadline' })) }),
    });
    expect(textOf(await call(harness))).toMatch(/^Error \[upstream_timeout\]:/);
  });

  it('rejects arguments that fail the schema with an SDK error result', async () => {
    const harness = await start({});
    const result = await call(harness, { text: 42 });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('text');
  });
});

describe('rate limits', () => {
  it('allows 60 calls per minute per tenant, then refuses with retry_after_sec', async () => {
    const harness = await start({ clock: createFakeClock() });
    const results = await Array.from({ length: 61 }, () => () => call(harness)).reduce<Promise<unknown[]>>(
      async (all, next) => [...(await all), await next()],
      Promise.resolve([]),
    );
    expect(results.slice(0, 60).every((result) => textOf(result).startsWith('{'))).toBe(true);
    expect(textOf(results[60])).toBe(
      'Error [rate_limited_local]: Too many tool calls with this API key. Retry in 60 s.\n{"error":{"code":"rate_limited_local","message":"Too many tool calls with this API key.","retryable":true,"retry_after_sec":60}}',
    );
  });

  it('applies the tool bucket', async () => {
    const harness = await start({ spec: echoSpec({ rateLimit: { bucket: 'paid', limit: 2, windowSec: 3600 } }) });
    await call(harness);
    await call(harness);
    expect(textOf(await call(harness))).toMatch(
      /^Error \[rate_limited_local\]: Too many paid calls with this API key\. Retry in 3600 s\./,
    );
  });

  it('limits key-optional tools on HTTP by client IP even when keys rotate', async () => {
    const clock = createFakeClock();
    const spec = echoSpec({ rateLimit: { bucket: 'probe', limit: 1, windowSec: 60 } });
    const first = await start({ clock, spec, apiKey: 'mrfrt_usr_RotatingKeyNumberOne0001' });
    await call(first);
    const second = await start({ clock, spec, apiKey: 'mrfrt_usr_RotatingKeyNumberTwo0002', deps: first.deps });
    expect(textOf(await call(second))).toMatch(
      /^Error \[rate_limited_local\]: Too many probe calls from this address\./,
    );
  });

  it('applies the tool bucket to key-required tools', async () => {
    const harness = await start({
      spec: echoSpec({ requiresApiKey: true, rateLimit: { bucket: 'paid', limit: 1, windowSec: 3600 } }),
    });
    await call(harness);
    expect(textOf(await call(harness))).toMatch(
      /^Error \[rate_limited_local\]: Too many paid calls with this API key\./,
    );
  });

  it('limits keyless HTTP calls by address', async () => {
    const harness = await start({
      apiKey: undefined,
      spec: echoSpec({ rateLimit: { bucket: 'probe', limit: 1, windowSec: 60 } }),
    });
    await call(harness);
    expect(textOf(await call(harness))).toMatch(
      /^Error \[rate_limited_local\]: Too many probe calls from this address\./,
    );
  });

  it('counts a keyless HTTP call once against the address bucket', async () => {
    const harness = await start({
      apiKey: undefined,
      spec: echoSpec({ rateLimit: { bucket: 'probe', limit: 2, windowSec: 60 } }),
    });
    await call(harness);
    expect((await call(harness)).isError).toBeFalsy();
    expect(textOf(await call(harness))).toMatch(/^Error \[rate_limited_local\]: Too many probe calls/);
  });

  it('keeps the address buckets of different addresses apart', async () => {
    const clock = createFakeClock();
    const spec = echoSpec({ rateLimit: { bucket: 'probe', limit: 1, windowSec: 60 } });
    const first = await start({ clock, spec, apiKey: 'mrfrt_usr_RotatingKeyNumberOne0001', clientIp: '198.51.100.1' });
    await call(first);
    const second = await start({
      clock,
      spec,
      apiKey: 'mrfrt_usr_RotatingKeyNumberTwo0002',
      clientIp: '192.0.2.77',
      deps: first.deps,
    });
    expect((await call(second)).isError).toBeFalsy();
  });

  it('does not share buckets between keys on stdio', async () => {
    const clock = createFakeClock();
    const spec = echoSpec({ rateLimit: { bucket: 'probe', limit: 1, windowSec: 60 } });
    const first = await start({ clock, spec, transport: 'stdio', apiKey: 'mrfrt_usr_RotatingKeyNumberOne0001' });
    await call(first);
    const second = await start({
      clock,
      spec,
      transport: 'stdio',
      apiKey: 'mrfrt_usr_RotatingKeyNumberTwo0002',
      deps: first.deps,
    });
    expect((await call(second)).isError).toBeFalsy();
  });

  it('limits key-required tools by key, not by IP', async () => {
    const clock = createFakeClock();
    const spec = echoSpec({ requiresApiKey: true, rateLimit: { bucket: 'paid', limit: 1, windowSec: 60 } });
    const first = await start({ clock, spec, apiKey: 'mrfrt_usr_RotatingKeyNumberOne0001' });
    await call(first);
    const second = await start({ clock, spec, apiKey: 'mrfrt_usr_RotatingKeyNumberTwo0002', deps: first.deps });
    expect((await call(second)).isError).toBeFalsy();
  });
});

describe('progress', () => {
  const progressSpec = echoSpec({
    handler: async (args, ctx) => {
      await ctx.reportProgress({ elapsedSec: 1, totalSec: 30, message: 'processing 10%' });
      await ctx.reportProgress({ elapsedSec: 2.5, totalSec: 30, message: 'processing 20%' });
      return { echoed: args.text, key_hash: '' };
    },
  });

  it.each([
    ['http', 'modern'],
    ['http', 'legacy'],
    ['stdio', 'legacy'],
  ] as const)('sends progress notifications when the client asks (%s %s)', async (transport, era) => {
    const harness = await start({ spec: progressSpec, transport, era });
    const updates: unknown[] = [];
    await harness.client.callTool(
      { name: 'echo_text', arguments: { text: 'p' } },
      { onprogress: (progress) => updates.push(progress) },
    );
    expect(updates).toEqual([
      { progress: 1, total: 30, message: 'processing 10%' },
      { progress: 2.5, total: 30, message: 'processing 20%' },
    ]);
  });

  it('is a no-op without a progress token', async () => {
    const harness = await start({ spec: progressSpec });
    expect((await call(harness)).isError).toBeFalsy();
  });
});

describe('spend confirmation plumbing', () => {
  const spendSpec = echoSpec({
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    handler: (args, ctx) => {
      const decision = ctx.confirmSpend({ credits: 3, message: 'Spend 3 credits?' });
      if (decision.kind === 'ask') return Promise.resolve(decision.result);
      return Promise.resolve({ echoed: decision.kind, key_hash: '' });
    },
  });

  const FORM = { elicitation: { form: {} } };

  it.each([
    ['stdio', 'legacy'],
    ['stdio', 'modern'],
    ['http', 'modern'],
  ] as const)('asks the user through elicitation (%s %s) and proceeds on accept', async (transport, era) => {
    const asked: string[] = [];
    const harness = await start({
      spec: spendSpec,
      transport,
      era,
      clientCapabilities: FORM,
      onElicit: (request) => {
        asked.push(request.params.message);
        return { action: 'accept', content: { confirm: true } };
      },
    });
    expect((await call(harness)).structuredContent).toMatchObject({ echoed: 'proceed' });
    expect(asked).toEqual(['Spend 3 credits?']);
    expect(
      harness.logs
        .entries()
        .filter((entry) => entry['event'] === 'tool_call')
        .map((entry) => entry['code']),
    ).toEqual(['input_required', 'ok']);
  });

  it.each([
    ['stdio', 'legacy'],
    ['stdio', 'modern'],
    ['http', 'modern'],
  ] as const)('counts a confirmed call once against the tool bucket (%s %s)', async (transport, era) => {
    const harness = await start({
      spec: { ...spendSpec, rateLimit: { bucket: 'paid', limit: 1, windowSec: 3600 } },
      transport,
      era,
      clientCapabilities: FORM,
      onElicit: () => ({ action: 'accept', content: { confirm: true } }),
    });
    expect((await call(harness)).structuredContent).toMatchObject({ echoed: 'proceed' });
    expect(textOf(await call(harness))).toMatch(
      /^Error \[rate_limited_local\]: Too many paid calls with this API key\./,
    );
  });

  it.each([
    ['stdio', 'legacy'],
    ['http', 'modern'],
  ] as const)('reports a decline (%s %s)', async (transport, era) => {
    const harness = await start({
      spec: spendSpec,
      transport,
      era,
      clientCapabilities: FORM,
      onElicit: () => ({ action: 'decline' }),
    });
    expect((await call(harness)).structuredContent).toMatchObject({ echoed: 'declined' });
  });

  it('proceeds without asking on HTTP with a 2025-era client', async () => {
    const onElicit = vi.fn(() => ({ action: 'accept' as const, content: { confirm: true } }));
    const harness = await start({ spec: spendSpec, era: 'legacy', clientCapabilities: FORM, onElicit });
    expect((await call(harness)).structuredContent).toMatchObject({ echoed: 'proceed' });
    expect(onElicit).not.toHaveBeenCalled();
  });

  it('proceeds without asking when the client cannot elicit', async () => {
    const harness = await start({ spec: spendSpec, transport: 'stdio' });
    expect((await call(harness)).structuredContent).toMatchObject({ echoed: 'proceed' });
  });

  it('works with the v1 client over stdio', async () => {
    const harness = await createV1Harness({
      tools: [defineTool(spendSpec)],
      clientCapabilities: FORM,
      onElicit: () => ({ action: 'accept', content: { confirm: true } }),
    });
    onTestFinished(harness.close);
    const result = await harness.client.callTool({ name: 'echo_text', arguments: { text: 'x' } });
    expect(result.structuredContent).toMatchObject({ echoed: 'proceed' });
  });
});

describe('cancellation', () => {
  it('stops the handler and sends no result when the client cancels', async () => {
    const seen: AbortSignal[] = [];
    const harness = await start({
      transport: 'stdio',
      spec: echoSpec({
        handler: (_args, ctx) =>
          new Promise((_resolve, reject) => {
            seen.push(ctx.signal);
            ctx.signal.addEventListener('abort', () => {
              reject(new DOMException('cancelled', 'AbortError'));
            });
          }),
      }),
    });
    const controller = new AbortController();
    const pending = harness.client.callTool(
      { name: 'echo_text', arguments: { text: 'x' } },
      { signal: controller.signal },
    );
    await vi.waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    await vi.waitFor(() => {
      expect(seen[0]?.aborted).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(harness.logs.entries().filter((entry) => entry['event'] === 'tool_call')).toEqual([]);
  });
});

describe('logging', () => {
  it('logs one line per call with the code, duration and key prefix, never the key or arguments', async () => {
    const harness = await start({ spec: echoSpec({ requiresApiKey: true }) });
    await call(harness, { text: 'https://example.com/v?token=SECRETARG' });
    const lines = harness.logs.entries().filter((entry) => entry['event'] === 'tool_call');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      tool: 'echo_text',
      code: 'ok',
      key: hashKey(TEST_API_KEY).slice(0, 8),
    });
    expect(typeof lines[0]?.['ms']).toBe('number');
    expect(harness.logs.text()).not.toContain('SECRETARG');
    expect(harness.logs.text()).not.toContain(TEST_API_KEY);
  });

  it('logs the error code and the IP prefix on HTTP', async () => {
    const harness = await start({ apiKey: undefined, spec: echoSpec({ requiresApiKey: true }) });
    await call(harness);
    expect(harness.logs.entries().find((entry) => entry['event'] === 'tool_call')).toMatchObject({
      code: 'missing_api_key',
      level: 'warn',
      ip: '203.0.113.0/24',
    });
  });

  const resultLength = (echoed: string) => JSON.stringify(toSuccessResult(EchoOutput, { echoed, key_hash: '' })).length;

  const echoedForResultLength = (target: number): string => {
    const exact = ['', '\u0001']
      .map((suffix) => 'x'.repeat(Math.floor((target - resultLength(suffix)) / 2)) + suffix)
      .find((echoed) => resultLength(echoed) === target);
    if (exact === undefined) throw new Error(`cannot build a result of ${String(target)} characters`);
    return exact;
  };

  const oversizeEntries = async (echoed: string) => {
    const harness = await start({
      spec: echoSpec({ handler: () => Promise.resolve({ echoed, key_hash: '' }) }),
    });
    await call(harness);
    return harness.logs.entries().filter((entry) => entry['event'] === 'oversize_result');
  };

  it('flags results over 60 000 characters', async () => {
    expect(await oversizeEntries(echoedForResultLength(60_001))).toMatchObject([
      { level: 'warn', tool: 'echo_text', chars: 60_001 },
    ]);
  });

  it('does not flag results at the limit', async () => {
    expect(await oversizeEntries(echoedForResultLength(60_000))).toEqual([]);
  });

  it('logs the duration from the call start', async () => {
    const clock = createFakeClock();
    const harness = await start({
      clock,
      spec: echoSpec({
        handler: (args) => {
          clock.advance(1_234);
          return Promise.resolve({ echoed: args.text, key_hash: '' });
        },
      }),
    });
    await call(harness);
    expect(harness.logs.entries().find((entry) => entry['event'] === 'tool_call')).toMatchObject({ ms: 1_234 });
  });
});

describe('fetching through the tool context', () => {
  it('binds the key and the API URL', async () => {
    const harness = await start({
      routes: [{ method: 'GET', path: '/videos', respond: () => ok({ items: [] }) }],
      spec: echoSpec({
        handler: async (_args, ctx) => {
          await ctx.http.request(
            {
              method: 'GET',
              path: '/videos',
              schema: z.object({ items: z.array(z.unknown()) }),
              auth: 'api_key',
              timeoutMs: 20_000,
              retry: 'safe',
            },
            { signal: ctx.signal, deadline: ctx.deadline },
          );
          return { echoed: 'ok', key_hash: '' };
        },
      }),
    });
    await call(harness);
    expect(harness.api.requests()[0]).toMatchObject({ path: '/videos', authorized: true });
  });
});
