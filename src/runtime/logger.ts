import { randomBytes } from 'node:crypto';
import { redactSecrets } from '../shaping/redact.js';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Readonly<Record<string, LogValue>>;

export type Logger = {
  readonly info: (event: string, fields?: LogFields) => void;
  readonly warn: (event: string, fields?: LogFields) => void;
  readonly error: (event: string, fields?: LogFields) => void;
  readonly errorOf: (event: string, error: unknown, fields?: LogFields) => string;
};

const FRAME_RE = /^\s+at /;

const codeOf = (error: object): string | undefined =>
  'code' in error && typeof error.code === 'string' ? error.code : undefined;

const describeError = (error: unknown, errorId: string, debug: boolean) => {
  if (!(error instanceof Error)) return { name: 'NonError', errorId, stack: [] };
  const stack = String(error.stack)
    .split('\n')
    .filter((line) => FRAME_RE.test(line))
    .map((line) => line.trim());
  return {
    name: error.name,
    code: codeOf(error),
    errorId,
    stack,
    ...(debug ? { message: error.message } : {}),
  };
};

export const createLogger = (options: {
  readonly debug: boolean;
  readonly write?: (line: string) => void;
  readonly now?: () => Date;
}): Logger => {
  const write = options.write ?? ((line: string) => process.stderr.write(`${line}\n`));
  const now = options.now ?? (() => new Date());

  const emit = (level: LogLevel, event: string, fields: Readonly<Record<string, unknown>> = {}): void => {
    write(redactSecrets(JSON.stringify({ ts: now().toISOString(), level, event, ...fields })));
  };

  return {
    info: (event, fields) => {
      emit('info', event, fields);
    },
    warn: (event, fields) => {
      emit('warn', event, fields);
    },
    error: (event, fields) => {
      emit('error', event, fields);
    },
    errorOf: (event, error, fields) => {
      const errorId = randomBytes(4).toString('hex');
      emit('error', event, { ...fields, error: describeError(error, errorId, options.debug) });
      return errorId;
    },
  };
};
