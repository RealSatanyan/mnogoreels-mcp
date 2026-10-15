import { z } from 'zod';
import { mediaLink, safeHttpUrl, type MediaUrlMode } from '../../domain/media-urls.js';
import { pollUntil } from '../../runtime/poll.js';
import { defineTool } from '../../server/registry.js';
import { fenceUntrusted } from '../../shaping/fence.js';
import {
  ErrorSummaryOutput,
  JobStatusOutput,
  MediaLinkOutput,
  WaitSec,
  progressPercent,
  toJobStatus,
} from '../../shaping/fragments.js';
import { getThumbnailJob, type ThumbnailJob } from './api.js';

const GetThumbnailsInput = z.object({
  thumbnail_job_id: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .describe('thumbnail_job_id returned by create_youtube_thumbnails.'),
  wait_sec: WaitSec,
});

const GetThumbnailsOutput = z.object({
  thumbnail_job_id: z.string(),
  status: JobStatusOutput,
  is_terminal: z.boolean(),
  stage: z.string().nullable(),
  progress_percent: z.number().int().nullable(),
  variants: z.array(
    z.object({
      variant_id: z.string(),
      image: MediaLinkOutput,
      width: z.number().nullable(),
      height: z.number().nullable(),
    }),
  ),
  error: ErrorSummaryOutput,
  waited_sec: z.number(),
});

const POLL_INTERVAL_MS = 3_000;
const MAX_ERROR_CHARS = 300;
const TERMINAL_STATUSES = new Set(['completed', 'failed']);
const FAILED_HINT =
  'Call create_youtube_thumbnails again to start a new job (free); a different title or prompt may help.';

const isTerminal = (job: ThumbnailJob): boolean => TERMINAL_STATUSES.has(job.status);

const describeJob = (job: ThumbnailJob): string =>
  `${job.stage ?? job.status} ${String(progressPercent(job.progress) ?? 0)}%`;

const variantsOf = (job: ThumbnailJob, mode: MediaUrlMode) =>
  (job.variants ?? []).flatMap((variant) => {
    const url = safeHttpUrl(variant.image_url);
    return url === null
      ? []
      : [
          {
            variant_id: variant.id,
            image: mediaLink(url, mode),
            width: variant.width ?? null,
            height: variant.height ?? null,
          },
        ];
  });

const errorOf = (job: ThumbnailJob) =>
  job.status === 'failed'
    ? {
        message: fenceUntrusted(job.error?.slice(0, MAX_ERROR_CHARS)) ?? 'MnogoReels did not report a reason.',
        hint: FAILED_HINT,
      }
    : null;

export const getYoutubeThumbnails = defineTool({
  name: 'get_youtube_thumbnails',
  toolset: 'thumbnails',
  title: 'Get YouTube thumbnails',
  description: [
    'Returns the status and images of a thumbnail job started with create_youtube_thumbnails. Read-only and free; needs an API key. Jobs cannot be listed, so keep the thumbnail_job_id from create_youtube_thumbnails.',
    'wait_sec (default 30, max 50) waits inside this call until the job completes or fails, with progress notifications; wait_sec=0 returns a snapshot. Returns status (queued, processing, completed, failed), stage, progress_percent and the finished variants (1280×720 JPEG image link, width, height). If some variants failed, the rest are still returned.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: GetThumbnailsInput,
  outputSchema: GetThumbnailsOutput,
  requiresApiKey: true,
  handler: async (args, ctx) => {
    const { value: job, waitedSec } = await pollUntil({
      load: (signal) => getThumbnailJob(ctx, args.thumbnail_job_id, signal),
      isTerminal,
      describe: describeJob,
      waitSec: args.wait_sec,
      intervalMs: POLL_INTERVAL_MS,
      clock: ctx.deps.clock,
      signal: ctx.signal,
      toolDeadline: ctx.deadline,
      onProgress: ctx.reportProgress,
    });
    return {
      thumbnail_job_id: job.id,
      status: toJobStatus(job.status),
      is_terminal: isTerminal(job),
      stage: job.stage ?? null,
      progress_percent: progressPercent(job.progress),
      variants: variantsOf(job, ctx.config.mediaUrls),
      error: errorOf(job),
      waited_sec: waitedSec,
    };
  },
});
