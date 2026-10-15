import {
  isInputRequiredResult,
  type CallToolResult,
  type InputRequiredResult,
  type McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { ApiError, MESSAGES, ToolFailure, mapApiFailure } from '../api/errors.js';
import { createHttp, forwardedForValue, type Http } from '../api/http.js';
import type { EffectiveConfig, ToolsetName } from '../config.js';
import { supportsFormElicitation, legacyClientCapabilities } from '../policy/elicitation.js';
import { ipBucketKey, ipLogPrefix, type RateRule } from '../policy/rate-limit.js';
import { decideSpendConfirmation, type SpendDecision } from '../policy/spend.js';
import type { Deps } from '../runtime/deps.js';
import type { ProgressUpdate } from '../runtime/poll.js';
import { hashKey, isWellFormedUserKey, logKey, maskKey } from '../shaping/redact.js';
import { toErrorResult, toSuccessResult, type ToolErrorInfo } from '../shaping/result.js';

export type { SpendDecision } from '../policy/spend.js';

export type ToolAnnotationsFull = {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
};

export type ApiKeyStatus = 'missing' | 'invalid_format' | 'well_formed';

export type ToolContext = {
  readonly http: Http;
  readonly hasApiKey: boolean;
  readonly apiKeyStatus: ApiKeyStatus;
  readonly apiKeyHint: string | null;
  readonly keyHash: string;
  readonly config: EffectiveConfig;
  readonly deps: Deps;
  readonly signal: AbortSignal;
  readonly deadline: number;
  readonly startedAt: number;
  readonly reportProgress: (update: ProgressUpdate) => Promise<void>;
  readonly confirmSpend: (request: { readonly credits: number; readonly message: string }) => SpendDecision;
};

export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export type ToolSpec<I extends z.ZodObject, O extends z.ZodObject> = {
  readonly name: string;
  readonly toolset: ToolsetName;
  readonly title: string;
  readonly description: string;
  readonly annotations: ToolAnnotationsFull;
  readonly inputSchema: I;
  readonly directoryInputSchema?: z.ZodType<z.output<I>>;
  readonly outputSchema: O;
  readonly requiresApiKey: boolean;
  readonly rateLimit?: { readonly bucket: string; readonly limit: number; readonly windowSec: number };
  readonly handler: (args: z.output<I>, ctx: ToolContext) => Promise<DeepReadonly<z.output<O>> | InputRequiredResult>;
};

export type ToolRuntime = {
  readonly config: EffectiveConfig;
  readonly apiKey: string | undefined;
  readonly clientIp: string | undefined;
  readonly deps: Deps;
};

export type ToolDescription = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly outputSchema: Record<string, unknown>;
  readonly annotations: ToolAnnotationsFull & { readonly title: string };
};

export type RegistrableTool = {
  readonly name: string;
  readonly toolset: ToolsetName;
  readonly readOnly: boolean;
  readonly requiresApiKey: boolean;
  readonly describe: (config: EffectiveConfig) => ToolDescription;
  readonly register: (server: McpServer, runtime: ToolRuntime) => void;
};

export type ToolsetDefinition = { readonly name: ToolsetName; readonly tools: readonly RegistrableTool[] };

const TOOL_BUDGET_MS = 52_000;
const OVERSIZE_RESULT_CHARS = 60_000;
const GLOBAL_RULE: RateRule = { limit: 60, windowSec: 60 };
const JSON_SCHEMA_TARGET = { target: 'draft-2020-12' } as const;

type StandardJson = {
  readonly '~standard': {
    readonly jsonSchema: {
      readonly input: (options: typeof JSON_SCHEMA_TARGET) => Record<string, unknown>;
      readonly output: (options: typeof JSON_SCHEMA_TARGET) => Record<string, unknown>;
    };
  };
};

const inputJsonSchema = (schema: StandardJson): Record<string, unknown> => ({
  ...schema['~standard'].jsonSchema.input(JSON_SCHEMA_TARGET),
  type: 'object',
});

const outputJsonSchema = (schema: StandardJson): Record<string, unknown> =>
  schema['~standard'].jsonSchema.output(JSON_SCHEMA_TARGET);

