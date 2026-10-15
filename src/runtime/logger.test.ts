import { describe, expect, it } from 'vitest';
import { createCaptureLogger } from '../../test/support/capture-logger.js';
import { createLogger } from './logger.js';

const FIXED_NOW = new Date('2026-10-14T12:00:00.000Z');

describe('createLogger', () => {
  it('writes one JSON object per line with timestamp, level and event', () => {
    const { logger, entries, lines } = createCaptureLogger({ now: () => FIXED_NOW });
    logger.info('tool_call', { tool: 'get_account', ms: 12, code: undefined });
    logger.warn('startup', { transport: 'http' });
    logger.error('internal_error');
    expect(lines().every((line) => !line.includes('\n'))).toBe(true);
    expect(entries()).toEqual([
      { ts: '2026-10-14T12:00:00.000Z', level: 'info', event: 'tool_call', tool: 'get_account', ms: 12 },
      { ts: '2026-10-14T12:00:00.000Z', level: 'warn', event: 'startup', transport: 'http' },
      { ts: '2026-10-14T12:00:00.000Z', level: 'error', event: 'internal_error' },
    ]);
  });

  it('redacts API keys anywhere in the line', () => {
    const { logger, lines } = createCaptureLogger();
    logger.info('http_request', { path: '/x mrfrt_usr_SECRETSECRETSECRET1234' });
    expect(lines()[0]).toContain('mrfrt_usr_…1234');
    expect(lines()[0]).not.toContain('SECRETSECRET');
  });

  it('logs errors only in structured form without the message', () => {
    const { logger, entries } = createCaptureLogger();
    const error = Object.assign(
      new TypeError('Unexpected token in {"key":"mrfrt_usr_abcdefghijklmnop"} at https://x?q=1'),
      {
        code: 'E_BAD',
      },
    );
    const errorId = logger.errorOf('mcp_handler_error', error, { era: 'modern' });
    const entry = entries()[0];
    expect(errorId).toMatch(/^[0-9a-f]{8}$/);
    expect(entry).toMatchObject({ level: 'error', event: 'mcp_handler_error', era: 'modern' });
    expect(entry?.['error']).toMatchObject({ name: 'TypeError', code: 'E_BAD', errorId });
    expect(JSON.stringify(entry)).not.toContain('Unexpected token');
    expect(JSON.stringify(entry)).not.toContain('q=1');
    const stack: unknown = Reflect.get(Object(entry?.['error']), 'stack');
    expect(Array.isArray(stack) && stack.length > 0 && stack.every((frame) => String(frame).startsWith('at '))).toBe(
      true,
    );
  });

  it('includes the redacted message in debug mode', () => {
    const { logger, entries } = createCaptureLogger({ debug: true });
    logger.errorOf('stdio_error', new Error('boom mrfrt_usr_abcdefghijklmnop'));
    expect(entries()[0]?.['error']).toMatchObject({ name: 'Error', message: 'boom mrfrt_usr_…mnop' });
  });

  it('handles thrown non-errors', () => {
    const { logger, entries } = createCaptureLogger();
    logger.errorOf('internal_error', 'just a string');
    expect(entries()[0]?.['error']).toMatchObject({ name: 'NonError', stack: [] });
  });

  it('writes to stderr by default', () => {
    const writes: string[] = [];
    const original = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      writes.push(String(chunk));
      return true;
    };
    try {
      createLogger({ debug: false }).info('startup');
    } finally {
      process.stderr.write = original;
    }
    expect(writes).toHaveLength(1);
    expect(writes[0]?.endsWith('}\n')).toBe(true);
  });
});
