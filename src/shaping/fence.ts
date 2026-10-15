const FENCE_WORD_RE = /untrusted_source_text/gi;
const INVISIBLE_RE = /[\u202A-\u202E\u2066-\u2069\u200B-\u200D\u2060\uFEFF]/g;
const BLANK_RUN_RE = /\n{4,}/g;
const KEPT_CONTROLS = new Set(['\n', '\t']);

const isControl = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  return (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) && !KEPT_CONTROLS.has(char);
};

const removeFenceWord = (text: string): string => {
  const next = text.replace(FENCE_WORD_RE, '');
  return next === text ? text : removeFenceWord(next);
};

export const sanitizeText = (text: string): string =>
  removeFenceWord(
    Array.from(text.normalize('NFKC').replace(INVISIBLE_RE, ''))
      .filter((char) => !isControl(char))
      .join('')
      .replace(BLANK_RUN_RE, '\n\n\n'),
  );

export const fenceUntrusted = (text: string | null | undefined): string | null => {
  const clean = text ? sanitizeText(text) : '';
  return clean ? `<untrusted_source_text>${clean}</untrusted_source_text>` : null;
};
