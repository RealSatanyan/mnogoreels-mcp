import { fail } from '../../api/errors.js';
import { formatWindow } from '../../domain/options.js';

export type ExplicitWindow = {
  readonly kind: 'explicit';
  readonly start: number;
  readonly end: number;
  readonly credits: number;
  readonly billedSeconds: number;
};

export type InheritedWindow = { readonly kind: 'inherited'; readonly credits: number; readonly upperBoundSec: number };

export type PricedWindow = ExplicitWindow | InheritedWindow;

export const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export const creditsFor = (range: { readonly start: number; readonly end: number }): number =>
  Math.max(1, Math.ceil((range.end - range.start) / 60));

const UNKNOWN_LENGTH =
  'The length of this video is not reported by its platform (direct file links never report it). Ask the user for the length or the part to process and pass end_sec.';

export const inheritedWindow = (durationSec: number | null, maxWindowSec: number): InheritedWindow => {
  if (durationSec === null) {
    return fail(
      'duration_unknown',
      "The length of this video is not reported by its platform and the original job's range is unknown; pass start_sec and end_sec for the recut.",
    );
  }
  if (durationSec > maxWindowSec) {
    const limit = formatWindow(maxWindowSec);
    return fail(
      'invalid_arguments',
      `The source is longer than ${limit} and the original job's range is unknown; pass start_sec and end_sec (at most ${limit}) for the recut.`,
    );
  }
  const upperBoundSec = round3(durationSec);
  return { kind: 'inherited', credits: creditsFor({ start: 0, end: upperBoundSec }), upperBoundSec };
};

const tooLong = (credits: number, maxWindowSec: number): never => {
  const limit = formatWindow(maxWindowSec);
  const max = String(maxWindowSec);
  return fail(
    'invalid_arguments',
    `MnogoReels processes at most ${limit} per job; you would be charged for ${String(credits)} minutes but only the first ${limit} would be clipped. Split the video into jobs with start_sec/end_sec (e.g. 0–${max}, ${max}–${String(maxWindowSec * 2)}).`,
  );
};

type WindowInput = {
  readonly startSec: number | undefined;
  readonly endSec: number | undefined;
  readonly durationSec: number | null;
  readonly maxWindowSec: number;
};

export const explicitWindow = (input: WindowInput): ExplicitWindow => {
  const { durationSec, maxWindowSec } = input;
  const rawEnd = input.endSec ?? durationSec;
  if (rawEnd === null) return fail('duration_unknown', UNKNOWN_LENGTH);
  const start = round3(input.startSec ?? 0);
  const end = round3(rawEnd);
  if (end <= start) {
    return fail('invalid_arguments', `end_sec (${String(end)}) must be greater than start_sec (${String(start)}).`);
  }
  if (durationSec !== null && end > durationSec + 1) {
    return fail(
      'invalid_arguments',
      `end_sec ${String(end)} is beyond the video length ${String(durationSec)} s; you would pay for minutes that do not exist.`,
    );
  }
  const credits = creditsFor({ start, end });
  if (end - start > maxWindowSec) return tooLong(credits, maxWindowSec);
  return { kind: 'explicit', start, end, credits, billedSeconds: round3(end - start) };
};

export const resolveWindow = (input: WindowInput & { readonly inherit: boolean }): PricedWindow =>
  input.inherit ? inheritedWindow(input.durationSec, input.maxWindowSec) : explicitWindow(input);
