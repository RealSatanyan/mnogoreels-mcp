import { z } from 'zod';

export const ThumbnailJobSchema = z.object({
  id: z.string(),
  status: z.string(),
  stage: z.string().nullish(),
  progress: z.number().nullish(),
  requested_variants: z.number().nullish(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        image_url: z.string(),
        width: z.number().nullish(),
        height: z.number().nullish(),
      }),
    )
    .nullish(),
  error: z.string().nullish(),
});
