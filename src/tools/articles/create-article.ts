import { z } from 'zod';
import { defineTool } from '../../server/registry.js';
import { JobId, JobStatusOutput, toJobStatus } from '../../shaping/fragments.js';
import { submitArticle } from './api.js';
import type { ArticleJob } from './schemas.js';

const CreateArticleOutput = z.object({
  article_id: z.string(),
  status: JobStatusOutput,
  clip_job_id: z.string().describe('Clip job the article was created from; may be another job of the same video.'),
  existing: z.boolean().describe('True when an article for this video already existed and was returned.'),
  next_step: z.string(),
});

const isExisting = (job: ArticleJob, clipJobId: string): boolean =>
  job.source_job_id !== clipJobId || job.status !== 'queued' || Boolean(job.article);

const nextStep = (job: ArticleJob): string =>
  job.status === 'failed'
    ? 'This article failed and cannot be regenerated through the API.'
    : `Call get_article with article_id ${job.id} and wait_sec=50.`;

export const createArticle = defineTool({
  name: 'create_article',
  toolset: 'articles',
  title: 'Create article from clip job',
  description: [
    'Turns the source video of a completed clip job into a long-form article: title, SEO title and description, summary, sections, key takeaways, chapters with timestamps, up to 4 frames from the video as illustrations, and the full timed transcript. Free: spends no credits.',
    'Use it for blog posts, show notes, chapter lists or the full transcript of a video that has already been clipped. It needs a clip job with status completed (create one with create_clip_job first). There is one article per source video per account: calling it again with any clip job of the same video returns the existing article instead of creating a new one; an article that failed cannot be regenerated through the API.',
    'Returns article_id, status and the clip job the article was made from. Writing usually takes 1 to 3 minutes. Next, call get_article with wait_sec=50.',
  ].join('\n\n'),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: z.object({
    clip_job_id: JobId.describe('Completed clip job whose source video the article is about (32 hex characters).'),
  }),
  outputSchema: CreateArticleOutput,
  requiresApiKey: true,
  rateLimit: { bucket: 'article', limit: 30, windowSec: 3600 },
  handler: async (args, ctx) => {
    const job = await submitArticle({ http: ctx.http, clipJobId: args.clip_job_id });
    return {
      article_id: job.id,
      status: toJobStatus(job.status),
      clip_job_id: job.source_job_id,
      existing: isExisting(job, args.clip_job_id),
      next_step: nextStep(job),
    };
  },
});
