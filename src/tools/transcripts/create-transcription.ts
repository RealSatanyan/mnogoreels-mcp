import { z } from 'zod';
import { fail } from '../../api/errors.js';
import { parseSourceUrl } from '../../domain/source-url.js';
import { defineTool } from '../../server/registry.js';
import { JobStatusOutput, LanguageCode, SourceUrl, toJobStatus } from '../../shaping/fragments.js';
import { submitTranscription } from './api.js';

const CreateTranscriptionOutput = z.object({
  transcription_id: z.string(),
  status: JobStatusOutput,
  next_step: z.string(),
});

export const createTranscription = defineTool({
  name: 'create_transcription',
  toolset: 'transcripts',
  title: 'Transcribe video or audio',
  description: [
    'Starts a timed speech-to-text transcription of a video or audio link. Free: spends no credits. Supports the same links as create_clip_job (YouTube, VK Video, RuTube, Dzen, Twitch, Yandex Disk, Google Drive and direct media links); local files are not supported.',
    'Use it when the user needs the text, subtitles (SRT) or timestamps of a video without making clips. For a video that already has a completed clip job, create_article returns the full timed transcript together with an article.',
    'language is a two-letter code such as en or ru; omit it to auto-detect (one language for the whole recording).',
    'Returns transcription_id right away. It usually finishes in 1 to 5 minutes; long recordings take longer. Next, call get_transcription with wait_sec=50.',
  ].join('\n\n'),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  inputSchema: z.object({
    source_url: SourceUrl.describe('Public link to the video or audio.'),
    language: LanguageCode,
  }),
  outputSchema: CreateTranscriptionOutput,
  requiresApiKey: true,
  rateLimit: { bucket: 'transcribe', limit: 30, windowSec: 3600 },
  handler: async (args, ctx) => {
    const source = parseSourceUrl(args.source_url);
    if (source.kind === 'invalid') return fail('invalid_arguments', source.message);
    const transcription = await submitTranscription({ http: ctx.http, url: source.href, language: args.language });
    return {
      transcription_id: transcription.id,
      status: toJobStatus(transcription.status),
      next_step: `Call get_transcription with transcription_id ${transcription.id} and wait_sec=50.`,
    };
  },
});
