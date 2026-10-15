import { z } from 'zod';

export const TranscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  source_url: z.string().nullish(),
  language: z.string().nullish(),
  progress: z.number().nullish(),
  text: z.string().nullish(),
  srt: z.string().nullish(),
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })).nullish(),
  error: z.string().nullish(),
});

export type Transcription = z.output<typeof TranscriptionSchema>;
