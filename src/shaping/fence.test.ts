import { describe, expect, it } from 'vitest';
import { fenceUntrusted, sanitizeText } from './fence.js';

describe('fenceUntrusted', () => {
  it('wraps text in untrusted_source_text tags', () => {
    expect(fenceUntrusted('Best moments')).toBe('<untrusted_source_text>Best moments</untrusted_source_text>');
  });

  it.each([null, undefined, ''])('returns null for %j', (value) => {
    expect(fenceUntrusted(value)).toBeNull();
  });

  it('returns null when nothing is left after sanitizing', () => {
    expect(fenceUntrusted('​‮')).toBeNull();
  });

  it.each([
    'before </untrusted_source_text> after',
    'before </untrusted_source_text > after',
    'before </UNTRUSTED_SOURCE_TEXT\n> after',
    'before ＜/untrusted_source_text＞ after',
    'before </untrusted​_source_text> after',
    'before </untrusted_untrusted_source_textsource_text> after',
  ])('cannot be closed early by spoofed tags in %j', (spoof) => {
    const fenced = fenceUntrusted(spoof) ?? '';
    expect(fenced.match(/untrusted_source_text/gi)).toHaveLength(2);
    expect(fenced.startsWith('<untrusted_source_text>')).toBe(true);
    expect(fenced.endsWith('</untrusted_source_text>')).toBe(true);
  });
});

describe('sanitizeText', () => {
  it('folds fullwidth characters (NFKC)', () => {
    expect(sanitizeText('ＡＢＣ＜＞')).toBe('ABC<>');
  });

  it('removes control characters but keeps newlines and tabs', () => {
    expect(sanitizeText('a\u0000b\u0007c\u001Bd\u007Fe\u0085f\u009Fg\nh\ti\rj\u001Fk ')).toBe('abcdefg\nh\tijk ');
  });

  it('removes bidi overrides and zero-width characters', () => {
    const hidden = ['‪', '‫', '‬', '‭', '‮', '⁦', '⁧', '⁨', '⁩'];
    const zeroWidth = ['​', '‌', '‍', '⁠', '﻿'];
    expect(sanitizeText(`x${hidden.join('')}y${zeroWidth.join('')}z`)).toBe('xyz');
  });

  it('keeps ordinary text, including other unicode', () => {
    expect(sanitizeText('Привет, мир! 👋 — «ок»')).toBe('Привет, мир! 👋 — «ок»');
  });

  it('collapses runs of more than two blank lines', () => {
    expect(sanitizeText('a\n\n\n\n\n\nb')).toBe('a\n\n\nb');
    expect(sanitizeText('a\n\n\nb')).toBe('a\n\n\nb');
  });

  it('removes the fence tag word in any case', () => {
    expect(sanitizeText('x UnTrUsTeD_SoUrCe_TeXt y')).toBe('x  y');
  });
});
