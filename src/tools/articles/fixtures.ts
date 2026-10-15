import type { z } from 'zod';
import type { ArticleJobSchema } from './schemas.js';

type ArticleJobInput = z.input<typeof ArticleJobSchema>;

export const ARTICLE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const CLIP_JOB_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const OTHER_CLIP_JOB_ID = 'cccccccccccccccccccccccccccccccc';

export const aGeneratedArticle = (
  overrides: Partial<NonNullable<ArticleJobInput['article']>> = {},
): NonNullable<ArticleJobInput['article']> => ({
  language: 'en',
  title: 'How to edit faster',
  seo_title: 'Edit videos faster',
  seo_description: 'Five habits that halve editing time.',
  summary: 'Editing gets faster with a few habits.',
  sections: [
    { heading: 'Plan first', paragraphs: ['Write a shot list.', 'Keep it short.'] },
    { heading: 'Cut on beat', paragraphs: ['Use the music.'] },
  ],
  key_takeaways: ['Plan', 'Cut', 'Export'],
  timestamps: [
    { start_seconds: 0, end_seconds: 65, title: 'Intro', summary: 'Why speed matters' },
    { start_seconds: 65.9, end_seconds: null, title: 'Planning', summary: null },
  ],
  guest: null,
  ...overrides,
});

export const anArticleTranscript = (
  overrides: Partial<NonNullable<ArticleJobInput['transcript']>> = {},
): NonNullable<ArticleJobInput['transcript']> => ({
  language: 'en',
  text: 'Hello and welcome. Today we edit.',
  segments: [
    { start_seconds: 0, end_seconds: 4.2, text: 'Hello and welcome.', speaker: null },
    { start_seconds: 4.2, end_seconds: 7, text: 'Today we edit.', speaker: 'Host' },
  ],
  ...overrides,
});

export const anArticleJob = (overrides: Partial<ArticleJobInput> = {}): ArticleJobInput => ({
  id: ARTICLE_ID,
  source_job_id: CLIP_JOB_ID,
  status: 'completed',
  stage: 'completed',
  progress: 1,
  source: {
    url: 'https://www.youtube.com/watch?v=abc123',
    title: 'Editing tips',
    channel_name: 'Edit Channel',
    published_at: '2026-09-01',
    duration_seconds: 612.345,
  },
  article: aGeneratedArticle(),
  transcript: anArticleTranscript(),
  images: [],
  images_status: 'completed',
  images_error: null,
  error: null,
  ...overrides,
});

export const aQueuedArticleJob = (overrides: Partial<ArticleJobInput> = {}): ArticleJobInput =>
  anArticleJob({
    status: 'queued',
    stage: 'queued',
    progress: 0,
    source: null,
    article: null,
    transcript: null,
    images: [],
    images_status: 'pending',
    ...overrides,
  });
