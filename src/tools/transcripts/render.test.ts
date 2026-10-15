import { describe, expect, it } from 'vitest';
import { aTranscription } from './fixtures.js';
import { renderTranscript } from './render.js';
import { TranscriptionSchema } from './schemas.js';

const parsed = (overrides: Parameters<typeof aTranscription>[0] = {}) =>
  TranscriptionSchema.parse(aTranscription(overrides));

describe('renderTranscript', () => {
  it('returns the plain text for the text format', () => {
    expect(renderTranscript(parsed({ text: 'Hello there.' }), 'text')).toBe('Hello there.');
  });

  it('returns the subtitles for the srt format', () => {
    const srt = '1\n00:00:00,000 --> 00:00:01,500\nHello\n';
    expect(renderTranscript(parsed({ srt }), 'srt')).toBe(srt);
  });

  it('renders one timed line per segment with tenth-of-a-second timecodes', () => {
    const transcription = parsed({
      segments: [
        { start: 0, end: 1.5, text: 'Hello' },
        { start: 65.04, end: 70.96, text: 'second line' },
        { start: 3725.25, end: 3730, text: 'after an hour' },
      ],
    });
    expect(renderTranscript(transcription, 'segments')).toBe(
      [
        '[00:00:00.0–00:00:01.5] Hello',
        '[00:01:05.0–00:01:11.0] second line',
        '[01:02:05.3–01:02:10.0] after an hour',
      ].join('\n'),
    );
  });

  it('renders an empty string when the requested format is missing', () => {
    const empty = parsed({ text: null, srt: null, segments: null });
    expect([
      renderTranscript(empty, 'text'),
      renderTranscript(empty, 'srt'),
      renderTranscript(empty, 'segments'),
    ]).toEqual(['', '', '']);
  });
});
