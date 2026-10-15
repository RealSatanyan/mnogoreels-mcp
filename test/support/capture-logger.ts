import { createLogger, type Logger } from '../../src/runtime/logger.js';

export type CapturedLogs = {
  readonly lines: () => readonly string[];
  readonly entries: () => readonly Readonly<Record<string, unknown>>[];
  readonly text: () => string;
};

const toRecord = (line: string): Readonly<Record<string, unknown>> => {
  const parsed: unknown = JSON.parse(line);
  return typeof parsed === 'object' && parsed !== null ? Object.fromEntries(Object.entries(parsed)) : {};
};

export const createCaptureLogger = (
  options: { readonly debug?: boolean; readonly now?: () => Date } = {},
): CapturedLogs & { readonly logger: Logger } => {
  const captured: string[] = [];
  const logger = createLogger({
    debug: options.debug ?? false,
    write: (line) => {
      captured.push(line);
    },
    ...(options.now ? { now: options.now } : {}),
  });
  return {
    logger,
    lines: () => [...captured],
    entries: () => captured.map(toRecord),
    text: () => captured.join('\n'),
  };
};
