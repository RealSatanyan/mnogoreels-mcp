import type { z } from 'zod';
import { redactSecrets } from './redact.js';

export type TextContent = { readonly type: 'text'; readonly text: string };

export type SuccessResult<T> = { readonly content: [TextContent]; readonly structuredContent: T };

export type ErrorResult = { readonly content: [TextContent]; readonly isError: true };

export type ToolErrorInfo = {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterSec?: number | undefined;
  readonly details?: Readonly<Record<string, unknown>> | undefined;
};

export const toSuccessResult = <S extends z.ZodType>(outputSchema: S, output: unknown): SuccessResult<z.output<S>> => {
  const value = outputSchema.parse(output);
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
};

export const toErrorResult = (info: ToolErrorInfo): ErrorResult => {
  const message = redactSecrets(info.message);
  const retryHint = info.retryAfterSec === undefined ? '' : ` Retry in ${String(info.retryAfterSec)} s.`;
  const payload = {
    error: {
      code: info.code,
      message,
      retryable: info.retryable,
      retry_after_sec: info.retryAfterSec ?? null,
      details: info.details,
    },
  };
  return {
    content: [
      { type: 'text', text: `Error [${info.code}]: ${message}${retryHint}\n${redactSecrets(JSON.stringify(payload))}` },
    ],
    isError: true,
  };
};