const tenantOf = (runtime: ToolRuntime): string => {
  if (runtime.apiKey !== undefined) return hashKey(runtime.apiKey);
  return runtime.config.transport === 'http' ? `ip:${ipBucketKey(runtime.clientIp ?? 'unknown')}` : 'anonymous';
};

type LimitKey = { readonly key: string; readonly scope: 'key' | 'address' };

const limitKeys = (runtime: ToolRuntime, requiresApiKey: boolean): readonly LimitKey[] => {
  const tenant: LimitKey = { key: tenantOf(runtime), scope: runtime.apiKey === undefined ? 'address' : 'key' };
  if (runtime.config.transport !== 'http' || requiresApiKey || runtime.apiKey === undefined) return [tenant];
  return [tenant, { key: `ip:${ipBucketKey(runtime.clientIp ?? 'unknown')}`, scope: 'address' }];
};

const checkRateLimits = (
  runtime: ToolRuntime,
  spec: { readonly requiresApiKey: boolean; readonly rateLimit?: ToolSpec<z.ZodObject, z.ZodObject>['rateLimit'] },
): readonly string[] => {
  const rules = [
    { bucket: 'all', rule: GLOBAL_RULE },
    ...(spec.rateLimit ? [{ bucket: spec.rateLimit.bucket, rule: spec.rateLimit }] : []),
  ];
  return rules.flatMap(({ bucket, rule }) =>
    limitKeys(runtime, spec.requiresApiKey).map(({ key, scope }) => {
      const bucketKey = `${key}:${bucket}`;
      const decision = runtime.deps.limiter.hit(bucketKey, rule);
      if (decision.allowed) return bucketKey;
      const label = bucket === 'all' ? 'tool' : bucket;
      throw new ToolFailure({
        code: 'rate_limited_local',
        message: `Too many ${label} calls ${scope === 'key' ? 'with this API key' : 'from this address'}.`,
        retryAfterSec: decision.retryAfterSec,
      });
    }),
  );
};

const apiKeyStatusOf = (apiKey: string | undefined): ApiKeyStatus => {
  if (apiKey === undefined) return 'missing';
  return isWellFormedUserKey(apiKey) ? 'well_formed' : 'invalid_format';
};

const checkApiKey = (apiKey: string | undefined): void => {
  const keyStatus = apiKeyStatusOf(apiKey);
  if (keyStatus === 'missing') throw new ToolFailure({ code: 'missing_api_key', message: MESSAGES.missing_api_key });
  if (keyStatus === 'invalid_format') {
    throw new ToolFailure({ code: 'invalid_api_key_format', message: MESSAGES.invalid_api_key_format });
  }
};

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');

const failureInfo = (error: unknown, runtime: ToolRuntime): ToolErrorInfo => {
  if (error instanceof ToolFailure) return error;
  if (error instanceof ApiError)
    return mapApiFailure(error.failure, { ...error.context, apiUrl: runtime.config.apiUrl });
  if (isAbort(error)) return { code: 'upstream_timeout', message: MESSAGES.upstream_timeout, retryable: true };
  const errorId = runtime.deps.logger.errorOf('internal_error', error);
  return {
    code: 'internal_error',
    message: `Unexpected server error (${errorId}). Nothing was charged unless a job id was returned.`,
    retryable: false,
  };
};

const buildContext = (server: McpServer, ctx: ServerContext, runtime: ToolRuntime): ToolContext => {
  const startedAt = runtime.deps.clock.now();
  const progressToken = ctx.mcpReq._meta?.progressToken;
  return {
    http: createHttp({
      baseUrl: runtime.config.apiUrl,
      apiKey: runtime.apiKey,
      forwardedFor: forwardedForValue({
        transport: runtime.config.transport,
        apiKey: runtime.apiKey,
        clientIp: runtime.clientIp,
      }),
      deps: runtime.deps,
    }),
    hasApiKey: runtime.apiKey !== undefined,
    apiKeyStatus: apiKeyStatusOf(runtime.apiKey),
    apiKeyHint: runtime.apiKey === undefined ? null : maskKey(runtime.apiKey),
    keyHash: tenantOf(runtime),
    config: runtime.config,
    deps: runtime.deps,
    signal: ctx.mcpReq.signal,
    deadline: startedAt + TOOL_BUDGET_MS,
    startedAt,
    reportProgress: async (update) => {
      if (progressToken === undefined) return;
      await ctx.mcpReq.notify({
        method: 'notifications/progress',
        params: { progressToken, progress: update.elapsedSec, total: update.totalSec, message: update.message },
      });
    },
    confirmSpend: (request) =>
      decideSpendConfirmation({
        supportsForm: supportsFormElicitation({
          envelope: ctx.mcpReq.envelope,
          legacyCapabilities: legacyClientCapabilities(server),
        }),
        inputResponses: ctx.mcpReq.inputResponses,
        message: request.message,
      }),
  };
};

