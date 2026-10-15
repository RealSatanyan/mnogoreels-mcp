import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../../api/errors.js';
import { creditsFor, resolveWindow } from './window.js';

const window = (input: Partial<Parameters<typeof resolveWindow>[0]> = {}) =>
  resolveWindow({
    startSec: undefined,
    endSec: undefined,
    durationSec: 600,
    maxWindowSec: 1800,
    inherit: false,
    ...input,
  });

const failureOf = (run: () => unknown): ToolFailure => {
  try {
    run();
  } catch (error) {
    if (error instanceof ToolFailure) return error;
    throw error;
  }
  throw new Error('expected a ToolFailure');
};

const seededRandom = (seed: number) => {
  const state = { value: seed };
  return (): number => {
    state.value = (state.value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state.value / 2_147_483_648;
  };
};

describe('creditsFor', () => {
  it.each([
    [0, 0.5, 1],
    [0, 60, 1],
    [0, 60.001, 2],
    [0, 1799.9, 30],
    [0, 1800, 30],
    [100, 100.001, 1],
    [1954.779, 5014.779, 52],
  ])('charges %d → %d as %d credits', (start, end, credits) => {
    expect(creditsFor({ start, end })).toBe(credits);
  });

  it('prices the raw float difference of the values sent, like the backend', () => {
    const random = seededRandom(42);
    Array.from({ length: 2000 }, () => {
      const startSec = Math.round(random() * 3_600_000) / 1000;
      const endSec = startSec + Math.round(random() * 1_800_000 + 1) / 1000;
      return window({ startSec, endSec, durationSec: null, maxWindowSec: 86_400 });
    }).forEach((priced) => {
      if (priced.kind !== 'explicit') throw new Error('expected an explicit window');
      const sentStart: unknown = JSON.parse(JSON.stringify(priced.start));
      const sentEnd: unknown = JSON.parse(JSON.stringify(priced.end));
      expect([sentStart, sentEnd]).toEqual([priced.start, priced.end]);
      expect(priced.credits).toBe(Math.max(1, Math.ceil((priced.end - priced.start) / 60)));
    });
  });
});

describe('resolveWindow: explicit range', () => {
  it('defaults the start to 0 and the end to the probed length', () => {
    expect(window({ durationSec: 125.5 })).toEqual({
      kind: 'explicit',
      start: 0,
      end: 125.5,
      credits: 3,
      billedSeconds: 125.5,
    });
  });

  it('rounds start and end individually to 3 decimals and prices those numbers', () => {
    expect(window({ startSec: 1954.7794, endSec: 5014.7791, durationSec: 6000, maxWindowSec: 3600 })).toEqual({
      kind: 'explicit',
      start: 1954.779,
      end: 5014.779,
      credits: 52,
      billedSeconds: 3060,
    });
  });

  it('accepts an end within one second past the reported length', () => {
    expect(window({ endSec: 601, durationSec: 600 })).toMatchObject({ end: 601, credits: 11 });
  });

  it('works without a known length when end_sec is given', () => {
    expect(window({ startSec: 10, endSec: 70, durationSec: null })).toMatchObject({ start: 10, end: 70, credits: 1 });
  });

  it('asks for end_sec when the length is unknown', () => {
    const failure = failureOf(() => window({ durationSec: null }));
    expect(failure.code).toBe('duration_unknown');
    expect(failure.message).toBe(
      'The length of this video is not reported by its platform (direct file links never report it). Ask the user for the length or the part to process and pass end_sec.',
    );
  });

  it.each([
    [{ startSec: 100, endSec: 100 }, 'end_sec (100) must be greater than start_sec (100).'],
    [{ startSec: 700 }, 'end_sec (600) must be greater than start_sec (700).'],
    [{ startSec: 0.0001, endSec: 0.0004, durationSec: null }, 'end_sec (0) must be greater than start_sec (0).'],
  ])('refuses an empty range %j', (input, message) => {
    const failure = failureOf(() => window(input));
    expect(failure.code).toBe('invalid_arguments');
    expect(failure.message).toBe(message);
  });

  it('refuses an end beyond the video length', () => {
    const failure = failureOf(() => window({ endSec: 601.5, durationSec: 600 }));
    expect(failure.code).toBe('invalid_arguments');
    expect(failure.message).toBe(
      'end_sec 601.5 is beyond the video length 600 s; you would pay for minutes that do not exist.',
    );
  });

  it.each([
    ['explicit', { startSec: 0, endSec: 1800.001, durationSec: null }, 31],
    ['defaulted from the probe', { durationSec: 1860 }, 31],
    ['offset', { startSec: 100, endSec: 2000, durationSec: 2400 }, 32],
  ])('refuses a range longer than the window cap (%s)', (_label, input, minutes) => {
    const failure = failureOf(() => window(input));
    expect(failure.code).toBe('invalid_arguments');
    expect(failure.message).toBe(
      `MnogoReels processes at most 30 minutes per job; you would be charged for ${String(minutes)} minutes but only the first 30 minutes would be clipped. Split the video into jobs with start_sec/end_sec (e.g. 0–1800, 1800–3600).`,
    );
  });

  it('uses the configured window cap', () => {
    expect(window({ durationSec: 1800, maxWindowSec: 1800 })).toMatchObject({ credits: 30 });
    const failure = failureOf(() => window({ durationSec: 700, maxWindowSec: 600 }));
    expect(failure.message).toContain('at most 10 minutes per job');
    expect(failure.message).toContain('(e.g. 0–600, 600–1200)');
  });
});

describe('resolveWindow: inherited recut range', () => {
  it('prices the whole source as an upper bound', () => {
    expect(window({ inherit: true, durationSec: 1234.5678 })).toEqual({
      kind: 'inherited',
      credits: 21,
      upperBoundSec: 1234.568,
    });
  });

  it('allows a source exactly as long as the cap', () => {
    expect(window({ inherit: true, durationSec: 1800 })).toMatchObject({ credits: 30 });
  });

  it('refuses a source longer than the cap', () => {
    const failure = failureOf(() => window({ inherit: true, durationSec: 1800.5 }));
    expect(failure.code).toBe('invalid_arguments');
    expect(failure.message).toBe(
      "The source is longer than 30 minutes and the original job's range is unknown; pass start_sec and end_sec (at most 30 minutes) for the recut.",
    );
  });

  it('refuses an unknown source length', () => {
    const failure = failureOf(() => window({ inherit: true, durationSec: null }));
    expect(failure.code).toBe('duration_unknown');
    expect(failure.message).toBe(
      "The length of this video is not reported by its platform and the original job's range is unknown; pass start_sec and end_sec for the recut.",
    );
  });
});
