import { z } from 'zod';
import { ApiError, MESSAGES, fail } from '../../api/errors.js';
import { EndSec, JobId, JobStatusOutput, MaxCredits, StartSec, toJobStatus } from '../../shaping/fragments.js';
import { defineTool, type ToolContext } from '../../server/registry.js';
import { submitRecut } from './api.js';
import { DIRECTORY_HIDDEN_FIELDS, recutBodyOptions, recutOptionFields } from './clip-options.js';
import { AllowDuplicate, PAID_CONFIRMATION_TAIL, minutesAndSeconds, submitPaid } from './create-clip-job.js';
import { loadClipJob } from './job-kind.js';
import { parsedSource, probeForPricing } from './probe.js';
import { resolveWindow, type PricedWindow } from './window.js';

const COMPLETE_WINDOW_PROBE_MS = 15_000;
const RUNNING = new Set(['queued', 'processing', 'unknown']);

const recutInput = z.object({
  job_id: JobId.describe('Clip job to recut.'),
  max_credits: MaxCredits,
  start_sec: StartSec,
  end_sec: EndSec,
  new_moments: z
    .boolean()
    .default(false)
    .describe('true = the AI picks different moments; false = same moments with the new look.'),
  allow_duplicate: AllowDuplicate,
  ...recutOptionFields,
});

const RecutClipJobOutput = z.object({
  job_id: z.string().describe('The NEW job id.'),
  parent_job_id: z.string(),
  status: JobStatusOutput,
  credits: z.number().int().describe('Credits charged; an upper bound when credits_exact is false.'),
  credits_exact: z.boolean(),
  start_sec: z.number().nullable().describe('null = the original range was reused.'),
  end_sec: z.number().nullable(),
  deduplicated: z.boolean(),
  next_step: z.string(),
});

const isDurationRefusal = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.failure.kind === 'http' &&
  error.failure.status === 422 &&
  error.failure.detail?.toLowerCase().includes('determine video duration') === true;

const rangeOf = (window: PricedWindow) =>
  window.kind === 'explicit' ? { start_sec: window.start, end_sec: window.end } : {};

const rangeText = (window: PricedWindow): string =>
  window.kind === 'explicit'
    ? `${minutesAndSeconds(window.end - window.start)} of video`
    : `original range, at most ${minutesAndSeconds(window.upperBoundSec)}`;

const sendRecut =
  (ctx: ToolContext, jobId: string, body: Readonly<Record<string, unknown>>, window: PricedWindow) => async () => {
    const job = await submitRecut(ctx.http, jobId, body).catch((error: unknown) => {
      if (window.kind !== 'inherited' || !isDurationRefusal(error)) throw error;
      return submitRecut(ctx.http, jobId, { ...body, start_sec: 0, end_sec: window.upperBoundSec });
    });
    return { jobId: job.id, status: job.status, credits: window.credits };
  };

export const recutClipJob = defineTool({
  name: 'recut_clip_job',
  toolset: 'clips',
  title: 'Recut clip job (spends credits)',
  description: [
    'Creates a new clip job from the same source video as an existing job, with different settings such as caption style, hook style, clip length, language, framing, music, B-roll or prompt. Spends credits like create_clip_job (1 per started minute of the billed range, minimum 1, at most 30 minutes per job) and returns a new job_id; the original job and its clips stay unchanged.',
    "Before calling, run quote_clip_job with job_id, show the price, get the user's agreement and pass max_credits. Identical requests within 10 minutes return the existing recut instead of charging again.",
    "Without start_sec and end_sec the recut reuses the original job's range and is billed for it; the API does not reveal that range, so the quote is an upper bound (the whole source video, which must then be at most 30 minutes long). By default the same moments are re-rendered with the new look, which is faster because the source is cached; this works only when the range equals the original job's range. Set new_moments=true to let the AI pick different moments. Only the settings you pass change; everything else (including the original outro and whole-video mode) is inherited from the original job.",
    'Works for completed and failed clip jobs, not for jobs that are still running. To re-run a failed job with the same settings for free, use retry_clip_job. Next, call get_clip_job with the new job_id and wait_sec=50.',
  ].join('\n\n'),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  inputSchema: recutInput,
  directoryInputSchema: recutInput.omit(DIRECTORY_HIDDEN_FIELDS),
  outputSchema: RecutClipJobOutput,
  requiresApiKey: true,
  rateLimit: { bucket: 'paid', limit: 20, windowSec: 3600 },
  handler: async (args, ctx) => {
    const parent = await loadClipJob({
      http: ctx.http,
      id: args.job_id,
      control: { signal: ctx.signal, deadline: ctx.deadline },
    });
    if (RUNNING.has(toJobStatus(parent.status))) fail('job_already_running', MESSAGES.job_already_running);
    const { href } = parsedSource(parent.source_url);
    const inherit = args.start_sec === undefined && args.end_sec === undefined;
    const probe = await probeForPricing({
      ctx,
      href,
      windowComplete: args.end_sec !== undefined,
      ...(args.end_sec === undefined ? {} : { timeoutMs: COMPLETE_WINDOW_PROBE_MS }),
    });
    const window = resolveWindow({
      startSec: args.start_sec,
      endSec: args.end_sec,
      durationSec: probe?.durationSec ?? null,
      maxWindowSec: ctx.config.maxWindowSec,
      inherit,
    });
    const body = {
      ...rangeOf(window),
      force_replan: args.new_moments,
      ...recutBodyOptions(args, ctx.config.directory),
    };
    const outcome = await submitPaid({
      ctx,
      tool: 'recut_clip_job',
      resource: 'recut',
      body: { parent: args.job_id, body },
      credits: window.credits,
      maxCredits: args.max_credits,
      allowDuplicate: args.allow_duplicate,
      confirmation: `Recut clip job ${args.job_id.slice(0, 8)} (${rangeText(window)}) for ${String(window.credits)} credits? ${PAID_CONFIRMATION_TAIL}`,
      submit: sendRecut(ctx, args.job_id, body, window),
    });
    if (outcome.kind === 'ask') return outcome.result;
    const range = rangeOf(window);
    return {
      job_id: outcome.job.jobId,
      parent_job_id: args.job_id,
      status: toJobStatus(outcome.job.status),
      credits: outcome.job.credits,
      credits_exact: window.kind === 'explicit',
      start_sec: range.start_sec ?? null,
      end_sec: range.end_sec ?? null,
      deduplicated: outcome.deduplicated,
      next_step: 'Call get_clip_job with the new job_id and wait_sec=50.',
    };
  },
});
