import { describe, expect, it } from 'vitest';
import { ok } from '../../../test/support/fake-api.js';
import { CAPTION_STYLE, HOOK_STYLE, VIDEO_MODE } from '../../domain/options.js';
import { SOURCE_URL, aJob, callTool, createRoute, downloadsProbeRoute, startClips } from './fixtures.js';

const bodyFor = async (options: Readonly<Record<string, unknown>>, config: Parameters<typeof startClips>[0] = {}) => {
  const harness = await startClips({
    routes: [downloadsProbeRoute(), createRoute(() => ok(aJob({ status: 'queued' })))],
    ...config,
  });
  const result = await callTool(harness, 'create_clip_job', { source_url: SOURCE_URL, max_credits: 10, ...options });
  expect(result.isError).toBeFalsy();
  return harness.api.requestsTo('POST', '/videos')[0]?.body;
};

describe('create_clip_job request body', () => {
  it('sends every documented field with the defaults, in a stable shape', async () => {
    expect(await bodyFor({})).toEqual({
      url: SOURCE_URL,
      start_sec: 0,
      end_sec: 600,
      clip_duration: 45,
      clip_durations: [],
      video_mode: 'general',
      caption_style: 'karaoke',
      hook_style: 'default',
      add_music: false,
      gemini_emojis: false,
      podcast_montage: false,
      b_roll: false,
      b_roll_video: false,
      b_roll_image: false,
      b_roll_motion: false,
      b_roll_memes: false,
      outro: '',
      enable_cold_open: false,
      enable_story_arc: false,
      story_arc_style: 'none',
      enable_critic: false,
      direct_mode: false,
      full_frame: false,
      portrait_only: false,
    });
  });

  it.each([
    ['auto', 0],
    ['up_to_30s', 20],
    ['30_60s', 45],
    ['60_90s', 75],
    ['90s_3m', 120],
    ['3m_5m', 240],
    ['5m_10m', 450],
  ])('maps clip_length %s to clip_duration %d', async (clipLength, clipDuration) => {
    expect(await bodyFor({ clip_length: clipLength })).toMatchObject({
      clip_duration: clipDuration,
      clip_durations: [],
    });
  });

  it.each(VIDEO_MODE.values.map((value) => [value]))('passes video_mode %s through', async (value) => {
    expect(await bodyFor({ video_mode: value })).toMatchObject({ video_mode: value });
  });

  it('passes caption and hook styles through', async () => {
    expect(await bodyFor({ caption_style: CAPTION_STYLE.values[14], hook_style: HOOK_STYLE.values[10] })).toMatchObject(
      {
        caption_style: 'boxed',
        hook_style: 'none',
      },
    );
  });

  it('sends the language and prompt only when given', async () => {
    const body = await bodyFor({ language: 'ru', prompt: 'funny moments about money' });
    expect(body).toMatchObject({ language: 'ru', gemini_prompt: 'funny moments about money' });
    const defaults = await bodyFor({});
    expect(defaults).not.toHaveProperty('language');
    expect(defaults).not.toHaveProperty('gemini_prompt');
  });

  it('maps the switches', async () => {
    expect(
      await bodyFor({
        cold_open: true,
        add_music: true,
        emojis: true,
        smart_cut: true,
        agentic_mode: true,
        keep_whole_video: true,
      }),
    ).toMatchObject({
      enable_cold_open: true,
      add_music: true,
      gemini_emojis: true,
      podcast_montage: true,
      enable_critic: true,
      direct_mode: true,
    });
  });

  it.each([
    ['none', false],
    ['subtle', true],
    ['cinematic', true],
  ])('maps story_arc_style %s', async (style, enabled) => {
    expect(await bodyFor({ story_arc_style: style })).toMatchObject({
      enable_story_arc: enabled,
      story_arc_style: style,
    });
  });

  it('maps every B-roll switch and keeps memes and legacy b_roll off', async () => {
    expect(
      await bodyFor({ b_roll_stock_video: true, b_roll_ai_images: true, b_roll_motion_graphics: true }),
    ).toMatchObject({
      b_roll: false,
      b_roll_video: true,
      b_roll_image: true,
      b_roll_motion: true,
      b_roll_memes: false,
    });
  });

  it.each([
    ['none', ''],
    ['default', 'default'],
    ['soon', 'soon'],
    ['like', 'like'],
    ['custom', 'custom'],
  ])('maps outro %s', async (outro, sent) => {
    expect(await bodyFor({ outro })).toMatchObject({ outro: sent });
  });

  it.each([
    ['auto', false, false],
    ['full_frame', true, false],
    ['portrait_only', false, true],
  ])('maps framing %s to both booleans', async (framing, fullFrame, portraitOnly) => {
    expect(await bodyFor({ framing })).toMatchObject({ full_frame: fullFrame, portrait_only: portraitOnly });
  });

  it.each([
    [{ language: 'auto' }],
    [{ language: 'RU' }],
    [{ caption_style: 'comic' }],
    [{ outro: 'outro.mp4' }],
    [{ prompt: '' }],
  ])('rejects invalid option values %j through the schema', async (options) => {
    const harness = await startClips();
    const result = await callTool(harness, 'create_clip_job', { source_url: SOURCE_URL, max_credits: 10, ...options });
    expect(result.isError).toBe(true);
    expect(harness.api.requests()).toHaveLength(0);
  });
});

describe('create_clip_job in the directory profile', () => {
  const directory = { config: { profile: 'directory' as const, directory: true } };

  it('hides the AI image and motion-graphics B-roll switches', async () => {
    const harness = await startClips(directory);
    const tool = (await harness.client.listTools()).tools.find((candidate) => candidate.name === 'create_clip_job');
    const properties = Object.keys(tool?.inputSchema.properties ?? {});
    expect(properties).toContain('b_roll_stock_video');
    expect(properties).not.toContain('b_roll_ai_images');
    expect(properties).not.toContain('b_roll_motion_graphics');
  });

  it('always sends them switched off', async () => {
    expect(
      await bodyFor({ b_roll_stock_video: true, b_roll_ai_images: true, b_roll_motion_graphics: true }, directory),
    ).toMatchObject({ b_roll_video: true, b_roll_image: false, b_roll_motion: false });
  });
});
