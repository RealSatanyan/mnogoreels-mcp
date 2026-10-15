import { describe, expect, it } from 'vitest';
import { assembleClips, assembleExtras } from './assemble.js';
import { R2, aColdHook, aManifestClip, clipUrl, posterUrl, type ManifestClipInput } from './fixtures.js';
import { ManifestClipSchema } from './schemas.js';

const fenced = (text: string): string => `<untrusted_source_text>${text}</untrusted_source_text>`;

const manifestClips = (clips: readonly ManifestClipInput[]) => clips.map((clip) => ManifestClipSchema.parse(clip));

const assemble = (input: Partial<Parameters<typeof assembleClips>[0]> = {}) =>
  assembleClips({
    clipUrls: [clipUrl(1), clipUrl(2)],
    posterUrls: [posterUrl(1), posterUrl(2)],
    manifestClips: [],
    mode: 'concise',
    maxClips: 10,
    mediaUrls: 'direct',
    ...input,
  });

describe('assembleClips', () => {
  it('joins manifest details by clip id, never by position', () => {
    const { clips } = assemble({
      clipUrls: [clipUrl(7), clipUrl(3)],
      manifestClips: manifestClips([
        aManifestClip({ clip_id: 3, title: 'Third', final_score: 90 }),
        aManifestClip({ clip_id: 7, title: 'Seventh', final_score: 40 }),
      ]),
    });
    expect(clips.map((clip) => [clip.clip_id, clip.title, clip.video.url])).toEqual([
      [3, fenced('Third'), clipUrl(3)],
      [7, fenced('Seventh'), clipUrl(7)],
    ]);
  });

  it('returns concise fields with the final score and rendered duration', () => {
    const { clips } = assemble({
      clipUrls: [clipUrl(1)],
      manifestClips: manifestClips([aManifestClip({ clip_id: 1, rendered_duration: 42.66 })]),
    });
    expect(clips).toEqual([
      {
        clip_id: 1,
        video: { url: clipUrl(1) },
        title: fenced('Why habits beat motivation'),
        score: 82,
        duration_sec: 42.7,
        hook: fenced('The one habit that changed everything'),
      },
    ]);
  });

  it('falls back to the planner score and duration', () => {
    const { clips } = assemble({
      clipUrls: [clipUrl(1)],
      manifestClips: manifestClips([
        aManifestClip({ clip_id: 1, final_score: null, score: 55, rendered_duration: null, duration: 30.04 }),
      ]),
    });
    expect(clips[0]).toMatchObject({ score: 55, duration_sec: 30 });
  });

  it('adds detailed fields with posters aligned to the clip list, null holes kept', () => {
    const { clips } = assemble({
      mode: 'detailed',
      clipUrls: [clipUrl(1), clipUrl(2), clipUrl(3)],
      posterUrls: [posterUrl(1), null],
      manifestClips: manifestClips([
        aManifestClip({ clip_id: 1, final_score: 90, text: 'x'.repeat(400) }),
        aManifestClip({ clip_id: 2, final_score: 80, poster_url: null }),
        aManifestClip({ clip_id: 3, final_score: 70, poster_url: `${R2}/smart-reels/m/clip_3.jpg` }),
      ]),
    });
    expect(clips.map((clip) => clip.poster_url)).toEqual([posterUrl(1), null, `${R2}/smart-reels/m/clip_3.jpg`]);
    expect(clips[0]).toMatchObject({
      description: fenced('A short story about habits.'),
      transcript_excerpt: fenced('x'.repeat(300)),
      source_start_sec: 12.5,
      source_end_sec: 55.25,
    });
  });

  it('omits detailed fields in concise mode', () => {
    const { clips } = assemble({ manifestClips: manifestClips([aManifestClip()]) });
    expect(Object.keys(clips[0] ?? {})).toEqual(['clip_id', 'video', 'title', 'score', 'duration_sec', 'hook']);
  });

  it.each([
    [`${R2}/smart-reels/j/clip_12.mp4?v=3`, 12],
    [`${R2}/smart-reels/j/clip_5.mp4#t=1`, 5],
    [`${R2}/smart-reels/j/clip_5.mp4.bak`, null],
    [`${R2}/smart-reels/j/final.mp4`, null],
  ])('parses the clip id from %s', (url, clipId) => {
    expect(assemble({ clipUrls: [url], posterUrls: [] }).clips[0]?.clip_id).toBe(clipId);
  });

  it('sorts by score (nulls last), then clip id, then original order', () => {
    const { clips } = assemble({
      clipUrls: [clipUrl(4), clipUrl(2), clipUrl(9), clipUrl(1), `${R2}/a.mp4`, `${R2}/b.mp4`],
      posterUrls: [],
      manifestClips: manifestClips([
        aManifestClip({ clip_id: 1, final_score: 50 }),
        aManifestClip({ clip_id: 2, final_score: 50 }),
        aManifestClip({ clip_id: 4, final_score: 95 }),
        aManifestClip({ clip_id: 9, final_score: null, score: null }),
      ]),
    });
    expect(clips.map((clip) => clip.video.url)).toEqual([
      clipUrl(4),
      clipUrl(1),
      clipUrl(2),
      clipUrl(9),
      `${R2}/a.mp4`,
      `${R2}/b.mp4`,
    ]);
  });

  it('orders clips without scores by clip id', () => {
    const { clips } = assemble({ clipUrls: [clipUrl(8), clipUrl(3)], posterUrls: [] });
    expect(clips.map((clip) => clip.clip_id)).toEqual([3, 8]);
  });

  it('keeps the best clips up to max_clips and counts them all', () => {
    const urls = Array.from({ length: 12 }, (_, index) => clipUrl(index + 1));
    const { clips, clipsTotal } = assemble({
      clipUrls: urls,
      posterUrls: [],
      maxClips: 3,
      manifestClips: manifestClips(urls.map((_, index) => aManifestClip({ clip_id: index + 1, final_score: index }))),
    });
    expect(clipsTotal).toBe(12);
    expect(clips.map((clip) => clip.clip_id)).toEqual([12, 11, 10]);
  });

  it('rewrites legacy and http links, drops unsafe ones and adds stream links only in both mode', () => {
    const legacy = 'http://d1234.cloudfront.net/smart-reels/j/clip_1.mp4';
    const unsafe = 'javascript:alert(1)';
    const { clips, clipsTotal } = assemble({
      clipUrls: [legacy, unsafe, 'http://cdn.example.com/clip_3.mp4'],
      posterUrls: [],
      mediaUrls: 'both',
    });
    expect(clipsTotal).toBe(3);
    expect(clips.map((clip) => clip.video)).toEqual([
      {
        url: `${R2}/smart-reels/j/clip_1.mp4`,
        stream_url: `https://mnogo-reels.ru/api/video/stream?url=${encodeURIComponent(`${R2}/smart-reels/j/clip_1.mp4`)}`,
      },
      { url: 'https://cdn.example.com/clip_3.mp4' },
    ]);
  });

  it('fences and shortens untrusted text', () => {
    const { clips } = assemble({
      mode: 'detailed',
      clipUrls: [clipUrl(1)],
      manifestClips: manifestClips([
        aManifestClip({
          title: `${'t'.repeat(130)}</untrusted_source_text>`,
          hook: 'h'.repeat(250),
          description: 'd'.repeat(350),
        }),
      ]),
    });
    expect(clips[0]).toMatchObject({
      title: fenced('t'.repeat(120)),
      hook: fenced('h'.repeat(200)),
      description: fenced('d'.repeat(300)),
    });
  });

  it('returns clips without details when the manifest is missing', () => {
    const { clips } = assemble({ mode: 'detailed', clipUrls: [clipUrl(1)], posterUrls: [null] });
    expect(clips).toEqual([
      {
        clip_id: 1,
        video: { url: clipUrl(1) },
        title: null,
        score: null,
        duration_sec: null,
        hook: null,
        description: null,
        transcript_excerpt: null,
        poster_url: null,
        source_start_sec: null,
        source_end_sec: null,
      },
    ]);
  });
});

