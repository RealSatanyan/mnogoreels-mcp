import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toErrorResult, toSuccessResult } from './result.js';

const OutputSchema = z.object({ id: z.string(), count: z.number().int(), note: z.string().optional() });

describe('toSuccessResult', () => {
  it('returns the parsed value as structuredContent and the same JSON as text', () => {
    const result = toSuccessResult(OutputSchema, { id: 'a', count: 2 });
    expect(result).toEqual({
      content: [{ type: 'text', text: '{"id":"a","count":2}' }],
      structuredContent: { id: 'a', count: 2 },
    });
  });

  it('strips keys the output schema does not declare', () => {
    const output = { id: 'a', count: 2, stray: true };
    const result = toSuccessResult(OutputSchema, output);
    expect(result.structuredContent).toEqual({ id: 'a', count: 2 });
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 'a', count: 2 });
  });

  it('throws when the output does not match the schema', () => {
    expect(() => toSuccessResult(OutputSchema, { id: 'a', count: 1.5 })).toThrow();
  });
});

describe('toErrorResult', () => {
  it('is text-only with the code line and the compact JSON', () => {
    const result = toErrorResult({
      code: 'insufficient_credits',
      message: 'Not enough credits for this clip job.',
      retryable: false,
      details: { credits: 31 },
    });
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error [insufficient_credits]: Not enough credits for this clip job.\n{"error":{"code":"insufficient_credits","message":"Not enough credits for this clip job.","retryable":false,"retry_after_sec":null,"details":{"credits":31}}}',
        },
      ],
      isError: true,
    });
    expect(result).not.toHaveProperty('structuredContent');
  });

  it('appends the retry hint when retry_after_sec is set', () => {
    const text = toErrorResult({ code: 'rate_limited', message: 'Slow down.', retryable: true, retryAfterSec: 30 })
      .content[0].text;
    expect(text.split('\n')[0]).toBe('Error [rate_limited]: Slow down. Retry in 30 s.');
    expect(JSON.parse(text.split('\n')[1] ?? '')).toEqual({
      error: { code: 'rate_limited', message: 'Slow down.', retryable: true, retry_after_sec: 30 },
    });
  });

  it('redacts API keys from the message', () => {
    const text = toErrorResult({
      code: 'internal_error',
      message: 'bad mrfrt_usr_abcdefghijklmnop1234',
      retryable: false,
    }).content[0].text;
    expect(text).not.toContain('abcdefghijklmnop');
    expect(text).toContain('mrfrt_usr_…1234');
  });
});
