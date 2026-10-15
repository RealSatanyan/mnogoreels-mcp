import { fenceUntrusted } from './fence.js';

const CUT_SEARCH_CHARS = 200;
const RESULT_BUDGET_CHARS = 24_000;
const MIN_PAGE_CHARS = 1_000;

export type TextPage = {
  readonly page: string;
  readonly totalChars: number;
  readonly truncated: boolean;
  readonly nextOffset: number | null;
};

export type UntrustedPage = Omit<TextPage, 'page'> & { readonly content: string | null };

type PageRequest = { readonly text: string; readonly offset: number; readonly maxChars: number };

const cutLength = (window: string): number => {
  const lastBreak = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '));
  return lastBreak >= Math.max(0, window.length - CUT_SEARCH_CHARS) ? lastBreak + 1 : window.length;
};

const truncationMarker = (totalChars: number, nextOffset: number): string =>
  `\n…[truncated: ${String(totalChars - nextOffset)} more characters; call again with offset=${String(nextOffset)}]`;

export const pageText = (options: PageRequest): TextPage => {
  const { text, offset, maxChars } = options;
  const totalChars = text.length;
  if (offset + maxChars >= totalChars) {
    return { page: text.slice(offset), totalChars, truncated: false, nextOffset: null };
  }
  const nextOffset = offset + cutLength(text.slice(offset, offset + maxChars));
  return {
    page: text.slice(offset, nextOffset) + truncationMarker(totalChars, nextOffset),
    totalChars,
    truncated: true,
    nextOffset,
  };
};

export const pageUntrusted = (options: PageRequest): UntrustedPage => {
  const { totalChars, truncated, nextOffset } = pageText(options);
  const body = fenceUntrusted(options.text.slice(options.offset, nextOffset ?? totalChars));
  const marker = nextOffset === null ? '' : truncationMarker(totalChars, nextOffset);
  const content = `${body ?? ''}${marker}`;
  return { content: content === '' ? null : content, totalChars, truncated, nextOffset };
};

export const fitToBudget = <T>(options: { readonly build: (maxChars: number) => T; readonly maxChars: number }): T => {
  const output = options.build(options.maxChars);
  const overflow = JSON.stringify(output).length - RESULT_BUDGET_CHARS;
  if (overflow <= 0 || options.maxChars <= MIN_PAGE_CHARS) return output;
  return fitToBudget({ build: options.build, maxChars: Math.max(MIN_PAGE_CHARS, options.maxChars - overflow) });
};
