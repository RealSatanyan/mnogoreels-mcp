import { z } from 'zod';
import { fail } from '../../api/errors.js';
import { formatWindow } from '../../domain/options.js';
import { detectPlatform } from '../../domain/source-url.js';
import { EndSec, JobId, SourceUrl, StartSec } from '../../shaping/fragments.js';
import { defineTool, type ToolContext } from '../../server/registry.js';
import { fenceShort, round1 } from './assemble.js';
import { loadClipJob, requireApiKey } from './job-kind.js';
import { PlatformOutput, parsedSource, probeForPricing } from './probe.js';
import { resolveWindow, type PricedWindow } from './window.js';

export const FAILED_JOB_NOTE =
  'Jobs cannot be cancelled. If processing fails, credits are not returned automatically; retry_clip_job re-runs a failed job for free, or contact support@mnogo-reels.ru with the job_id.';

const QuoteClipJobOutput = z.object({
  credits: z
    .number()
    .int()
    .describe(
      'Credits that create_clip_job or recut_clip_job will charge for this range (an upper bound when credits_exact is false).',
    ),
  credits_exact: z
    .boolean()
    .describe('False only for a recut that reuses the original range: the charge is at most credits.'),
  billed_seconds: z
    .number()
    .nullable()
    .describe('Length of the billed range; null when a recut reuses the original range.'),
  start_sec: z.number().nullable().describe("null = the original job's range is reused (recut)."),
  end_sec: z.number().nullable(),
  source_url: z.string(),
  platform: PlatformOutput,
  downloadable: z
    .boolean()
    .nullable()
    .describe('null when the check could not run right now (the range was given, so the price is still exact).'),
  source_title: z.string().nullable().describe('Wrapped in <untrusted_source_text>.'),
  source_duration_sec: z.number().nullable(),
  job_id: z.string().nullable().describe('The clip job this recut quote is for; null for a new video.'),
  pricing_rule: z.string().describe('1 credit per started minute of the range, minimum 1; at most 30 minutes per job.'),
  note: z
    .string()
    .describe(
      'Jobs cannot be cancelled. If processing fails, credits are not returned automatically; retry_clip_job re-runs a failed job for free, or contact support@mnogo-reels.ru with the job_id.',
    ),
});

const ONE_SOURCE = 'Give either source_url (new video) or job_id (recut), not both.';

const sourceOf = async (
  args: { readonly source_url?: string | undefined; readonly job_id?: string | undefined },
  ctx: ToolContext,
): Promise<string> => {
  const { source_url: sourceUrl, job_id: jobId } = args;
  if (jobId === undefined) return sourceUrl ?? fail('invalid_arguments', ONE_SOURCE);
  if (sourceUrl !== undefined) return fail('invalid_arguments', ONE_SOURCE);
  requireApiKey(ctx);
  const job = await loadClipJob({ http: ctx.http, id: jobId, control: { signal: ctx.signal, deadline: ctx.deadline } });
  return job.source_url;
};

const rangeFields = (window: PricedWindow) =>
  window.kind === 'explicit'
    ? { credits_exact: true, billed_seconds: window.billedSeconds, start_sec: window.start, end_sec: window.end }
    : { credits_exact: false, billed_seconds: null, start_sec: null, end_sec: null };

export const quoteClipJob = defineTool({
  name: 'quote_clip_job',
  toolset: 'clips',
  title: 'Quote clip job cost',
  description: [
    'Calculates the credit cost of create_clip_job or recut_clip_job without spending anything, and checks that MnogoReels can download the video. Free and read-only.',
    'Price: 1 credit per started minute of the processed range (end_sec minus start_sec), minimum 1. Options such as caption style, hooks, B-roll or music do not change the price. One job processes at most 30 minutes; for longer videos quote several ranges with start_sec and end_sec. Without start_sec and end_sec the whole video is priced, so its length must be known; this tool looks it up.',
    "Pass source_url to price a new video, or job_id to price a recut of an existing clip job. A recut without start_sec and end_sec reuses the original job's range, which the API does not reveal; the quote is then an upper bound (the whole source video) and credits_exact is false. Show the credits to the user and get their agreement before calling create_clip_job or recut_clip_job with max_credits of at least this amount.",
    'Returns credits, credits_exact, billed_seconds, the resolved start_sec and end_sec, the platform, whether the video can be downloaded, the source title and length, and a note about failed jobs. If the length cannot be determined (typical for direct file links), the error explains how to pass end_sec yourself.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  inputSchema: z.object({
    source_url: SourceUrl.optional(),
    job_id: JobId.optional().describe('Existing clip job to price a recut for. Give either source_url or job_id.'),
    start_sec: StartSec,
    end_sec: EndSec,
  }),
  outputSchema: QuoteClipJobOutput,
  requiresApiKey: false,
  rateLimit: { bucket: 'probe', limit: 30, windowSec: 60 },
  handler: async (args, ctx) => {
    const rawSource = await sourceOf(args, ctx);
    const { href } = parsedSource(rawSource);
    const inherit = args.job_id !== undefined && args.start_sec === undefined && args.end_sec === undefined;
    const probe = await probeForPricing({ ctx, href, windowComplete: !inherit && args.end_sec !== undefined });
    const window = resolveWindow({
      startSec: args.start_sec,
      endSec: args.end_sec,
      durationSec: probe?.durationSec ?? null,
      maxWindowSec: ctx.config.maxWindowSec,
      inherit,
    });
    return {
      credits: window.credits,
      ...rangeFields(window),
      source_url: href,
      platform: probe?.platform ?? detectPlatform(href),
      downloadable: probe?.downloadable ?? null,
      source_title: fenceShort(probe?.title, 300),
      source_duration_sec: round1(probe?.durationSec),
      job_id: args.job_id ?? null,
      pricing_rule: `1 credit per started minute of the range, minimum 1; at most ${formatWindow(ctx.config.maxWindowSec)} per job.`,
      note: FAILED_JOB_NOTE,
    };
  },
});
