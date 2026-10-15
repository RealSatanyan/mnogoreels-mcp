import { describe, expect, it, onTestFinished } from 'vitest';
import { ok, status, type FakeRoute } from '../../../test/support/fake-api.js';
import { createV1Harness, structuredOf, textOf } from '../../../test/support/harness.js';
import { clipsToolset } from './index.js';
import {
  JOB_ID,
  OTHER_JOB_ID,
  SOURCE_URL,
  aColdHook,
  aJob,
  aManifest,
  aManifestClip,
  createRoute,
  downloadsProbeRoute,
  jobKindRoutes,
  jobRoute,
  listRoute,
  manifestRoute,
  recutRoute,
  reloadRoute,
  startClips,
} from './fixtures.js';

const NEW_JOB_ID = 'abcdefabcdefabcdefabcdefabcdef12';

const backend = (): readonly FakeRoute[] => [
  downloadsProbeRoute(),
  ...jobKindRoutes('clip', JOB_ID),
  ...jobKindRoutes('clip', OTHER_JOB_ID),
  jobRoute(() =>
    ok(aJob({ cold_hooks: [aColdHook()], teaser_url: 'http://cdn.example.com/teaser.mp4', pack_id: 'pack1' })),
  ),
  jobRoute(() => ok(aJob({ id: OTHER_JOB_ID, status: 'failed', error: 'render failed' })), OTHER_JOB_ID),
  manifestRoute(() => ok(aManifest([aManifestClip(), aManifestClip({ clip_id: 2, final_score: null })]))),
  listRoute(() => ok({ items: [aJob(), aJob({ id: OTHER_JOB_ID, status: 'failed', error: 'x' })] })),
  createRoute(() => ok(aJob({ id: NEW_JOB_ID, status: 'queued', s3_clip_urls: [] }))),
  recutRoute(() => ok(aJob({ id: NEW_JOB_ID, status: 'queued', s3_clip_urls: [] }))),
  reloadRoute(() => ok(aJob({ id: OTHER_JOB_ID, status: 'queued' })), OTHER_JOB_ID),
];

const CALLS: readonly (readonly [string, Readonly<Record<string, unknown>>])[] = [
  ['check_video_source', { source_url: SOURCE_URL }],
  ['quote_clip_job', { source_url: SOURCE_URL }],
  ['create_clip_job', { source_url: SOURCE_URL, max_credits: 10 }],
  ['get_clip_job', { job_id: JOB_ID, wait_sec: 0, response_format: 'detailed' }],
  ['list_clip_jobs', {}],
  ['recut_clip_job', { job_id: JOB_ID, max_credits: 10 }],
  ['retry_clip_job', { job_id: OTHER_JOB_ID }],
];

const ANNOTATIONS = {
  check_video_source: ['Check video source', true, false, true, true],
  quote_clip_job: ['Quote clip job cost', true, false, true, true],
  create_clip_job: ['Create clip job (spends credits)', false, true, false, true],
  get_clip_job: ['Get clip job status and clips', true, false, true, false],
  list_clip_jobs: ['List clip jobs', true, false, true, false],
  recut_clip_job: ['Recut clip job (spends credits)', false, true, false, false],
  retry_clip_job: ['Retry failed clip job (free)', false, false, false, false],
} as const;

const MODES = [
  ['http', 'modern'],
  ['http', 'legacy'],
  ['stdio', 'legacy'],
  ['stdio', 'modern'],
] as const;

describe('clips toolset listing', () => {
  it.each(MODES)('lists the clip tools in registration order with full annotations (%s %s)', async (transport, era) => {
    const harness = await startClips({ transport, era });
    const { tools } = await harness.client.listTools();
    expect(tools.map((tool) => [tool.name, tool.title, tool.annotations])).toEqual(
      Object.entries(ANNOTATIONS).map(
        ([name, [title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint]]) => [
          name,
          title,
          { title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint },
        ],
      ),
    );
    tools.forEach((tool) => {
      expect(tool.outputSchema).toMatchObject({ type: 'object' });
    });
  });

  it.each([
    [
      'readonly',
      { readOnly: true, profile: 'readonly' as const },
      ['check_video_source', 'quote_clip_job', 'get_clip_job', 'list_clip_jobs'],
    ],
    ['directory', { directory: true, profile: 'directory' as const }, Object.keys(ANNOTATIONS)],
  ])('lists the tools allowed in the %s profile', async (_label, config, names) => {
    const harness = await startClips({ config });
    expect((await harness.client.listTools()).tools.map((tool) => tool.name)).toEqual(names);
  });

  it('exports the toolset in the registration order', () => {
    expect(clipsToolset.name).toBe('clips');
    expect(clipsToolset.tools.map((tool) => [tool.name, tool.toolset])).toEqual(
      Object.keys(ANNOTATIONS).map((name) => [name, 'clips']),
    );
  });
});

describe.each(MODES)('clip tools succeed end to end (%s %s)', (transport, era) => {
  it.each(CALLS)('%s', async (name, args) => {
    const harness = await startClips({ transport, era, routes: backend() });
    const result = await harness.client.callTool({ name, arguments: { ...args } });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  });
});

describe.each(['stdio', 'http'] as const)('clip tools through the v1 SDK client over %s', (v1Transport) => {
  const startV1 = async (routes: readonly FakeRoute[]) => {
    const harness = await createV1Harness({ v1Transport, tools: clipsToolset.tools, routes });
    onTestFinished(harness.close);
    return harness;
  };

  it.each(CALLS)('%s returns structured content that matches its advertised schema', async (name, args) => {
    const harness = await startV1(backend());
    const result = await harness.client.callTool({ name, arguments: { ...args } });
    expect(result.isError).toBeFalsy();
    expect(structuredOf(result)).toEqual(JSON.parse(textOf(result)));
  });

  it.each([
    ['check_video_source', { source_url: 'ftp://example.com/v.mp4' }, 'invalid_arguments'],
    ['quote_clip_job', { job_id: JOB_ID }, 'not_found'],
    ['create_clip_job', { source_url: SOURCE_URL, max_credits: 1 }, 'spend_cap_exceeded'],
    ['get_clip_job', { job_id: JOB_ID, wait_sec: 0 }, 'not_found'],
    ['list_clip_jobs', {}, 'invalid_api_key'],
    ['recut_clip_job', { job_id: JOB_ID, max_credits: 10 }, 'not_found'],
    ['retry_clip_job', { job_id: JOB_ID }, 'not_found'],
  ] as const)('%s reports errors as text only', async (name, args, code) => {
    const harness = await startV1([
      downloadsProbeRoute(),
      ...jobKindRoutes(),
      jobRoute(() => status(404, 'job not found')),
      listRoute(() => status(401, 'Invalid token')),
    ]);
    const result = await harness.client.callTool({ name, arguments: { ...args } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result)).toMatch(new RegExp(`^Error \\[${code}\\]:`));
  });
});
