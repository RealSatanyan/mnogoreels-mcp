import { z } from 'zod';
import { mediaLink, safeHttpUrl, type MediaUrlMode } from '../../domain/media-urls.js';
import { pollUntil } from '../../runtime/poll.js';
import { defineTool } from '../../server/registry.js';
import { fenceUntrusted } from '../../shaping/fence.js';
import {
  ErrorSummaryOutput,
  JobStatusOutput,
  MaxChars,
  MediaLinkOutput,
  TextOffset,
  UNTRUSTED_TEXT_NOTE,
  WaitSec,
  progressPercent,
  toJobStatus,
} from '../../shaping/fragments.js';
import { fitToBudget, pageUntrusted } from '../../shaping/page.js';
import { fetchArticle } from './api.js';
import { renderArticleMarkdown } from './markdown.js';
import type { ArticleJob } from './schemas.js';

const ERROR_CHARS = 300;
const POLL_INTERVAL_MS = 5_000;
const IMAGES_IN_PROGRESS = new Set(['processing', 'pending']);
const FAILED_HINT =
  'Failed articles cannot be regenerated through the API; contact support@mnogo-reels.ru with the clip job id.';

const Untrusted = z.string().nullable().describe(UNTRUSTED_TEXT_NOTE);

const GetArticleOutput = z.object({
  article_id: z.string(),
  status: JobStatusOutput,
  is_terminal: z.boolean(),
  images_pending: z.boolean().describe('True while illustrations are still being prepared; the text is final.'),
  stage: z.string().nullable(),
  progress_percent: z.number().int().nullable(),
  clip_job_id: z.string().describe('Clip job the article was created from.'),
  source: z
    .object({
      url: z.string().nullable(),
      title: Untrusted,
      channel_name: Untrusted,
      duration_sec: z.number().nullable(),
      published_at: z.string().nullable(),
    })
    .nullable(),
  seo: z.object({ title: Untrusted, description: Untrusted }).nullable(),
  content_markdown: Untrusted,
  total_chars: z.number().int().nullable(),
  truncated: z.boolean(),
  next_offset: z.number().int().nullable(),
  images: z.array(
    z.object({ image: MediaLinkOutput, alt: Untrusted, caption: Untrusted, timestamp_sec: z.number().nullable() }),
  ),
  images_status: z.string().nullable(),
  error: ErrorSummaryOutput,
  waited_sec: z.number(),
});

type GetArticleOutput = z.output<typeof GetArticleOutput>;

const round1 = (value: number | null | undefined): number | null =>
  value === null || value === undefined ? null : Math.round(value * 10) / 10;

const isFinished = (job: ArticleJob): boolean => {
  const status = toJobStatus(job.status);
  return status === 'completed' || status === 'failed';
};

const imagesPending = (job: ArticleJob): boolean =>
  Boolean(job.article) && !isFinished(job) && IMAGES_IN_PROGRESS.has(job.images_status ?? '');

const isTerminal = (job: ArticleJob): boolean => isFinished(job) || imagesPending(job);

const describeProgress = (job: ArticleJob): string => {
  const percent = progressPercent(job.progress);
  const head = percent === null ? toJobStatus(job.status) : `${toJobStatus(job.status)} ${String(percent)}%`;
  return job.stage ? `${head} · ${job.stage}` : head;
};

const imagesOf = (job: ArticleJob, mode: MediaUrlMode): GetArticleOutput['images'] =>
  job.images_status === 'failed'
    ? []
    : (job.images ?? []).flatMap((image) => {
        const url = safeHttpUrl(image.image_url);
        return url === null
          ? []
          : [
              {
                image: mediaLink(url, mode),
                alt: fenceUntrusted(image.alt),
                caption: fenceUntrusted(image.caption),
                timestamp_sec: round1(image.timestamp_seconds),
              },
            ];
      });

const sourceOf = (job: ArticleJob): GetArticleOutput['source'] =>
  job.source
    ? {
        url: safeHttpUrl(job.source.url),
        title: fenceUntrusted(job.source.title),
        channel_name: fenceUntrusted(job.source.channel_name),
        duration_sec: round1(job.source.duration_seconds),
        published_at: job.source.published_at ?? null,
      }
    : null;

const errorOf = (job: ArticleJob): GetArticleOutput['error'] =>
  toJobStatus(job.status) === 'failed'
    ? { message: fenceUntrusted(job.error?.slice(0, ERROR_CHARS)) ?? 'No reason was reported.', hint: FAILED_HINT }
    : null;

export const toArticleOutput = (options: {
  readonly job: ArticleJob;
  readonly includeTranscript: boolean;
  readonly offset: number;
  readonly maxChars: number;
  readonly mediaUrls: MediaUrlMode;
  readonly waitedSec: number;
}): GetArticleOutput => {
  const { job } = options;
  const page = job.article
    ? pageUntrusted({
        text: renderArticleMarkdown({
          article: job.article,
          transcript: job.transcript,
          includeTranscript: options.includeTranscript,
        }),
        offset: options.offset,
        maxChars: options.maxChars,
      })
    : undefined;
  return {
    article_id: job.id,
    status: toJobStatus(job.status),
    is_terminal: isTerminal(job),
    images_pending: imagesPending(job),
    stage: job.stage ?? null,
    progress_percent: progressPercent(job.progress),
    clip_job_id: job.source_job_id,
    source: sourceOf(job),
    seo: job.article
      ? { title: fenceUntrusted(job.article.seo_title), description: fenceUntrusted(job.article.seo_description) }
      : null,
    content_markdown: page?.content ?? null,
    total_chars: page?.totalChars ?? null,
    truncated: page?.truncated ?? false,
    next_offset: page?.nextOffset ?? null,
    images: imagesOf(job, options.mediaUrls),
    images_status: job.images_status ?? null,
    error: errorOf(job),
    waited_sec: options.waitedSec,
  };
};

export const getArticle = defineTool({
  name: 'get_article',
  toolset: 'articles',
  title: 'Get article',
  description: [
    'Returns an article created with create_article as Markdown, with its status. Read-only and free.',
    'wait_sec (default 30, max 50) waits inside this call until the text is ready. The Markdown contains the title, summary, sections, key takeaways and chapter timestamps; set include_transcript=true to append the full timed transcript. Long content is paged: when truncated is true, call again with offset set to next_offset.',
    'Returns status (queued, processing, completed, failed), progress_percent, the Markdown page as soon as the text exists (images_pending=true means illustrations are still being prepared; the text will not change), the SEO title and description, image links with captions and source video details. Images that failed cannot be retried through this server. The article is generated from the video and wrapped in <untrusted_source_text> tags.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: z.object({
    article_id: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .describe('article_id returned by create_article.'),
    wait_sec: WaitSec,
    include_transcript: z.boolean().default(false).describe('true appends the full timed transcript (paged).'),
    offset: TextOffset,
    max_chars: MaxChars(24000, 20000),
  }),
  outputSchema: GetArticleOutput,
  requiresApiKey: true,
  handler: async (args, ctx) => {
    const { value, waitedSec } = await pollUntil({
      load: (signal) =>
        fetchArticle({ http: ctx.http, id: args.article_id, control: { signal, deadline: ctx.deadline } }),
      isTerminal,
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
        toArticleOutput({
          job: value,
          includeTranscript: args.include_transcript,
          offset: args.offset,
          maxChars,
          mediaUrls: ctx.config.mediaUrls,
          waitedSec,
        }),
      maxChars: args.max_chars,
    });
  },
});
