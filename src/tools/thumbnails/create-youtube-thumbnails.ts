import { z } from 'zod';
import { fail } from '../../api/errors.js';
import { parseSourceUrl } from '../../domain/source-url.js';
import { defineTool } from '../../server/registry.js';
import { JobStatusOutput, SourceUrl, toJobStatus } from '../../shaping/fragments.js';
import { createThumbnailJob } from './api.js';

const CreateThumbnailsInput = z.object({
  source_url: SourceUrl,
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .describe('Two-letter language of the text on the thumbnail, e.g. en; match the title or the video.'),
  title: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe('Text printed on the thumbnail, ≤120 characters; omit to let the AI write it.'),
  prompt: z
    .string()
    .min(1)
    .max(1000)
    .optional()
    .describe('Art direction, e.g. "surprised face, red arrow, dark background".'),
  style: z
    .enum(['auto', 'bold', 'cinematic', 'minimal', 'news', 'gaming'])
    .default('auto')
    .describe('auto, bold, cinematic, minimal, news or gaming.'),
  variants: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe('Number of images, 1–4 (each is a separate AI generation).'),
});

const CreateThumbnailsOutput = z.object({
  thumbnail_job_id: z.string(),
  status: JobStatusOutput,
  variants_requested: z.number().int(),
  next_step: z.string(),
});

export const createYoutubeThumbnails = defineTool({
  name: 'create_youtube_thumbnails',
  toolset: 'thumbnails',
  title: 'Create YouTube thumbnails',
  description: [
    'Generates 1 to 4 AI YouTube thumbnail images (1280×720 JPEG) for a video, using frames from the video plus an optional title and art direction. Free: spends no credits, but every variant is a separate AI image generation, so ask for more than one only when the user wants options.',
    'Parameters: source_url (link to the video), language of the text on the thumbnail (required; match the title or the video), title (text to place on the thumbnail, up to 120 characters), prompt (art direction, up to 1000 characters), style (auto, bold, cinematic, minimal, news, gaming) and variants (1 to 4, default 1).',
    'Returns thumbnail_job_id right away. It usually finishes in 1 to 2 minutes. Next, call get_youtube_thumbnails with wait_sec=50.',
  ].join('\n\n'),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  inputSchema: CreateThumbnailsInput,
  outputSchema: CreateThumbnailsOutput,
  requiresApiKey: true,
  rateLimit: { bucket: 'thumbnails', limit: 10, windowSec: 3600 },
  handler: async (args, ctx) => {
    const source = parseSourceUrl(args.source_url);
    if (source.kind === 'invalid') return fail('invalid_arguments', source.message);
    const job = await createThumbnailJob(ctx, {
      url: source.href,
      language: args.language,
      title: args.title,
      prompt: args.prompt,
      style: args.style,
      variants: args.variants,
    });
    return {
      thumbnail_job_id: job.id,
      status: toJobStatus(job.status),
      variants_requested: args.variants,
      next_step: 'Call get_youtube_thumbnails with thumbnail_job_id and wait_sec=50.',
    };
  },
});
