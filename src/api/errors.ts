import { z } from 'zod';
import { fenceUntrusted } from '../shaping/fence.js';
import type { ToolErrorInfo } from '../shaping/result.js';

export type ApiFailure =
  | {
      readonly kind: 'http';
      readonly status: number;
      readonly detail: string | undefined;
      readonly retryAfterSec: number | undefined;
      readonly htmlLike: boolean;
    }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'deadline' }
  | { readonly kind: 'network' }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'invalid_response'; readonly issuePaths: readonly string[] }
  | { readonly kind: 'missing_api_key' };

export type ErrorCode =
  | 'missing_api_key'
  | 'invalid_api_key_format'
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'api_key_without_user'
  | 'account_not_found'
  | 'not_found'
  | 'upstream_blocked'
  | 'not_available_for_api_keys'
  | 'source_url_not_allowed'
  | 'job_already_running'
  | 'job_not_ready'
  | 'conflict_retry'
  | 'media_expired'
  | 'too_large'
  | 'duration_unknown'
  | 'invalid_arguments'
  | 'rate_limited'
  | 'outcome_unknown'
  | 'upstream_error'
  | 'billing_uncertain'
  | 'article_enqueue_failed'
  | 'service_unavailable'
  | 'upstream_timeout'
  | 'network_error'
  | 'unexpected_response'
  | 'spend_cap_exceeded'
  | 'operator_cap_exceeded'
  | 'cancelled_by_user'
  | 'source_not_downloadable'
  | 'job_not_retryable'
  | 'rate_limited_local'
  | 'try_again'
  | 'internal_error';

export type MappedError = ToolErrorInfo & { readonly code: ErrorCode };

export const ErrorBodySchema = z.object({
  detail: z
    .union([
      z.string(),
      z.array(z.object({ msg: z.string().nullish(), loc: z.array(z.union([z.string(), z.number()])).nullish() })),
    ])
    .nullish(),
});

export type RequestContext = { readonly operation: 'read' | 'submit'; readonly resource: string };

const DEFAULT_REQUEST_CONTEXT: RequestContext = { operation: 'read', resource: 'item' };

export class ApiError extends Error {
  readonly failure: ApiFailure;
  readonly context: RequestContext;

  constructor(failure: ApiFailure, context: RequestContext = DEFAULT_REQUEST_CONTEXT) {
    super(`MnogoReels API failure: ${failure.kind === 'http' ? `http ${String(failure.status)}` : failure.kind}`);
    this.name = 'ApiError';
    this.failure = failure;
    this.context = context;
  }
}

const RETRYABLE_LOCAL_CODES: ReadonlySet<ErrorCode> = new Set(['try_again', 'rate_limited_local']);

export class ToolFailure extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly retryAfterSec: number | undefined;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(options: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly retryAfterSec?: number | undefined;
    readonly details?: Readonly<Record<string, unknown>> | undefined;
  }) {
    super(options.message);
    this.name = 'ToolFailure';
    this.code = options.code;
    this.retryable = RETRYABLE_LOCAL_CODES.has(options.code);
    this.retryAfterSec = options.retryAfterSec;
    this.details = options.details;
  }
}

export const fail = (code: ErrorCode, message: string, details?: Readonly<Record<string, unknown>>): never => {
  throw new ToolFailure({ code, message, details });
};

const KEYS_PAGE = 'https://mnogo-reels.ru/dashboard/developers?tab=keys';
const ISSUES_PAGE = 'https://github.com/RealSatanyan/mnogoreels-mcp/issues';
const MAX_DETAIL_CHARS = 300;
const DEFAULT_RETRY_AFTER_SEC = 60;
const PAID_RESOURCES = new Set(['clip job', 'recut']);
const FREE_JOB_RESOURCES = new Set(['transcription', 'thumbnail job']);
const CLIP_JOB_ACTIONS = new Set(['recut', 'retry']);

