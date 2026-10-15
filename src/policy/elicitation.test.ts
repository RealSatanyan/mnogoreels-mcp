import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { supportsFormElicitation } from './elicitation.js';

const envelopeWith = (capabilities: unknown) => ({ [CLIENT_CAPABILITIES_META_KEY]: capabilities });

describe('supportsFormElicitation', () => {
  it.each([
    ['2025-06-18 shape {}', { elicitation: {} }, true],
    ['form mode', { elicitation: { form: {} } }, true],
    ['form and url', { elicitation: { form: {}, url: {} } }, true],
    ['url only', { elicitation: { url: {} } }, false],
    ['no elicitation', { sampling: {} }, false],
    ['empty capabilities', {}, false],
  ])('modern envelope: %s → %s', (_label, capabilities, expected) => {
    expect(supportsFormElicitation({ envelope: envelopeWith(capabilities), legacyCapabilities: undefined })).toBe(
      expected,
    );
  });

  it.each([
    ['2025-06-18 shape {}', { elicitation: {} }, true],
    ['form mode', { elicitation: { form: {} } }, true],
    ['url only', { elicitation: { url: {} } }, false],
    ['absent', undefined, false],
  ])('legacy initialize capabilities: %s → %s', (_label, capabilities, expected) => {
    expect(supportsFormElicitation({ envelope: undefined, legacyCapabilities: capabilities })).toBe(expected);
  });

  it.each([
    ['string capabilities', 'yes'],
    ['elicitation is a number', { elicitation: 1 }],
    ['form is a string', { elicitation: { form: 'on' } }],
    ['null', null],
  ])('malformed (%s) → false', (_label, capabilities) => {
    expect(supportsFormElicitation({ envelope: envelopeWith(capabilities), legacyCapabilities: capabilities })).toBe(
      false,
    );
  });

  it('prefers the modern envelope over legacy capabilities', () => {
    expect(
      supportsFormElicitation({ envelope: envelopeWith({ sampling: {} }), legacyCapabilities: { elicitation: {} } }),
    ).toBe(false);
  });

  it('falls back to legacy capabilities when the envelope has none', () => {
    expect(supportsFormElicitation({ envelope: {}, legacyCapabilities: { elicitation: {} } })).toBe(true);
  });
});
