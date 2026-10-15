import { z } from 'zod';

export const ArticleJobSchema = z.object({
  id: z.string(),
  source_job_id: z.string(),
  status: z.string(),
  stage: z.string().nullish(),
  progress: z.number().nullish(),
  source: z
    .object({
      url: z.string().nullish(),
      title: z.string().nullish(),
      channel_name: z.string().nullish(),
      published_at: z.string().nullish(),
      duration_seconds: z.number().nullish(),
    })
    .nullish(),
  article: z
    .object({
      language: z.string().nullish(),
      title: z.string(),
      seo_title: z.string().nullish(),
      seo_description: z.string().nullish(),
      summary: z.string().nullish(),
      sections: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) })).nullish(),
      key_takeaways: z.array(z.string()).nullish(),
      timestamps: z
        .array(
          z.object({
            start_seconds: z.number(),
            end_seconds: z.number().nullish(),
            title: z.string(),
            summary: z.string().nullish(),
          }),
        )
        .nullish(),
      guest: z.object({ name: z.string(), title: z.string().nullish(), bio: z.string().nullish() }).nullish(),
    })
    .nullish(),
  transcript: z
    .object({
      language: z.string().nullish(),
      text: z.string().nullish(),
      segments: z
        .array(
          z.object({
            start_seconds: z.number(),
            end_seconds: z.number(),
            text: z.string(),
            speaker: z.string().nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
  images: z
    .array(
      z.object({
        image_url: z.string(),
        width: z.number().nullish(),
        height: z.number().nullish(),
        timestamp_seconds: z.number().nullish(),
        section_index: z.number().nullish(),
        after_paragraph_index: z.number().nullish(),
        alt: z.string().nullish(),
        caption: z.string().nullish(),
      }),
    )
    .nullish(),
  images_status: z.string().nullish(),
  images_error: z.string().nullish(),
  error: z.string().nullish(),
});

export type ArticleJob = z.output<typeof ArticleJobSchema>;
export type GeneratedArticle = NonNullable<ArticleJob['article']>;
export type ArticleTranscript = NonNullable<ArticleJob['transcript']>;