export const MESSAGES = {
  missing_api_key: `No MnogoReels API key is configured. Create one at ${KEYS_PAGE}, then set MNOGOREELS_API_KEY (local server) or send it as 'Authorization: Bearer <key>' (remote server).`,
  invalid_api_key_format: `The configured API key does not look like a MnogoReels user key (it must start with mrfrt_usr_). Copy it again from ${KEYS_PAGE}.`,
  invalid_api_key: `MnogoReels rejected the API key (revoked, deleted or mistyped). Create a new key at ${KEYS_PAGE} and update the client configuration.`,
  api_key_without_user: `This API key is not linked to a MnogoReels account. Create a new key at ${KEYS_PAGE}.`,
  account_not_found: 'The account behind this API key no longer exists.',
  upstream_blocked: `The MnogoReels API firewall blocked the request. Try again later; if it persists, report it at ${ISSUES_PAGE}.`,
  not_available_for_api_keys: 'MnogoReels does not allow this operation with personal API keys.',
  job_already_running: 'The job is still queued or processing; wait for it with get_clip_job.',
  job_not_ready: 'The source job is not completed yet; wait for it with get_clip_job (wait_sec=50).',
  conflict_retry: 'A matching job was created at the same moment; call the tool again to get it.',
  media_expired: 'The files for this job are no longer available (storage retention).',
  too_large: 'The source is too large for MnogoReels (limit 17 GB).',
  duration_unknown:
    'MnogoReels could not determine the video length. Pass end_sec (the length in seconds, or the end of the part to process).',
  rate_limited: 'MnogoReels is rate-limiting these requests.',
  upstream_error: 'MnogoReels returned an internal error. Try again in a minute.',
  billing_uncertain:
    'MnogoReels could not confirm the charge. Credits may have been deducted without creating a job; check list_clip_jobs and contact support@mnogo-reels.ru before retrying.',
  article_enqueue_failed:
    'The article could not be queued and is now marked failed; it cannot be regenerated through the API. Contact support@mnogo-reels.ru with the clip job id.',
  upstream_timeout:
    'MnogoReels did not answer in time. Try again; for source checks you can also pass start_sec/end_sec yourself.',
  unexpected_response: `MnogoReels returned data this server version does not understand. Update mnogoreels-mcp or report it at ${ISSUES_PAGE}.`,
  deadline_submit:
    'There was not enough time left in this call to send the request. Nothing was sent; call the tool again now.',
  retry_outcome_unknown:
    'MnogoReels returned an internal error while restarting the clip job. Retrying is free: check the job with get_clip_job and call retry_clip_job again only if it is still failed.',
} as const;

export type FailureContext = RequestContext & { readonly apiUrl: string };

const fencedDetail = (detail: string | undefined): string | null =>
  fenceUntrusted(detail === undefined ? null : detail.slice(0, MAX_DETAIL_CHARS));

const withDetail = (prefix: string, detail: string | undefined, suffix: string): string => {
  const fenced = fencedDetail(detail);
  return fenced === null ? `${prefix}${suffix}` : `${prefix} (${fenced})${suffix}`;
};

const unknownOutcomeAdvice = (resource: string): string => {
  if (PAID_RESOURCES.has(resource)) {
    return 'It may or may not have been created: check list_clip_jobs before trying again to avoid paying twice. An identical call within 10 minutes returns this same answer without sending anything.';
  }
  if (resource === 'article') {
    return 'Call create_article again with the same clip_job_id; it returns the existing article if one was created.';
  }
  return FREE_JOB_RESOURCES.has(resource)
    ? 'Nothing was charged. Call the tool again; a duplicate job may exist but costs nothing.'
    : 'Check whether it was created before trying again.';
};

const mapped = (code: ErrorCode, message: string, retryable = false, retryAfterSec?: number): MappedError => ({
  code,
  message,
  retryable,
  retryAfterSec,
});

const outcomeUnknown = (resource: string): MappedError =>
  resource === 'retry'
    ? mapped('outcome_unknown', MESSAGES.retry_outcome_unknown)
    : mapped(
        'outcome_unknown',
        `MnogoReels returned an internal error while creating the ${resource}. ${unknownOutcomeAdvice(resource)}`,
      );

const notFound = (resource: string): MappedError => {
  const noun = CLIP_JOB_ACTIONS.has(resource) ? 'clip job' : resource;
  const hint = noun === 'clip job' ? ' Use list_clip_jobs to find your job ids.' : '';
  return mapped(
    'not_found',
    `No ${noun} with this id exists for this API key (it may belong to another account).${hint}`,
  );
};

const rejected = (detail: string | undefined): MappedError => {
  const fenced = fencedDetail(detail);
  return mapped('invalid_arguments', `MnogoReels rejected the request${fenced === null ? '' : `: ${fenced}`}.`);
};

const has = (detail: string | undefined, ...needles: readonly string[]): boolean =>
  needles.some((needle) => detail?.toLowerCase().includes(needle) === true);

