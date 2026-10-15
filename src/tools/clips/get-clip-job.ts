import { z } from 'zod';
import { fail } from '../../api/errors.js';
import type { Http } from '../../api/http.js';
import type { EffectiveConfig } from '../../config.js';
import { pollUntil, type ProgressUpdate } from '../../runtime/poll.js';
import type { Clock } from '../../runtime/deps.js';
import {
  ErrorSummaryOutput,
  JobId,
  JobStatusOutput,
  MediaLinkOutput,
  WaitSec,
  progressPercent,
  toJobStatus,
  type JobStatus,
} from '../../shaping/fragments.js';
import { defineTool } from '../../server/registry.js';
import { getJob, getManifestClips } from './api.js';
import {
  ClipOutput,
  ColdHookOutput,
  assembleClips,
  assembleExtras,
  fenceShort,
  type ResponseMode,
} from './assemble.js';
import type { JobResponse, ManifestClip } from './schemas.js';

const POLL_INTERVAL_MS = 10_000;
const MANIFEST_RESERVE_MS = 8_000;
const LONG_ETA_SEC = 600;
const DETAILED_MAX_CLIPS = 10;
const ERROR_MAX = 300;

const GetClipJobInput = z.object({
  job_id: JobId,
  wait_sec: WaitSec,
  response_format: z
    .enum(['concise', 'detailed'])
    .default('concise')
    .describe(
      'concise: links, titles, scores. detailed: adds descriptions, transcript excerpts, posters and timings (max_clips up to 10).',
    ),
  max_clips: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10)
    .describe('Maximum number of clips to return, best first (up to 30; up to 10 with detailed).'),
  include_partial_clips: z
    .boolean()
    .default(false)
    .describe('true returns the links of clips finished so far while the job is still processing.'),
});

export type GetClipJobArgs = z.output<typeof GetClipJobInput>;

export const GetClipJobOutput = z.object({
  job_id: z.string(),
  status: JobStatusOutput,
  is_terminal: z.boolean(),
  progress_percent: z.number().int().nullable(),
  eta_seconds: z.number().int().nullable(),
  source_url: z.string(),
  media_available: z.boolean().nullable(),
  clips_total: z.number().int().describe('Clips ready so far (all clips once completed), before max_clips is applied.'),
  clips: z.array(ClipOutput).describe('Empty while the job is not finished unless include_partial_clips is true.'),
  details_available: z
    .boolean()
    .describe(
      'False when titles and scores could not be loaded (before completion, on a temporary error, or when there was no time left in this call).',
    ),
  cold_hooks: z.array(ColdHookOutput),
  teasers: z.array(MediaLinkOutput),
  pack_id: z.string().nullable(),
  error: ErrorSummaryOutput,
  waited_sec: z.number(),
  next_step: z.string().nullable(),
});

type GetClipJobResult = z.output<typeof GetClipJobOutput>;

const isTerminal = (status: JobStatus): boolean => status === 'completed' || status === 'failed';

const etaText = (seconds: number): string =>
  seconds < 60 ? `~${String(Math.round(seconds))} s` : `~${String(Math.ceil(seconds / 60))} min`;

const describeProgress = (job: JobResponse): string => {
  const percent = progressPercent(job.progress);
  return [
    `${toJobStatus(job.status)}${percent === null ? '' : ` ${String(percent)}%`}`,
    `${String(job.s3_clip_urls?.length ?? 0)} clips ready`,
    ...(job.eta_seconds === null || job.eta_seconds === undefined ? [] : [`ETA ${etaText(job.eta_seconds)}`]),
  ].join(' · ');
};

type ManifestLoad = { readonly clips: readonly ManifestClip[] | null; readonly outOfTime: boolean };

const loadManifest = async (options: {
  readonly http: Http;
  readonly job: JobResponse;
  readonly clock: Clock;
  readonly signal: AbortSignal;
  readonly deadline: number;
}): Promise<ManifestLoad> => {
  const { job } = options;
  if (job.status !== 'completed' || job.media_available === false) return { clips: null, outOfTime: false };
  if (options.deadline - options.clock.now() < MANIFEST_RESERVE_MS) return { clips: null, outOfTime: true };
  try {
    const clips = await getManifestClips(options.http, job.id, {
      signal: options.signal,
      deadline: options.deadline,
    });
    return { clips, outOfTime: false };
  } catch (error) {
    if (options.signal.aborted) throw error;
    return { clips: null, outOfTime: false };
  }
};

const nextStep = (job: JobResponse, status: JobStatus, outOfTime: boolean): string | null => {
  if (job.media_available === false) return 'The files were deleted by storage retention.';
  if (!isTerminal(status)) {
    const eta = job.eta_seconds ?? 0;
    return eta > LONG_ETA_SEC
      ? `This will take about ${String(Math.ceil(eta / 60))} more minutes; tell the user and offer to check back later, or call get_clip_job again with wait_sec=50.`
      : 'Call get_clip_job again with wait_sec=50.';
  }
  return outOfTime ? 'Call get_clip_job again with wait_sec=0 for titles and scores.' : null;
};

