import { z } from 'zod';

export const BrollCardSchema = z.object({
  id: z.string(),
  catalog: z.string().nullish(),
  kind: z.string(),
  title: z.string().nullish(),
  bytes: z.number().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  duration_sec: z.number().nullish(),
  source: z.string().nullish(),
  attribution: z.unknown().optional(),
  created_at: z.string().nullish(),
  preview_state: z.string().nullish(),
  description: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  media_url: z.string().nullish(),
  poster_url: z.string().nullish(),
  url_expires_in: z.number().nullish(),
});

export type BrollCard = z.output<typeof BrollCardSchema>;

export const BrollListSchema = z.object({ items: z.array(BrollCardSchema), next_cursor: z.string().nullish() });

export const AttributionSchema = z.object({
  video_page: z.string().nullish(),
  page_url: z.string().nullish(),
  provider: z.string().nullish(),
  author: z.object({ name: z.string().nullish(), url: z.string().nullish() }).nullish(),
});

export const PackPartSchema = z.object({
  status: z.string(),
  error: z.string().nullish(),
  job_id: z.string().nullish(),
});

export const PackSchema = z.object({
  id: z.string(),
  status: z.string(),
  progress: z.number().nullish(),
  source_url: z.string(),
  language: z.string().nullish(),
  parts: z.record(z.string(), PackPartSchema).nullish(),
  clips_job_id: z.string().nullish(),
  transcript: z.object({ language: z.string().nullish(), text: z.string(), srt: z.string().nullish() }).nullish(),
  meta: z
    .object({
      language: z.string().nullish(),
      titles: z.array(z.string()),
      descriptions: z.array(z.string()),
      cover_texts: z.array(z.string()),
      hashtags: z.array(z.string()).nullish(),
    })
    .nullish(),
  thumbnails: z
    .array(
      z.object({
        id: z.string(),
        image_url: z.string(),
        width: z.number().nullish(),
        height: z.number().nullish(),
        cover_text: z.string().nullish(),
      }),
    )
    .nullish(),
  teasers: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().nullish(),
        video_url: z.string(),
        duration_seconds: z.number().nullish(),
      }),
    )
    .nullish(),
  article: z.object({ id: z.string(), status: z.string(), title: z.string().nullish() }).nullish(),
  created_at: z.string().nullish(),
  completed_at: z.string().nullish(),
});

export type Pack = z.output<typeof PackSchema>;

export const PackListSchema = z.object({ items: z.array(PackSchema) });
