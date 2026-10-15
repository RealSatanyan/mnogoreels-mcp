import type { Transcription } from './schemas.js';

export type TranscriptFormat = 'text' | 'srt' | 'segments';

const pad2 = (value: number): string => String(value).padStart(2, '0');

const timecode = (seconds: number): string => {
  const tenths = Math.round(seconds * 10);
  const wholeSeconds = Math.floor(tenths / 10);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor(wholeSeconds / 60) % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(wholeSeconds % 60)}.${String(tenths % 10)}`;
};

export const renderTranscript = (transcription: Transcription, format: TranscriptFormat): string => {
  if (format === 'text') return transcription.text ?? '';
  if (format === 'srt') return transcription.srt ?? '';
  return (transcription.segments ?? [])
    .map((segment) => `[${timecode(segment.start)}–${timecode(segment.end)}] ${segment.text}`)
    .join('\n');
};
