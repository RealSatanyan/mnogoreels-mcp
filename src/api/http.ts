import type { z } from 'zod';
import type { Deps } from '../runtime/deps.js';
import { hashKey, isWellFormedUserKey } from '../shaping/redact.js';
import { VERSION } from '../version.js';
import { ApiError, ErrorBodySchema, type ApiFailure, type RequestContext } from './errors.js';

export type RequestSpec<S extends z.ZodType> = {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly body?:
    | { readonly kind: 'json'; readonly value: unknown }
    | { readonly kind: 'form'; readonly fields: Readonly<Record<string, string | undefined>> };
  readonly schema: S;
  readonly auth: 'api_key' | 'none';
  readonly timeoutMs: number;
  readonly maxBytes?: number;
  readonly retry: 'safe' | 'probe' | 'never';
  readonly forwardFor?: boolean;
  readonly resource?: string;
};

export type RequestControl = {
  readonly signal: AbortSignal | undefined;
  readonly deadline: number | undefined;
};

export type Http = {
  readonly request: <S extends z.ZodType>(spec: RequestSpec<S>, control: RequestControl) => Promise<z.output<S>>;
};

export type HttpDeps = Pick<Deps, 'fetch' | 'clock' | 'logger'>;

export const USER_AGENT = `mnogoreels-mcp/${VERSION} (+https://github.com/RealSatanyan/mnogoreels-mcp)`;

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const ERROR_BODY_MAX_BYTES = 64 * 1024;
const MIN_ATTEMPT_MS = 3_000;
const SAFETY_MARGIN_MS = 1_000;
const BACKOFF_MS = [1_000, 3_000];
const LAST_BACKOFF_MS = 3_000;
const NEVER_ABORTED = new AbortController().signal;
const MAX_RETRY_AFTER_SEC = 10;
const SAFE_RETRY_STATUSES = new Set([502, 503, 504, 524]);

export const forwardedForValue = (options: {
  readonly transport: 'stdio' | 'http';
  readonly apiKey: string | undefined;
  readonly clientIp: string | undefined;
}): string | undefined => {
  if (options.transport !== 'http') return undefined;
  return options.apiKey !== undefined && isWellFormedUserKey(options.apiKey)
    ? `mcp-${hashKey(options.apiKey).slice(0, 16)}`
    : options.clientIp;
};

type Attempt<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: ApiFailure };

const failed = <T>(failure: ApiFailure): Attempt<T> => ({ ok: false, failure });

const readCapped = async (response: Response, maxBytes: number): Promise<string | undefined> => {
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  const read = async (total: number): Promise<number> => {
    const chunk = await reader.read();
    const value: unknown = chunk.value;
    if (chunk.done || !(value instanceof Uint8Array)) return total;
    chunks.push(value);
    if (total + value.byteLength > maxBytes) {
      await reader.cancel();
      return Number.POSITIVE_INFINITY;
    }
    return read(total + value.byteLength);
  };
  const total = await read(0);
  return Number.isFinite(total) ? Buffer.concat(chunks).toString('utf8') : undefined;
};

const isJson = (response: Response): boolean => response.headers.get('content-type')?.includes('json') ?? false;

const parseJson = (text: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } => {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
};

const retryAfterOf = (response: Response): number | undefined => {
  const raw = response.headers.get('retry-after');
  return raw !== null && /^[0-9]+$/.test(raw) ? Number(raw) : undefined;
};

const detailText = (detail: z.output<typeof ErrorBodySchema>['detail']): string | undefined => {
  if (typeof detail === 'string') return detail;
  if (!detail) return undefined;
  return detail.map((item) => [item.loc?.join('.'), item.msg].filter(Boolean).join(': ')).join('; ');
};

const httpFailure = async (response: Response): Promise<ApiFailure> => {
  const json = isJson(response);
  const text = json ? await readCapped(response, ERROR_BODY_MAX_BYTES) : undefined;
  const parsed = text === undefined ? undefined : parseJson(text);
  const body = parsed?.ok ? ErrorBodySchema.safeParse(parsed.value).data : undefined;
  return {
    kind: 'http',
    status: response.status,
    detail: detailText(body?.detail),
    retryAfterSec: retryAfterOf(response),
    htmlLike: !json,
  };
};

const buildUrl = (baseUrl: string, spec: RequestSpec<z.ZodType>): string => {
  const url = new URL(`${baseUrl}${spec.path}`);
  Object.entries(spec.query ?? {})
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .forEach(([name, value]) => {
      url.searchParams.set(name, String(value));
    });
  return url.href;
};

const buildBody = (
  spec: RequestSpec<z.ZodType>,
): { readonly body?: RequestInit['body']; readonly contentType?: string } => {
  if (spec.body?.kind === 'json') return { body: JSON.stringify(spec.body.value), contentType: 'application/json' };
  if (spec.body?.kind === 'form') {
    const form = new FormData();
    Object.entries(spec.body.fields)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .forEach(([name, value]) => {
        form.append(name, value);
      });
    return { body: form };
  }
  return {};
};

const contextOf = (spec: RequestSpec<z.ZodType>): RequestContext => ({
  operation: spec.retry === 'never' ? 'submit' : 'read',
  resource: spec.resource ?? 'item',
});