const mapForbidden = (detail: string | undefined, htmlLike: boolean, resource: string): MappedError => {
  if (has(detail, 'no associated user', 'not bound to a user'))
    return mapped('api_key_without_user', MESSAGES.api_key_without_user);
  if (has(detail, 'user account not found')) return mapped('account_not_found', MESSAGES.account_not_found);
  if (has(detail, 'belongs to another user')) return notFound(resource);
  if (htmlLike) return mapped('upstream_blocked', MESSAGES.upstream_blocked, true);
  return mapped('not_available_for_api_keys', MESSAGES.not_available_for_api_keys);
};

const mapClientError = (status: number, detail: string | undefined): MappedError => {
  if (status === 400 && has(detail, 'url is not allowed')) {
    return mapped(
      'source_url_not_allowed',
      withDetail('MnogoReels refused this URL', detail, '. Use a public http(s) link to a video page or file.'),
    );
  }
  if (status === 400 && has(detail, 'already running'))
    return mapped('job_already_running', MESSAGES.job_already_running);
  if (has(detail, 'not ready', 'not completed')) return mapped('job_not_ready', MESSAGES.job_not_ready);
  if (status === 409 && has(detail, 'already exists')) return mapped('conflict_retry', MESSAGES.conflict_retry, true);
  if (status === 422 && has(detail, 'determine video duration'))
    return mapped('duration_unknown', MESSAGES.duration_unknown);
  return rejected(detail);
};

const mapServerError = (failure: Extract<ApiFailure, { kind: 'http' }>, context: FailureContext): MappedError => {
  const { status, detail } = failure;
  const submit = context.operation === 'submit';
  if (status === 504 || status === 524) {
    return submit ? outcomeUnknown(context.resource) : mapped('upstream_timeout', MESSAGES.upstream_timeout, true);
  }
  if (
    status === 503 &&
    submit &&
    PAID_RESOURCES.has(context.resource) &&
    has(detail, 'billing service unavailable', 'billing service error')
  ) {
    return mapped('billing_uncertain', MESSAGES.billing_uncertain);
  }
  if (status === 503 && submit && context.resource === 'article') {
    return mapped('article_enqueue_failed', MESSAGES.article_enqueue_failed);
  }
  if (status === 502 || status === 503) {
    return mapped(
      'service_unavailable',
      withDetail('MnogoReels is temporarily unavailable', detail, '. Try again in a minute.'),
      true,
    );
  }
  return submit ? outcomeUnknown(context.resource) : mapped('upstream_error', MESSAGES.upstream_error, true);
};

const mapHttp = (failure: Extract<ApiFailure, { kind: 'http' }>, context: FailureContext): MappedError => {
  const { status, detail } = failure;
  if (status >= 500) return mapServerError(failure, context);
  if (status === 401) return mapped('invalid_api_key', MESSAGES.invalid_api_key);
  if (status === 402) {
    return mapped(
      'insufficient_credits',
      `Not enough credits for this ${context.resource}. The user can buy credits or a plan at https://mnogo-reels.ru.`,
    );
  }
  if (status === 403) return mapForbidden(detail, failure.htmlLike, context.resource);
  if (status === 404) return notFound(context.resource);
  if (status === 410) return mapped('media_expired', MESSAGES.media_expired);
  if (status === 413) return mapped('too_large', MESSAGES.too_large);
  if (status === 429) {
    return mapped('rate_limited', MESSAGES.rate_limited, true, failure.retryAfterSec ?? DEFAULT_RETRY_AFTER_SEC);
  }
  return mapClientError(status, detail);
};

export const mapApiFailure = (failure: ApiFailure, context: FailureContext): MappedError => {
  const submit = context.operation === 'submit';
  switch (failure.kind) {
    case 'http':
      return mapHttp(failure, context);
    case 'missing_api_key':
      return mapped('missing_api_key', MESSAGES.missing_api_key);
    case 'invalid_response':
      return mapped('unexpected_response', MESSAGES.unexpected_response);
    case 'deadline':
      return submit
        ? mapped('try_again', MESSAGES.deadline_submit, true)
        : mapped('upstream_timeout', MESSAGES.upstream_timeout, true);
    case 'network':
      return submit
        ? outcomeUnknown(context.resource)
        : mapped(
            'network_error',
            `Could not reach MnogoReels (${context.apiUrl}). Check the internet connection or MNOGOREELS_API_URL.`,
            true,
          );
    case 'timeout':
      return submit ? outcomeUnknown(context.resource) : mapped('upstream_timeout', MESSAGES.upstream_timeout, true);
    case 'aborted':
      return mapped('upstream_timeout', MESSAGES.upstream_timeout, true);
  }
};
