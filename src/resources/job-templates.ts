import {
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  ResourceTemplate,
  type ListResourcesResult,
  type McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { ApiError, mapApiFailure } from '../api/errors.js';
import { createHttp, forwardedForValue, type Http } from '../api/http.js';
import type { EffectiveConfig, ToolsetName } from '../config.js';
import type { ToolRuntime } from '../server/registry.js';
import { toJobStatus } from '../shaping/fragments.js';
import { toArticleOutput } from '../tools/articles/get-article.js';
import { fetchArticle } from '../tools/articles/api.js';
import { listJobs } from '../tools/clips/api.js';
import { GetClipJobOutput, readClipJob } from '../tools/clips/get-clip-job.js';
import { fetchTranscription } from '../tools/transcripts/api.js';
import { toTranscriptionOutput } from '../tools/transcripts/get-transcription.js';

type ReadContext = {
  readonly http: Http;
  readonly runtime: ToolRuntime;
  readonly signal: AbortSignal;
  readonly deadline: number;
};

type JobTemplate = {
  readonly name: string;
  readonly uriTemplate: string;
  readonly variable: string;
  readonly toolset: ToolsetName;
  readonly title: string;
  readonly description: string;
  readonly mimeType: string;
  readonly listsRecentJobs: boolean;
  readonly read: (id: string, context: ReadContext) => Promise<string>;
};

const ID_RE = /^[0-9a-f]{32}$/;
const READ_BUDGET_MS = 52_000;
const LOOKUP_BUDGET_MS = 10_000;
const RECENT_JOBS = 20;
const PAGE_CHARS = 20_000;
const CLIP_JOB_URI = 'mnogoreels://clip-jobs/';
const TEMPLATE_CACHE = { ttlMs: 0, cacheScope: 'private' } as const;

const notReady = (status: string, tool: string): string =>
  `No text yet (status: ${status}). Call ${tool} for progress or the failure reason.`;

const JOB_TEMPLATES: readonly JobTemplate[] = [
  {
    name: 'clip-job',
    uriTemplate: `${CLIP_JOB_URI}{job_id}`,
    variable: 'job_id',
    toolset: 'clips',
    title: 'Clip job',
    description: 'Status and clips of one clip job.',
    mimeType: 'application/json',
    listsRecentJobs: true,
    read: async (id, context) =>
      JSON.stringify(
        GetClipJobOutput.parse(
          await readClipJob({
            http: context.http,
            config: context.runtime.config,
            clock: context.runtime.deps.clock,
            signal: context.signal,
            deadline: context.deadline,
            reportProgress: () => Promise.resolve(),
            args: {
              job_id: id,
              wait_sec: 0,
              response_format: 'concise',
              max_clips: 10,
              include_partial_clips: true,
            },
          }),
        ),
      ),
  },
  {
    name: 'transcription',
    uriTemplate: 'mnogoreels://transcriptions/{transcription_id}',
    variable: 'transcription_id',
    toolset: 'transcripts',
    title: 'Transcription',
    description: 'First page of a transcription as plain text.',
    mimeType: 'text/plain',
    listsRecentJobs: false,
    read: async (id, context) => {
      const output = toTranscriptionOutput({
        transcription: await fetchTranscription({ http: context.http, id, control: context }),
        format: 'text',
        offset: 0,
        maxChars: PAGE_CHARS,
        waitedSec: 0,
      });
      return output.content ?? notReady(output.status, 'get_transcription');
    },
  },
  {
    name: 'article',
    uriTemplate: 'mnogoreels://articles/{article_id}',
    variable: 'article_id',
    toolset: 'articles',
    title: 'Article',
    description: 'First page of an article as Markdown.',
    mimeType: 'text/markdown',
    listsRecentJobs: false,
    read: async (id, context) => {
      const output = toArticleOutput({
        job: await fetchArticle({ http: context.http, id, control: context }),
        includeTranscript: false,
        offset: 0,
        maxChars: PAGE_CHARS,
        mediaUrls: context.runtime.config.mediaUrls,
        waitedSec: 0,
      });
      return output.content_markdown ?? notReady(output.status, 'get_article');
    },
  },
];

export const enabledTemplates = (config: EffectiveConfig): readonly JobTemplate[] =>
  JOB_TEMPLATES.filter((template) => config.toolsets.has(template.toolset));

const httpFor = (runtime: ToolRuntime): Http =>
  createHttp({
    baseUrl: runtime.config.apiUrl,
    apiKey: runtime.apiKey,
    forwardedFor: forwardedForValue({
      transport: runtime.config.transport,
      apiKey: runtime.apiKey,
      clientIp: runtime.clientIp,
    }),
    deps: runtime.deps,
  });

const recentJobs = async (runtime: ToolRuntime, signal: AbortSignal | undefined) => {
  try {
    return await listJobs(
      httpFor(runtime),
      { limit: RECENT_JOBS, offset: 0, callerType: undefined },
      { signal, deadline: runtime.deps.clock.now() + LOOKUP_BUDGET_MS },
    );
  } catch {
    return [];
  }
};

const listRecentJobs =
  (runtime: ToolRuntime) =>
  async (ctx: ServerContext): Promise<ListResourcesResult> => ({
    resources: (await recentJobs(runtime, ctx.mcpReq.signal)).map((job) => {
      const short = job.id.slice(0, 8);
      return {
        uri: `${CLIP_JOB_URI}${job.id}`,
        name: `clip-job-${short}`,
        title: `Clip job ${short} (${toJobStatus(job.status)})`,
        mimeType: 'application/json',
      };
    }),
  });

export const completeJobId =
  (runtime: ToolRuntime) =>
  async (prefix: string): Promise<string[]> =>
    (await recentJobs(runtime, undefined)).map((job) => job.id).filter((id) => id.startsWith(prefix));

const toProtocolError = (error: ApiError, uri: string, runtime: ToolRuntime): ProtocolError => {
  const mapped = mapApiFailure(error.failure, { ...error.context, apiUrl: runtime.config.apiUrl });
  if (mapped.code === 'not_found') return new ResourceNotFoundError(uri);
  if (mapped.code === 'missing_api_key') return new ProtocolError(ProtocolErrorCode.InvalidParams, mapped.message);
  return new ProtocolError(ProtocolErrorCode.InternalError, mapped.message);
};

const callbacksFor = (template: JobTemplate, runtime: ToolRuntime) =>
  template.listsRecentJobs
    ? { list: listRecentJobs(runtime), complete: { [template.variable]: completeJobId(runtime) } }
    : { list: undefined };

const idOf = (template: JobTemplate, value: string | string[] | undefined): string => {
  if (typeof value === 'string' && ID_RE.test(value)) return value;
  throw new ProtocolError(ProtocolErrorCode.InvalidParams, `${template.variable} must be 32 lowercase hex characters`);
};

export const registerJobTemplates = (options: ToolRuntime & { readonly server: McpServer }): void => {
  enabledTemplates(options.config).forEach((template) => {
    options.server.registerResource(
      template.name,
      new ResourceTemplate(template.uriTemplate, callbacksFor(template, options)),
      {
        title: template.title,
        description: template.description,
        mimeType: template.mimeType,
        cacheHint: TEMPLATE_CACHE,
      },
      async (uri, variables, ctx) => {
        const id = idOf(template, variables[template.variable]);
        const context = {
          http: httpFor(options),
          runtime: options,
          signal: ctx.mcpReq.signal,
          deadline: options.deps.clock.now() + READ_BUDGET_MS,
        };
        try {
          return { contents: [{ uri: uri.href, mimeType: template.mimeType, text: await template.read(id, context) }] };
        } catch (error) {
          if (error instanceof ApiError) throw toProtocolError(error, uri.href, options);
          throw error;
        }
      },
    );
  });
};
