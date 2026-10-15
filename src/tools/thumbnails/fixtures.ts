import type { z } from 'zod';
import type { ThumbnailJobSchema } from './schemas.js';

type ThumbnailJob = z.input<typeof ThumbnailJobSchema>;
type ThumbnailVariant = NonNullable<ThumbnailJob['variants']>[number];

export const THUMBNAIL_JOB_ID = '0123456789abcdef0123456789abcdef';
export const R2_MEDIA = 'https://pub-d86608a8848d48d885d3865737f7f771.r2.dev';

export const aVariant = (overrides: Partial<ThumbnailVariant> = {}): ThumbnailVariant => ({
  id: '1',
  image_url: `${R2_MEDIA}/smart-reels/${THUMBNAIL_JOB_ID}/thumbnails/1.jpg`,
  width: 1280,
  height: 720,
  ...overrides,
});

export const aThumbnailJob = (overrides: Partial<ThumbnailJob> = {}): ThumbnailJob => ({
  id: THUMBNAIL_JOB_ID,
  status: 'queued',
  stage: 'queued',
  progress: 0,
  requested_variants: 1,
  variants: [],
  error: null,
  ...overrides,
});
