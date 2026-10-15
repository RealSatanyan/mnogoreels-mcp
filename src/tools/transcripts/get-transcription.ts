import { z } from 'zod';
import { pollUntil } from '../../runtime/poll.js';
import { defineTool } from '../../server/registry.js';
import { fenceUntrusted } from '../../shaping/fence.js';
import {
  ErrorSummaryOutput,
  JobStatusOutput,
  MaxChars,
  TextOffset,
  WaitSec,
  progressPercent,
  toJobStatus,
  type JobStatus,
} from '../../shaping/fragments.js';
import { fitToBudget, pageUntrusted } from '../../shaping/page.js';
import { fetchTranscription } from './api.js';
import { renderTranscript, type TranscriptFormat } from './render.js';
import type { Transcription } from './schemas.js';

const ERROR_CHARS = 300;
const POLL_INTERVAL_MS = 5_000;
const FAILED_HINT =
  'The source could not be transcribed. Check that the link is public and call create_transcription again (free).';
const FORMATS = ['text', 'srt', 'segments'] as const;

const GetTranscriptionOutput = z.object({
  transcription_id: z.string(),
  status: JobStatusOutput,
  is_terminal: z.boolean(),
  progress_percent: z.number().int().nullable(),
  language: z.string().nullable(),
  format: z.enum(FORMATS),
  content: z
    .string()
    .nullable()
    .describe('The requested page, wrapped in <untrusted_source_text>; null until completed.'),
  total_chars: z.number().int().nullable(),
  truncated: z.boolean(),
  next_offset: z.number().int().nullable(),
  error: ErrorSummaryOutput,
  waited_sec: z.number(),
});

type GetTranscriptionOutput = z.output<typeof GetTranscriptionOutput>;

const isTerminal = (status: JobStatus): boolean => status === 'completed' || status === 'failed';

const describeProgress = (transcription: Transcription): string => {
  const percent = progressPercent(transcription.progress);
  const status = toJobStatus(transcription.status);
  return percent === null ? status : `${status} ${String(percent)}%`;
};

const errorSummary = (transcription: Transcription, status: JobStatus): GetTranscriptionOutput['error'] =>
  status === 'failed'
    ? {
        message: fenceUntrusted(transcription.error?.slice(0, ERROR_CHARS)) ?? 'No reason was reported.',
        hint: FAILED_HINT,
      }
    : null;

export const toTranscriptionOutput = (options: {
  readonly transcription: Transcription;
  readonly format: TranscriptFormat;
  readonly offset: number;
  readonly maxChars: number;
  readonly waitedSec: number;
}): GetTranscriptionOutput => {
  const { transcription } = options;
  const status = toJobStatus(transcription.status);
  const page =
    status === 'completed'
      ? pageUntrusted({
          text: renderTranscript(transcription, options.format),
          offset: options.offset,
          maxChars: options.maxChars,
        })
      : undefined;
  return {
    transcription_id: transcription.id,
    status,
    is_terminal: isTerminal(status),
    progress_percent: progressPercent(transcription.progress),
    language: transcription.language ?? null,
    format: options.format,
    content: page?.content ?? null,
    total_chars: page?.totalChars ?? null,
    truncated: page?.truncated ?? false,
    next_offset: page?.nextOffset ?? null,
    error: errorSummary(transcription, status),
    waited_sec: options.waitedSec,
  };
};

export const getTranscription = defineTool({
  name: 'get_transcription',
  toolset: 'transcripts',
  title: 'Get transcription',
  description: [
    'Returns the status and text of a transcription started with create_transcription. Read-only and free.',
    'wait_sec (default 30, max 50) waits for completion inside this call; progress notifications are sent meanwhile. format selects the output: text (plain text, default), srt (subtitles with timecodes) or segments (one timed phrase per line). Long transcripts come in pages of up to max_chars characters; when truncated is true, call again with offset set to next_offset.',
    'Returns status (queued, processing, completed, failed), progress_percent, the detected language, total_chars and the requested page. The transcript comes from the video and is wrapped in <untrusted_source_text> tags.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: z.object({
    transcription_id: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .describe('Id returned by create_transcription.'),
    wait_sec: WaitSec,
    format: z
      .enum(FORMATS)
      .default('text')
      .describe('text = plain text; srt = subtitles with timecodes; segments = one timed phrase per line.'),
    offset: TextOffset,
    max_chars: MaxChars(24000, 20000),
  }),
  outputSchema: GetTranscriptionOutput,
  requiresApiKey: true,
  handler: async (args, ctx) => {
    const { value, waitedSec } = await pollUntil({
      load: (signal) =>
        fetchTranscription({
          http: ctx.http,
          id: args.transcription_id,
          control: { signal, deadline: ctx.deadline },
        }),
      isTerminal: (transcription) => isTerminal(toJobStatus(transcription.status)),
      describe: describeProgress,
      waitSec: args.wait_sec,
      intervalMs: POLL_INTERVAL_MS,
      clock: ctx.deps.clock,
      signal: ctx.signal,
      toolDeadline: ctx.deadline,
      onProgress: ctx.reportProgress,
    });
    return fitToBudget({
      build: (maxChars) =>
        toTranscriptionOutput({
          transcription: value,
          format: args.format,
          offset: args.offset,
          maxChars,
          waitedSec,
        }),
      maxChars: args.max_chars,
    });
  },
});
