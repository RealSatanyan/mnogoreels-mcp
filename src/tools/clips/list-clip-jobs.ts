import { z } from 'zod';
import {
  JobStatusOutput,
  Limit,
  Offset,
  UNTRUSTED_TEXT_NOTE,
  progressPercent,
  toJobStatus,
} from '../../shaping/fragments.js';
import { defineTool } from '../../server/registry.js';
import { listJobs } from './api.js';
import { fenceShort } from './assemble.js';
import type { JobResponse } from './schemas.js';

const ERROR_SUMMARY_MAX = 60;
const SOURCE_URL_MAX = 80;

const shortened = (text: string): string => (text.length > SOURCE_URL_MAX ? `${text.slice(0, SOURCE_URL_MAX)}…` : text);

const LIKELY_KINDS = ['clip_job', 'pack_clip_job', 'republication'] as const;

const ListClipJobsOutput = z.object({
  jobs: z.array(
    z.object({
      job_id: z.string(),
      status: JobStatusOutput,
      progress_percent: z.number().int().nullable(),
      source_url: z.string(),
      clips_ready: z.number().int(),
      pack_id: z.string().nullable(),
      likely_kind: z.enum(LIKELY_KINDS),
      media_available: z.boolean().nullable(),
      created_at: z.string().nullable(),
      error_summary: z.string().nullable().describe(`Short failure reason. ${UNTRUSTED_TEXT_NOTE}.`),
    }),
  ),
  next_offset: z.number().int().nullable(),
});

const isRepublication = (job: JobResponse): boolean => {
  const clips = job.s3_clip_urls ?? [];
  return (
    job.kind === 'republication' ||
    (job.status === 'completed' &&
      clips.length === 1 &&
      clips[0] === job.s3_final_url &&
      !job.s3_model_json_url &&
      !job.crop_quality_summary)
  );
};

const likelyKind = (job: JobResponse): (typeof LIKELY_KINDS)[number] => {
  if (isRepublication(job)) return 'republication';
  return job.pack_id ? 'pack_clip_job' : 'clip_job';
};

export const listClipJobs = defineTool({
  name: 'list_clip_jobs',
  toolset: 'clips',
  title: 'List clip jobs',
  description: [
    "Lists the user's clip jobs, newest first, including jobs started on the MnogoReels website. Read-only and free.",
    'Use it to find a job_id, see what is still processing, or pick recent results to review. Use get_clip_job for the clips of one job.',
    'created_via=api shows only jobs started with an API key. Pages with limit (1 to 50, default 10) and offset; next_offset is null on the last page. Creation dates are not provided by the API; the order is newest first.',
    'Returns for each job: job_id, status, progress_percent, source_url, the number of clips ready, pack_id when the job belongs to a publication pack, likely_kind (clip_job, pack_clip_job or republication) and a short error for failed jobs.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: z.object({
    limit: Limit,
    offset: Offset,
    created_via: z
      .enum(['any', 'api'])
      .default('any')
      .describe('api = only jobs created with an API key (this server or scripts); any = also jobs from the website.'),
  }),
  outputSchema: ListClipJobsOutput,
  requiresApiKey: true,
  handler: async (args, ctx) => {
    const items = await listJobs(
      ctx.http,
      { limit: args.limit, offset: args.offset, callerType: args.created_via === 'api' ? 'user' : undefined },
      { signal: ctx.signal, deadline: ctx.deadline },
    );
    return {
      jobs: items.map((job) => {
        const status = toJobStatus(job.status);
        return {
          job_id: job.id,
          status,
          progress_percent: progressPercent(job.progress),
          source_url: shortened(job.source_url),
          clips_ready: job.s3_clip_urls?.length ?? 0,
          pack_id: job.pack_id ?? null,
          likely_kind: likelyKind(job),
          media_available: job.media_available ?? null,
          created_at: job.created_at ?? null,
          error_summary: status === 'failed' ? fenceShort(job.error, ERROR_SUMMARY_MAX) : null,
        };
      }),
      next_offset: items.length < args.limit ? null : args.offset + args.limit,
    };
  },
});
