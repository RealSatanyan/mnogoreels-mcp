import type { InputRequiredResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ApiError, fail } from '../../api/errors.js';
import { checkSpendCaps } from '../../policy/spend.js';
import type { SubmittedJob } from '../../runtime/deps.js';
import { sanitizeText } from '../../shaping/fence.js';
import { EndSec, JobStatusOutput, MaxCredits, SourceUrl, StartSec, toJobStatus } from '../../shaping/fragments.js';
import { hashKey } from '../../shaping/redact.js';
import { defineTool, type ToolContext } from '../../server/registry.js';
import { submitClipJob } from './api.js';
import { DIRECTORY_HIDDEN_FIELDS, createBodyOptions, createOptionFields } from './clip-options.js';
import { parsedSource, probeForPricing } from './probe.js';
import { explicitWindow } from './window.js';

const SUBMIT_BUDGET_MS = 25_000;
const COMPLETE_WINDOW_PROBE_MS = 15_000;
const TITLE_IN_CONFIRMATION = 80;

export const PAID_CONFIRMATION_TAIL =
  'Credits are charged now. Jobs cannot be cancelled, and credits are not returned automatically if processing fails.';

export const AllowDuplicate = z
  .boolean()
  .default(false)
  .describe(
    'Set true only if the user explicitly wants a second identical job within 10 minutes (it is charged again).',
  );

