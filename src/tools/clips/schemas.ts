import { z } from 'zod';

export const ColdHookSchema = z.object({
  url: z.string(),
  clip_id: z.number().nullish(),
  start: z.number().nullish(),
  end: z.number().nullish(),
  duration: z.number().nullish(),
  text: z.string().nullish(),
  reason: z.string().nullish(),
  score: z.number().nullish(),
});

export const JobResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  source_url: z.string(),
  s3_final_url: z.string().nullish(),
  s3_clip_urls: z.array(z.string()).nullish(),
  s3_clip_poster_urls: z.array(z.string().nullable()).nullish(),
  cold_hooks: z.array(ColdHookSchema).nullish(),
  teaser_url: z.string().nullish(),
  teaser_urls: z.array(z.string()).nullish(),
  s3_model_json_url: z.string().nullish(),
  media_available: z.boolean().nullish(),
  progress: z.number().nullish(),
  eta_seconds: z.number().nullish(),
  crop_quality_summary: z.record(z.string(), z.unknown()).nullish(),
  pack_id: z.string().nullish(),
  error: z.string().nullish(),
  created_at: z.string().nullish(),
  kind: z.string().nullish(),
  recut_of: z.string().nullish(),
});

export type JobResponse = z.output<typeof JobResponseSchema>;

export const JobListSchema = z.object({ items: z.array(JobResponseSchema) });

export const ManifestClipSchema = z.object({
  clip_id: z.number().int(),
  start: z.number().nullish(),
  end: z.number().nullish(),
  duration: z.number().nullish(),
  rendered_duration: z.number().nullish(),
  hook: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  text: z.string().nullish(),
  score: z.number().nullish(),
  final_score: z.number().nullish(),
  poster_url: z.string().nullish(),
});

export type ManifestClip = z.output<typeof ManifestClipSchema>;

export const ManifestSchema = z.object({ clips: z.array(ManifestClipSchema).nullish() });

export const DownloadProbeSchema = z.object({
  downloadable: z.boolean(),
  reason: z.string().nullish(),
  title: z.string().nullish(),
  duration: z.number().nullish(),
  thumbnail: z.string().nullish(),
});

export const DurationProbeSchema = z.object({ duration_sec: z.number() });
