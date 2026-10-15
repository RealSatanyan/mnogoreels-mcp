import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CAPTION_STYLE,
  CLIP_LENGTH,
  FRAMING,
  HOOK_STYLE,
  LANGUAGE,
  OPTION_CATALOG,
  OUTRO,
  PAID_JOB_NOTICE,
  STORY_ARC_STYLE,
  VIDEO_MODE,
  pricingGuide,
} from './options.js';

describe('option catalog', () => {
  it('lists the clip options in guide order', () => {
    expect(OPTION_CATALOG.map((spec) => spec.option)).toEqual([
      'video_mode',
      'clip_length',
      'caption_style',
      'hook_style',
      'story_arc_style',
      'outro',
      'framing',
    ]);
  });

  it.each(OPTION_CATALOG.map((spec) => [spec.option, spec] as const))(
    '%s: every value has a description and the entries mirror the enum values',
    (_name, spec) => {
      expect(spec.description.length).toBeGreaterThan(10);
      expect(spec.entries.map((entry) => entry.value)).toEqual([...spec.values]);
      spec.entries.forEach((entry) => {
        expect(entry.description.trim().length).toBeGreaterThan(2);
      });
    },
  );

  it.each(OPTION_CATALOG.map((spec) => [spec.option, spec] as const))('%s: exactly one default', (_name, spec) => {
    const defaults = spec.entries.filter((entry) => entry.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.value).toBe(spec.defaultValue);
  });

  it('zod enums built from the catalog accept exactly the catalog values', () => {
    expect(z.enum(CAPTION_STYLE.values).options).toEqual(CAPTION_STYLE.entries.map((entry) => entry.value));
    expect(CAPTION_STYLE.values).toHaveLength(24);
    expect(HOOK_STYLE.values).toHaveLength(11);
  });

  it('has the documented defaults', () => {
    expect({
      video_mode: VIDEO_MODE.defaultValue,
      clip_length: CLIP_LENGTH.defaultValue,
      caption_style: CAPTION_STYLE.defaultValue,
      hook_style: HOOK_STYLE.defaultValue,
      story_arc_style: STORY_ARC_STYLE.defaultValue,
      outro: OUTRO.defaultValue,
      framing: FRAMING.defaultValue,
    }).toEqual({
      video_mode: 'general',
      clip_length: '30_60s',
      caption_style: 'karaoke',
      hook_style: 'default',
      story_arc_style: 'none',
      outro: 'none',
      framing: 'auto',
    });
  });

  it('maps clip lengths to the backend clip_duration', () => {
    expect(Object.fromEntries(CLIP_LENGTH.entries.map((entry) => [entry.value, entry.backend]))).toEqual({
      auto: 0,
      up_to_30s: 20,
      '30_60s': 45,
      '60_90s': 75,
      '90s_3m': 120,
      '3m_5m': 240,
      '5m_10m': 450,
    });
  });

  it('maps outro none to an empty backend value and keeps the others', () => {
    expect(Object.fromEntries(OUTRO.entries.map((entry) => [entry.value, entry.backend]))).toEqual({
      none: '',
      default: 'default',
      soon: 'soon',
      like: 'like',
      custom: 'custom',
    });
  });

  it('maps framing to the two backend booleans', () => {
    expect(Object.fromEntries(FRAMING.entries.map((entry) => [entry.value, entry.backend]))).toEqual({
      auto: { full_frame: false, portrait_only: false },
      full_frame: { full_frame: true, portrait_only: false },
      portrait_only: { full_frame: false, portrait_only: true },
    });
  });

  it('maps story arc styles to the enable flag', () => {
    expect(Object.fromEntries(STORY_ARC_STYLE.entries.map((entry) => [entry.value, entry.backend]))).toEqual({
      none: { enable_story_arc: false, story_arc_style: 'none' },
      subtle: { enable_story_arc: true, story_arc_style: 'subtle' },
      dynamic: { enable_story_arc: true, story_arc_style: 'dynamic' },
      cinematic: { enable_story_arc: true, story_arc_style: 'cinematic' },
    });
  });

  it('passes video modes, caption styles and hook styles through unchanged', () => {
    [VIDEO_MODE, CAPTION_STYLE, HOOK_STYLE].forEach((spec) => {
      spec.entries.forEach((entry) => {
        expect(entry.backend).toBe(entry.value);
      });
    });
  });

  it('explains that smart_cut only works with podcast mode', () => {
    expect(VIDEO_MODE.description).toContain('smart_cut');
    expect(VIDEO_MODE.description).toContain('podcast');
  });
});

describe('language guide', () => {
  it('suggests the completion list of two-letter codes, none default', () => {
    expect(LANGUAGE.codes).toEqual([
      'en',
      'ru',
      'uk',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'ja',
      'ko',
      'zh',
      'kk',
      'be',
      'pl',
      'tr',
      'ar',
      'he',
      'hi',
      'cs',
      'bg',
      'sr',
    ]);
    expect(LANGUAGE.entries.every((entry) => /^[a-z]{2}$/.test(entry.value) && !entry.isDefault)).toBe(true);
    expect(LANGUAGE.entries.every((entry) => entry.description.length > 2)).toBe(true);
    expect(LANGUAGE.description).toContain("Never pass 'auto'");
  });
});

describe('pricingGuide', () => {
  it('states the rule with the window cap in minutes', () => {
    const guide = pricingGuide(1800);
    expect(guide.rule).toBe(
      '1 credit per started minute of the processed range (end_sec − start_sec), minimum 1, charged when the job is created. One job processes at most 30 minutes; split longer videos into several jobs with start_sec/end_sec. Options (captions, hooks, B-roll, music, agentic mode) do not change the price through the API.',
    );
    expect(guide.examples).toEqual(['45 s → 1 credit', '10 min → 10 credits', '29 min 30 s → 30 credits']);
    expect(guide.free).toEqual([
      'checks',
      'quotes',
      'transcriptions',
      'articles',
      'YouTube thumbnails',
      'retries of failed jobs',
      'reading results',
    ]);
  });

  it('uses seconds when the cap is not a whole number of minutes', () => {
    expect(pricingGuide(90).rule).toContain('at most 90 seconds;');
    expect(pricingGuide(600).rule).toContain('at most 10 minutes;');
    expect(pricingGuide(60).rule).toContain('at most 1 minute;');
  });

  it('states the no-refund fact before payment', () => {
    expect(PAID_JOB_NOTICE).toBe(
      'Credits are charged when the job is created and jobs cannot be cancelled. If processing fails, credits are not returned automatically; retry_clip_job re-runs a failed job for free, or the user can contact support@mnogo-reels.ru with the job_id.',
    );
  });
});