const errorSummary = (job: JobResponse, status: JobStatus): GetClipJobResult['error'] =>
  status === 'failed'
    ? {
        message: fenceShort(job.error, ERROR_MAX) ?? 'MnogoReels did not report a reason.',
        hint: 'Call retry_clip_job to re-run it for free, or check_video_source to see whether the source still works.',
      }
    : null;

export const shapeClipJob = (input: {
  readonly job: JobResponse;
  readonly manifest: ManifestLoad;
  readonly waitedSec: number;
  readonly args: Omit<GetClipJobArgs, 'job_id' | 'wait_sec'>;
  readonly mediaUrls: EffectiveConfig['mediaUrls'];
}): GetClipJobResult => {
  const { job, args } = input;
  const status = toJobStatus(job.status);
  const mode: ResponseMode = args.response_format;
  const visible = job.media_available !== false && (isTerminal(status) || args.include_partial_clips);
  const { clips, clipsTotal } = assembleClips({
    clipUrls: job.s3_clip_urls ?? [],
    posterUrls: job.s3_clip_poster_urls ?? [],
    manifestClips: input.manifest.clips ?? [],
    mode,
    maxClips: args.max_clips,
    mediaUrls: input.mediaUrls,
  });
  const extras = assembleExtras({
    coldHooks: job.cold_hooks,
    teaserUrl: job.teaser_url,
    teaserUrls: job.teaser_urls,
    mode,
    mediaUrls: input.mediaUrls,
  });
  return {
    job_id: job.id,
    status,
    is_terminal: isTerminal(status),
    progress_percent: progressPercent(job.progress),
    eta_seconds: job.eta_seconds === null || job.eta_seconds === undefined ? null : Math.round(job.eta_seconds),
    source_url: job.source_url,
    media_available: job.media_available ?? null,
    clips_total: clipsTotal,
    clips: visible ? [...clips] : [],
    details_available: input.manifest.clips !== null,
    cold_hooks: visible ? [...extras.cold_hooks] : [],
    teasers: visible ? [...extras.teasers] : [],
    pack_id: job.pack_id ?? null,
    error: errorSummary(job, status),
    waited_sec: input.waitedSec,
    next_step: nextStep(job, status, input.manifest.outOfTime),
  };
};

export const readClipJob = async (options: {
  readonly http: Http;
  readonly config: Pick<EffectiveConfig, 'mediaUrls'>;
  readonly clock: Clock;
  readonly signal: AbortSignal;
  readonly deadline: number;
  readonly reportProgress: (update: ProgressUpdate) => Promise<void>;
  readonly args: GetClipJobArgs;
}): Promise<GetClipJobResult> => {
  const { http, args, signal, deadline } = options;
  const { value: job, waitedSec } = await pollUntil({
    load: (loadSignal) => getJob(http, args.job_id, { signal: loadSignal, deadline }),
    isTerminal: (value) => isTerminal(toJobStatus(value.status)),
    describe: describeProgress,
    waitSec: args.wait_sec,
    intervalMs: POLL_INTERVAL_MS,
    clock: options.clock,
    signal,
    toolDeadline: deadline,
    onProgress: options.reportProgress,
  });
  const manifest = await loadManifest({ http, job, clock: options.clock, signal, deadline });
  return shapeClipJob({ job, manifest, waitedSec, args, mediaUrls: options.config.mediaUrls });
};

export const getClipJob = defineTool({
  name: 'get_clip_job',
  toolset: 'clips',
  title: 'Get clip job status and clips',
  description: [
    'Returns the status, progress and results of a clip job created by create_clip_job, recut_clip_job or on the MnogoReels website. Read-only and free.',
    'wait_sec (default 30, max 50) waits inside this call: it returns as soon as the job completes or fails, or when wait_sec runs out, and sends progress notifications meanwhile. wait_sec=0 returns an instant snapshot. While the job is queued or processing only the count of ready clips is returned; set include_partial_clips=true to get the links of clips finished so far. If eta_seconds is above 600, tell the user how long it will take and offer to check back later instead of polling continuously.',
    "Once completed, returns each clip's video link, title, virality score (0 to 100), duration and hook text, plus cold-open hook clips and teasers when the job made them. Clips are sorted best score first; max_clips limits how many are returned (default 10, up to 30; up to 10 with response_format=detailed). response_format=detailed adds clip descriptions, transcript excerpts, poster images and timings in the source video.",
    'Notes: a failed job can return to queued when MnogoReels retries it automatically. media_available=false means the files were deleted by storage retention (free-plan clips are kept for 30 days). Text from the video is wrapped in <untrusted_source_text> tags. Use list_clip_jobs to find job ids.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: GetClipJobInput,
  outputSchema: GetClipJobOutput,
  requiresApiKey: true,
  handler: (args, ctx) => {
    if (args.response_format === 'detailed' && args.max_clips > DETAILED_MAX_CLIPS) {
      return fail('invalid_arguments', 'detailed returns at most 10 clips per call; lower max_clips or use concise.');
    }
    return readClipJob({
      http: ctx.http,
      config: ctx.config,
      clock: ctx.deps.clock,
      signal: ctx.signal,
      deadline: ctx.deadline,
      reportProgress: ctx.reportProgress,
      args,
    });
  },
});