const logCall = (
  runtime: ToolRuntime,
  entry: { readonly tool: string; readonly code: string; readonly startedAt: number; readonly chars: number },
): void => {
  const fields = {
    tool: entry.tool,
    code: entry.code,
    ms: runtime.deps.clock.now() - entry.startedAt,
    key: runtime.apiKey === undefined ? undefined : logKey(runtime.apiKey),
    ip: runtime.clientIp === undefined ? undefined : ipLogPrefix(runtime.clientIp),
  };
  if (entry.code === 'ok') runtime.deps.logger.info('tool_call', fields);
  else runtime.deps.logger.warn('tool_call', fields);
  if (entry.chars > OVERSIZE_RESULT_CHARS)
    runtime.deps.logger.warn('oversize_result', { tool: entry.tool, chars: entry.chars });
};

const runTool = async <I extends z.ZodObject, O extends z.ZodObject>(
  spec: ToolSpec<I, O>,
  args: z.output<I>,
  ctx: ServerContext,
  server: McpServer,
  runtime: ToolRuntime,
): Promise<CallToolResult | InputRequiredResult> => {
  const context = buildContext(server, ctx, runtime);
  const finish = (result: CallToolResult | InputRequiredResult, code: string) => {
    logCall(runtime, { tool: spec.name, code, startedAt: context.startedAt, chars: JSON.stringify(result).length });
    return result;
  };
  try {
    if (spec.requiresApiKey) checkApiKey(runtime.apiKey);
    const counted = checkRateLimits(runtime, spec);
    const value = await spec.handler(args, context);
    if (isInputRequiredResult(value)) {
      counted.forEach((key) => {
        runtime.deps.limiter.release(key);
      });
      return finish(value, 'input_required');
    }
    return finish(toSuccessResult(spec.outputSchema, value), 'ok');
  } catch (error) {
    if (ctx.mcpReq.signal.aborted) throw error;
    const info = failureInfo(error, runtime);
    return finish(toErrorResult(info), info.code);
  }
};

export const defineTool = <I extends z.ZodObject, O extends z.ZodObject>(spec: ToolSpec<I, O>): RegistrableTool => {
  const inputFor = (config: EffectiveConfig): I | z.ZodType<z.output<I>> =>
    config.directory && spec.directoryInputSchema ? spec.directoryInputSchema : spec.inputSchema;

  return {
    name: spec.name,
    toolset: spec.toolset,
    readOnly: spec.annotations.readOnlyHint,
    requiresApiKey: spec.requiresApiKey,
    describe: (config) => ({
      name: spec.name,
      title: spec.title,
      description: spec.description,
      inputSchema: inputJsonSchema(inputFor(config)),
      outputSchema: outputJsonSchema(spec.outputSchema),
      annotations: { title: spec.title, ...spec.annotations },
    }),
    register: (server, runtime) => {
      server.registerTool(
        spec.name,
        {
          title: spec.title,
          description: spec.description,
          inputSchema: inputFor(runtime.config),
          outputSchema: spec.outputSchema,
          annotations: { title: spec.title, ...spec.annotations },
        },
        (args: z.output<I>, ctx: ServerContext) => runTool(spec, args, ctx, server, runtime),
      );
    },
  };
};

export const registerToolsets = (options: {
  readonly server: McpServer;
  readonly tools: readonly RegistrableTool[];
  readonly runtime: ToolRuntime;
}): void => {
  options.tools.forEach((tool) => {
    tool.register(options.server, options.runtime);
  });
};
