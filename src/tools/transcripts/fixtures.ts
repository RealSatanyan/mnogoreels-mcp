import type { z } from 'zod';
import type { TranscriptionSchema } from './schemas.js';

export const TRANSCRIPTION_ID = '0123456789abcdef0123456789abcdef';

export const aTranscription = (
  overrides: Partial<z.input<typeof TranscriptionSchema>> = {},
): z.input<typeof TranscriptionSchema> => ({
  id: TRANSCRIPTION_ID,
  status: 'completed',
  source_url: 'https://www.youtube.com/watch?v=abc123',
  language: 'en',
  progress: 1,
  text: 'Hello world.',
  srt: '1\n00:00:00,000 --> 00:00:01,000\nHello world.\n',
  segments: [{ start: 0, end: 1, text: 'Hello world.' }],
  error: null,
  ...overrides,
});
