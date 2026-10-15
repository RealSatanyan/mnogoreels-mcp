import type { z } from 'zod';
import type { BrollCardSchema, BrollListSchema, PackListSchema, PackSchema } from './schemas.js';

type BrollCardInput = z.input<typeof BrollCardSchema>;
type PackInput = z.input<typeof PackSchema>;

export const ASSET_ID = '3f'.repeat(32);
export const PACK_ID = '9c'.repeat(16);
export const CLIP_JOB_ID = '5e'.repeat(16);
export const ARTICLE_ID = '7a'.repeat(16);

export const presignedUrl = (file: string): string =>
  [
    `https://${'a1'.repeat(16)}.r2.cloudflarestorage.com/mnogo-shorts/library/broll/${ASSET_ID}/${file}`,
    `?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${'K'.repeat(32)}%2F20260917%2Fauto%2Fs3%2Faws4_request`,
    `&X-Amz-Date=20260917T120000Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=${'0'.repeat(64)}`,
  ].join('');

export const aBrollCard = (overrides: Partial<BrollCardInput> = {}): BrollCardInput => ({
  id: ASSET_ID,
  catalog: 'mine',
  kind: 'video',
  title: 'Sunset over the sea',
  bytes: 1_234_567,
  width: 1080,
  height: 1920,
  duration_sec: 5.2,
  source: 'pexels',
  attribution: {
    provider: 'pexels',
    page_url: 'https://www.pexels.com/video/123',
    author: { name: 'Jane Doe', url: 'https://www.pexels.com/@jane' },
  },
  created_at: '2026-09-17T12:00:00.123000',
  preview_state: 'ready',
  description: null,
  tags: null,
  media_url: presignedUrl('original.mp4'),
  poster_url: presignedUrl('poster.jpg'),
  url_expires_in: 900,
  ...overrides,
});

export const aSharedBrollCard = (overrides: Partial<BrollCardInput> = {}): BrollCardInput =>
  aBrollCard({
    catalog: 'shared',
    source: 'generated',
    description: 'Calm waves at golden hour',
    tags: ['sea', 'sunset'],
    attribution: {
      video_page: 'https://www.youtube.com/watch?v=abc',
      author: { name: 'Sea Channel', url: 'https://www.youtube.com/@sea' },
    },
    ...overrides,
  });

export const aBrollPage = (
  items: readonly BrollCardInput[],
  nextCursor: string | null = null,
): z.input<typeof BrollListSchema> => ({ items: [...items], next_cursor: nextCursor });

export const aPack = (overrides: Partial<PackInput> = {}): PackInput => ({
  id: PACK_ID,
  status: 'completed',
  progress: 1,
  source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  language: 'en',
  parts: {
    clips: { status: 'completed', job_id: CLIP_JOB_ID },
    transcript: { status: 'completed' },
    meta: { status: 'completed' },
    thumbnails: { status: 'completed' },
    article: { status: 'processing' },
    teasers: { status: 'skipped' },
  },
  clips_job_id: CLIP_JOB_ID,
  transcript: null,
  meta: {
    language: 'en',
    titles: ['Title one', 'Title two', 'Title three'],
    descriptions: ['Description one', 'Description two', 'Description three'],
    cover_texts: ['Cover one', 'Cover two', 'Cover three'],
    hashtags: ['#shorts', '#music'],
  },
  thumbnails: [
    {
      id: 'thumb-1',
      image_url: 'http://pub-d86608a8848d48d885d3865737f7f771.r2.dev/smart-reels/packs/thumb-1.jpg',
      width: 1280,
      height: 720,
      cover_text: 'Cover one',
    },
  ],
  teasers: [
    {
      id: 'teaser-1',
      title: 'Best moments',
      video_url: 'https://d1abcdef.cloudfront.net/smart-reels/packs/teaser-1.mp4',
      duration_seconds: 31.46,
    },
  ],
  article: { id: ARTICLE_ID, status: 'completed', title: 'How it works' },
  created_at: '2026-10-01T10:00:00',
  completed_at: '2026-10-01T10:20:00',
  ...overrides,
});

export const aPackList = (
  items: readonly PackInput[],
): z.input<typeof PackListSchema> & { readonly total: number } => ({
  items: [...items],
  total: items.length,
});

const longText = (length: number): string => 'Ж'.repeat(length);

const largestAttribution = {
  provider: 'pexels',
  video_page: `https://www.youtube.com/watch?v=${'x'.repeat(100)}`,
  page_url: `https://www.pexels.com/video/${'p'.repeat(100)}`,
  author: { name: longText(100), url: `https://www.youtube.com/@${'y'.repeat(100)}` },
};

export const largestBrollCard = (catalog: 'mine' | 'shared'): BrollCardInput =>
  catalog === 'mine'
    ? aBrollCard({ kind: 'motion', title: longText(120), attribution: largestAttribution })
    : aSharedBrollCard({
        kind: 'motion',
        title: longText(120),
        description: longText(2000),
        tags: Array.from({ length: 20 }, () => longText(80)),
        attribution: largestAttribution,
      });

const PART_NAMES = ['clips', 'transcript', 'meta', 'thumbnails', 'article', 'teasers'];

export const largestPack = (): PackInput =>
  aPack({
    status: 'processing',
    source_url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${'L'.repeat(64)}&index=100`,
    parts: Object.fromEntries(
      PART_NAMES.map((name) => [name, { status: 'processing', error: 'e'.repeat(1000), job_id: CLIP_JOB_ID }]),
    ),
    created_at: '2026-10-01T10:00:00.123456+00:00',
    completed_at: '2026-10-01T10:20:00.123456+00:00',
    meta: {
      language: 'ru',
      titles: Array.from({ length: 3 }, () => longText(120)),
      descriptions: Array.from({ length: 3 }, () => longText(1500)),
      cover_texts: Array.from({ length: 3 }, () => longText(60)),
      hashtags: Array.from({ length: 15 }, () => `#${longText(59)}`),
    },
    thumbnails: Array.from({ length: 3 }, (_, index) => ({
      id: `thumb-${String(index)}`,
      image_url: `https://pub-d86608a8848d48d885d3865737f7f771.r2.dev/smart-reels/packs/${PACK_ID}/thumb-${String(index)}.jpg`,
      width: 1280,
      height: 720,
      cover_text: longText(60),
    })),
    teasers: Array.from({ length: 2 }, (_, index) => ({
      id: `teaser-${String(index)}`,
      title: longText(120),
      video_url: `https://pub-d86608a8848d48d885d3865737f7f771.r2.dev/smart-reels/packs/${PACK_ID}/teaser-${String(index)}.mp4`,
      duration_seconds: 59.999,
    })),
    article: { id: ARTICLE_ID, status: 'processing', title: longText(200) },
  });