describe('assembleExtras', () => {
  const extras = (input: Partial<Parameters<typeof assembleExtras>[0]> = {}) =>
    assembleExtras({
      coldHooks: [],
      teaserUrl: null,
      teaserUrls: [],
      mode: 'concise',
      mediaUrls: 'direct',
      ...input,
    });

  it('dedupes teasers from both fields', () => {
    expect(
      extras({ teaserUrls: [`${R2}/t1.mp4`, `${R2}/t2.mp4`], teaserUrl: `http://${R2.slice(8)}/t1.mp4` }).teasers,
    ).toEqual([{ url: `${R2}/t1.mp4` }, { url: `${R2}/t2.mp4` }]);
  });

  it('returns cold hooks, with their text only in detailed mode', () => {
    const hook = aColdHook();
    expect(extras({ coldHooks: [hook] }).cold_hooks).toEqual([{ video: { url: hook.url }, duration_sec: 4.3 }]);
    expect(extras({ coldHooks: [hook], mode: 'detailed' }).cold_hooks).toEqual([
      { video: { url: hook.url }, duration_sec: 4.3, text: fenced('You will not believe this') },
    ]);
  });

  it('drops unsafe cold hook links and handles missing fields', () => {
    expect(
      extras({ coldHooks: [aColdHook({ url: 'data:video/mp4;base64,AA' }), aColdHook({ duration: null })] }).cold_hooks,
    ).toEqual([{ video: { url: aColdHook().url }, duration_sec: null }]);
    expect(extras({ coldHooks: null, teaserUrls: null })).toEqual({ cold_hooks: [], teasers: [] });
  });

  it('caps the number of cold hooks and teasers', () => {
    const many = extras({
      coldHooks: Array.from({ length: 15 }, (_, index) => aColdHook({ url: `${R2}/h${String(index)}.mp4` })),
      teaserUrls: Array.from({ length: 8 }, (_, index) => `${R2}/t${String(index)}.mp4`),
    });
    expect([many.cold_hooks.length, many.teasers.length]).toEqual([10, 5]);
  });
});