export const minutesAndSeconds = (seconds: number): string =>
  `${String(Math.floor(seconds / 60))}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const sourceLabel = (title: string | null | undefined, host: string): string =>
  sanitizeText(title ?? '').slice(0, TITLE_IN_CONFIRMATION) || host;

const enforceSpendCaps = (input: {
  readonly credits: number;
  readonly maxCredits: number;
  readonly operatorCap: number | undefined;
}): void => {
  const check = checkSpendCaps(input);
  const { credits } = input;
  const details = { credits, max_credits: input.maxCredits, operator_cap: input.operatorCap ?? null };
  if (check.kind === 'operator_cap_exceeded') {
    fail(
      'operator_cap_exceeded',
      `This job costs ${String(credits)} credits; this server is configured to allow at most ${String(check.cap)} credits per call (MNOGOREELS_MAX_CREDITS_PER_CALL). Choose a shorter range with start_sec/end_sec.`,
      details,
    );
  }
  if (check.kind === 'spend_cap_exceeded') {
    fail(
      'spend_cap_exceeded',
      `This job costs ${String(credits)} credits but max_credits is ${String(check.max)}. Show the price to the user and, if they agree, call again with max_credits ≥ ${String(credits)}.`,
      details,
    );
  }
};

export type PaidSubmission =
  | { readonly kind: 'submitted'; readonly job: SubmittedJob; readonly deduplicated: boolean }
  | { readonly kind: 'ask'; readonly result: InputRequiredResult };

export const submitPaid = async (request: {
  readonly ctx: ToolContext;
  readonly tool: string;
  readonly resource: 'clip job' | 'recut';
  readonly body: unknown;
  readonly credits: number;
  readonly maxCredits: number;
  readonly allowDuplicate: boolean;
  readonly confirmation: string;
  readonly submit: () => Promise<SubmittedJob>;
}): Promise<PaidSubmission> => {
  const { ctx, credits } = request;
  enforceSpendCaps({ credits, maxCredits: request.maxCredits, operatorCap: ctx.config.maxCreditsPerCall });
  const key = hashKey(`${ctx.keyHash}|${request.tool}|${JSON.stringify(request.body)}`);
  const previous = request.allowDuplicate ? undefined : ctx.deps.dedupe.peek(key);
  if (previous?.kind === 'success') return { kind: 'submitted', job: previous.value, deduplicated: true };
  if (previous?.kind === 'unknown') {
    throw new ApiError({ kind: 'network' }, { operation: 'submit', resource: request.resource });
  }
  const decision = ctx.confirmSpend({ credits, message: request.confirmation });
  if (decision.kind === 'ask') return decision;
  if (decision.kind === 'declined') {
    fail('cancelled_by_user', `The user declined to spend ${String(credits)} credits. Nothing was charged.`);
  }
  if (ctx.deps.clock.now() - ctx.startedAt > SUBMIT_BUDGET_MS) {
    fail(
      'try_again',
      `The source check took too long to submit in this call. Its result is cached; call ${request.tool} again now.`,
    );
  }
  if (request.allowDuplicate) return { kind: 'submitted', job: await request.submit(), deduplicated: false };
  const { value, deduplicated } = await ctx.deps.dedupe.run(key, request.submit);
  return { kind: 'submitted', job: value, deduplicated };
};

const createInput = z.object({
  source_url: SourceUrl,
  start_sec: StartSec,
  end_sec: EndSec,
  max_credits: MaxCredits,
  ...createOptionFields,
  allow_duplicate: AllowDuplicate,
});

const CreateClipJobOutput = z.object({
  job_id: z.string(),
  status: JobStatusOutput,
  credits: z.number().int().describe('Credits charged for this job (same formula as the API).'),
  start_sec: z.number(),
  end_sec: z.number(),
  source_url: z.string(),
  deduplicated: z
    .boolean()
    .describe(
      'True when an identical request from the last 10 minutes was returned instead of creating a new job (nothing was charged now).',
    ),
  next_step: z.string().describe('e.g. "Call get_clip_job with job_id and wait_sec=50."'),
});

export const createClipJob = defineTool({
  name: 'create_clip_job',
  toolset: 'clips',
  title: 'Create clip job (spends credits)',
  description: [
    'Starts AI clipping of a long video into vertical 9:16 short clips with burned-in captions and a hook title, plus optional cold-open hooks, music and B-roll. Spends credits: 1 per started minute of the processed range (minimum 1), charged when the job is created. One job processes at most 30 minutes of video; split longer videos with start_sec and end_sec. Jobs cannot be cancelled.',
    'Before calling, run quote_clip_job, show the price to the user and get explicit agreement. max_credits is required; the call is refused without charging if the price is higher. Some clients also ask the user to confirm. If the same request was already submitted with this API key in the last 10 minutes, that job is returned instead of charging again.',
    'Use for turning a podcast, stream, interview, lecture or vlog into Shorts, Reels or TikTok clips. Not for: transcripts only (create_transcription), changing the look of an existing job (recut_clip_job), or re-running a failed job for free (retry_clip_job).',
    'Key parameters: source_url (public link; local files are not supported), start_sec and end_sec to process only part of the video, video_mode (podcast for talking heads), clip_length, caption_style, language (omit to auto-detect) and prompt to steer which moments are picked. Call get_options_guide to explain option values.',
    'Returns job_id right away with status queued and the credits charged. Processing takes a few minutes for short videos and up to tens of minutes for a full 30-minute range; clips appear one by one. Next, call get_clip_job with wait_sec=50 until the status is completed or failed. If processing fails, credits are not returned automatically: retry_clip_job re-runs the job for free, or the user can contact support@mnogo-reels.ru with the job_id. On the free plan clip files are kept for 30 days.',
  ].join('\n\n'),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  inputSchema: createInput,
  directoryInputSchema: createInput.omit(DIRECTORY_HIDDEN_FIELDS),
  outputSchema: CreateClipJobOutput,
  requiresApiKey: true,
  rateLimit: { bucket: 'paid', limit: 20, windowSec: 3600 },
  handler: async (args, ctx) => {
    const { href, host } = parsedSource(args.source_url);
    const probe = await probeForPricing({
      ctx,
      href,
      windowComplete: args.end_sec !== undefined,
      ...(args.end_sec === undefined ? {} : { timeoutMs: COMPLETE_WINDOW_PROBE_MS }),
    });
    const window = explicitWindow({
      startSec: args.start_sec,
      endSec: args.end_sec,
      durationSec: probe?.durationSec ?? null,
      maxWindowSec: ctx.config.maxWindowSec,
    });
    const body = {
      url: href,
      start_sec: window.start,
      end_sec: window.end,
      ...createBodyOptions(args, ctx.config.directory),
    };
    const outcome = await submitPaid({
      ctx,
      tool: 'create_clip_job',
      resource: 'clip job',
      body,
      credits: window.credits,
      maxCredits: args.max_credits,
      allowDuplicate: args.allow_duplicate,
      confirmation: `Create clips from "${sourceLabel(probe?.title, host)}" (${minutesAndSeconds(window.end - window.start)} of video) for ${String(window.credits)} credits? ${PAID_CONFIRMATION_TAIL}`,
      submit: async () => {
        const job = await submitClipJob(ctx.http, body);
        return { jobId: job.id, status: job.status, credits: window.credits };
      },
    });
    if (outcome.kind === 'ask') return outcome.result;
    return {
      job_id: outcome.job.jobId,
      status: toJobStatus(outcome.job.status),
      credits: outcome.job.credits,
      start_sec: window.start,
      end_sec: window.end,
      source_url: href,
      deduplicated: outcome.deduplicated,
      next_step: 'Call get_clip_job with job_id and wait_sec=50.',
    };
  },
});