const isRetryable = (spec: RequestSpec<z.ZodType>, failure: ApiFailure): boolean => {
  const shortRetryAfter =
    failure.kind === 'http' && failure.retryAfterSec !== undefined && failure.retryAfterSec <= MAX_RETRY_AFTER_SEC;
  if (spec.retry === 'safe') {
    return (
      failure.kind === 'network' ||
      (failure.kind === 'http' &&
        (SAFE_RETRY_STATUSES.has(failure.status) || (failure.status === 429 && shortRetryAfter)))
    );
  }
  if (spec.retry === 'probe') {
    return failure.kind === 'http' && (failure.status === 503 || (failure.status === 429 && shortRetryAfter));
  }
  return false;
};

const retryWaitMs = (failure: ApiFailure, retryIndex: number): number => {
  const retryAfter = failure.kind === 'http' ? failure.retryAfterSec : undefined;
  return retryAfter !== undefined && retryAfter <= MAX_RETRY_AFTER_SEC
    ? retryAfter * 1000
    : (BACKOFF_MS[retryIndex] ?? LAST_BACKOFF_MS);
};

export const createHttp = (options: {
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly forwardedFor: string | undefined;
  readonly deps: HttpDeps;
}): Http => {
  const { clock, logger } = options.deps;

  const bearerFor = (spec: RequestSpec<z.ZodType>): string | undefined =>
    spec.auth === 'api_key' ? options.apiKey : undefined;

  const headersFor = (spec: RequestSpec<z.ZodType>, contentType: string | undefined): Record<string, string> => {
    const bearer = bearerFor(spec);
    const forwardedFor = spec.forwardFor ? options.forwardedFor : undefined;
    return {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(bearer === undefined ? {} : { Authorization: `Bearer ${bearer}` }),
      ...(forwardedFor === undefined ? {} : { 'X-Forwarded-For': forwardedFor }),
    };
  };

  const parseSuccess = async <S extends z.ZodType>(
    spec: RequestSpec<S>,
    response: Response,
  ): Promise<Attempt<z.output<S>>> => {
    const text = isJson(response) ? await readCapped(response, spec.maxBytes ?? DEFAULT_MAX_BYTES) : undefined;
    const json = text === undefined ? undefined : parseJson(text);
    if (!json?.ok) return failed({ kind: 'invalid_response', issuePaths: [] });
    const parsed = spec.schema.safeParse(json.value);
    if (parsed.success) return { ok: true, value: parsed.data };
    const issuePaths = parsed.error.issues.map((issue) => issue.path.map(String).join('.'));
    logger.warn('invalid_response', { path: spec.path, issues: issuePaths.join(',') });
    return failed({ kind: 'invalid_response', issuePaths });
  };

  const attempt = async <S extends z.ZodType>(
    spec: RequestSpec<S>,
    control: RequestControl,
  ): Promise<Attempt<z.output<S>>> => {
    if (control.signal?.aborted) return failed({ kind: 'aborted' });
    const timeoutMs =
      control.deadline === undefined
        ? spec.timeoutMs
        : Math.min(spec.timeoutMs, control.deadline - clock.now() - SAFETY_MARGIN_MS);
    if (timeoutMs < MIN_ATTEMPT_MS) return failed({ kind: 'deadline' });
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = control.signal ? AbortSignal.any([control.signal, timeout]) : timeout;
    const { body, contentType } = buildBody(spec);
    try {
      const response = await options.deps.fetch(buildUrl(options.baseUrl, spec), {
        method: spec.method,
        headers: headersFor(spec, contentType),
        redirect: 'follow',
        signal,
        body,
      });
      return response.ok ? await parseSuccess(spec, response) : failed(await httpFailure(response));
    } catch {
      if (control.signal?.aborted) return failed({ kind: 'aborted' });
      return failed(signal.aborted ? { kind: 'timeout' } : { kind: 'network' });
    }
  };

  const run = async <S extends z.ZodType>(
    spec: RequestSpec<S>,
    control: RequestControl,
    retryIndex: number,
  ): Promise<z.output<S>> => {
    const result = await attempt(spec, control);
    if (result.ok) return result.value;
    const waitMs = retryWaitMs(result.failure, retryIndex);
    const fitsDeadline =
      control.deadline === undefined || clock.now() + waitMs + MIN_ATTEMPT_MS <= control.deadline - SAFETY_MARGIN_MS;
    if (retryIndex >= BACKOFF_MS.length || !isRetryable(spec, result.failure) || !fitsDeadline) {
      throw new ApiError(result.failure, contextOf(spec));
    }
    await clock.sleep(waitMs, control.signal ?? NEVER_ABORTED).catch(() => undefined);
    return run(spec, control, retryIndex + 1);
  };

  const request = async <S extends z.ZodType>(spec: RequestSpec<S>, control: RequestControl): Promise<z.output<S>> => {
    if (spec.auth === 'api_key' && bearerFor(spec) === undefined) {
      throw new ApiError({ kind: 'missing_api_key' }, contextOf(spec));
    }
    return run(spec, control, 0);
  };

  return { request };
};
