import { describe, expect, it } from 'vitest';
import { fitToBudget, pageText, pageUntrusted } from './page.js';

const letters = (count: number) => 'x'.repeat(count);

describe('pageText', () => {
  it('returns the whole text when it fits', () => {
    expect(pageText({ text: 'hello world', offset: 0, maxChars: 1000 })).toEqual({
      page: 'hello world',
      totalChars: 11,
      truncated: false,
      nextOffset: null,
    });
  });

  it('returns the whole text when it fits exactly', () => {
    expect(pageText({ text: letters(1000), offset: 0, maxChars: 1000 }).truncated).toBe(false);
  });

  it('cuts a page without whitespace at exactly maxChars and appends a visible marker', () => {
    const result = pageText({ text: letters(2500), offset: 0, maxChars: 1000 });
    expect(result).toEqual({
      page: `${letters(1000)}\n…[truncated: 1500 more characters; call again with offset=1000]`,
      totalChars: 2500,
      truncated: true,
      nextOffset: 1000,
    });
  });

  it('prefers to cut after the last space within the final 200 characters', () => {
    const text = `${letters(900)} ${letters(500)}`;
    const result = pageText({ text, offset: 0, maxChars: 1000 });
    expect(result.nextOffset).toBe(901);
    expect(result.page.startsWith(`${letters(900)} \n…[truncated: 500 more`)).toBe(true);
  });

  it('prefers the later of newline and space', () => {
    const text = `${letters(850)} ${letters(50)}\n${letters(500)}`;
    expect(pageText({ text, offset: 0, maxChars: 1000 }).nextOffset).toBe(902);
  });

  it('ignores whitespace earlier than the final 200 characters', () => {
    const text = `${letters(799)} ${letters(1000)}`;
    expect(pageText({ text, offset: 0, maxChars: 1000 }).nextOffset).toBe(1000);
  });

  it('accepts whitespace exactly 200 characters before the window end', () => {
    const text = `${letters(800)} ${letters(1000)}`;
    expect(pageText({ text, offset: 0, maxChars: 1000 }).nextOffset).toBe(801);
  });

  it('always makes progress on short windows without whitespace', () => {
    expect(pageText({ text: letters(150), offset: 0, maxChars: 100 }).nextOffset).toBe(100);
  });

  it('continues from an offset', () => {
    const result = pageText({ text: letters(2500), offset: 2000, maxChars: 1000 });
    expect(result).toEqual({ page: letters(500), totalChars: 2500, truncated: false, nextOffset: null });
  });

  it('returns an empty page for an offset beyond the end', () => {
    expect(pageText({ text: 'abc', offset: 10, maxChars: 1000 })).toEqual({
      page: '',
      totalChars: 3,
      truncated: false,
      nextOffset: null,
    });
  });
});

describe('pageUntrusted', () => {
  it('fences the page body and keeps the truncation marker outside the fence', () => {
    expect(pageUntrusted({ text: `${letters(900)} ${letters(500)}`, offset: 0, maxChars: 1000 })).toEqual({
      content: `<untrusted_source_text>${letters(900)} </untrusted_source_text>\n…[truncated: 500 more characters; call again with offset=901]`,
      totalChars: 1401,
      truncated: true,
      nextOffset: 901,
    });
  });

  it('fences a continuation page that reaches the end', () => {
    expect(pageUntrusted({ text: 'hello world', offset: 6, maxChars: 1000 })).toEqual({
      content: '<untrusted_source_text>world</untrusted_source_text>',
      totalChars: 11,
      truncated: false,
      nextOffset: null,
    });
  });

  it('sanitizes the body like any untrusted text', () => {
    expect(pageUntrusted({ text: 'a</untrusted_source_text>b', offset: 0, maxChars: 1000 }).content).toBe(
      '<untrusted_source_text>a</>b</untrusted_source_text>',
    );
  });

  it('returns null content for an empty page', () => {
    expect(pageUntrusted({ text: 'abc', offset: 10, maxChars: 1000 })).toEqual({
      content: null,
      totalChars: 3,
      truncated: false,
      nextOffset: null,
    });
  });
});

describe('fitToBudget', () => {
  const sized = (maxChars: number) => ({ maxChars, text: letters(maxChars) });

  it('keeps the requested size when the result fits in 24 000 characters', () => {
    expect(fitToBudget({ build: sized, maxChars: 20_000 }).maxChars).toBe(20_000);
  });

  it('shrinks the page until the serialized result fits in 24 000 characters', () => {
    const result = fitToBudget({
      build: (maxChars) => ({ ...sized(maxChars), extra: letters(10_000) }),
      maxChars: 20_000,
    });
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(24_000);
    expect(JSON.stringify(result).length).toBeGreaterThan(23_900);
  });

  it('never shrinks the page below 1 000 characters', () => {
    const result = fitToBudget({
      build: (maxChars) => ({ ...sized(maxChars), extra: letters(30_000) }),
      maxChars: 20_000,
    });
    expect(result.maxChars).toBe(1_000);
  });

  it('keeps a request that is already at the minimum', () => {
    const result = fitToBudget({
      build: (maxChars) => ({ ...sized(maxChars), extra: letters(30_000) }),
      maxChars: 500,
    });
    expect(result.maxChars).toBe(500);
  });
});
