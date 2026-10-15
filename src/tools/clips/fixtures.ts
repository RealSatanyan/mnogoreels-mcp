import { onTestFinished } from 'vitest';
import type { z } from 'zod';
import { ok, status, type FakeResponse, type FakeRoute } from '../../../test/support/fake-api.js';
import { createHarness, type Harness, type HarnessOptions } from '../../../test/support/harness.js';
import { clipsToolset } from './index.js';
import type {
  ColdHookSchema,
  DownloadProbeSchema,
  JobResponseSchema,
  ManifestClipSchema,
  ManifestSchema,
} from './schemas.js';

export type JobInput = z.input<typeof JobResponseSchema>;
export type ManifestClipInput = z.input<typeof ManifestClipSchema>;
export type ColdHookInput = z.input<typeof ColdHookSchema>;

export const JOB_ID = '0123456789abcdef0123456789abcdef';
export const OTHER_JOB_ID = 'fedcba9876543210fedcba9876543210';
export const SOURCE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
export const R2 = 'https://pub-d86608a8848d48d885d3865737f7f771.r2.dev';

export const clipUrl = (n: number, jobId = JOB_ID): string => `${R2}/smart-reels/${jobId}/clips/clip_${String(n)}.mp4`;

export const posterUrl = (n: number, jobId = JOB_ID): string =>
  `${R2}/smart-reels/${jobId}/posters/clip_${String(n)}.jpg`;

export const aJob = (overrides: Partial<JobInput> = {}): JobInput => ({
  id: JOB_ID,
  status: 'completed',
  source_url: SOURCE_URL,
  s3_final_url: null,
  s3_clip_urls: [clipUrl(1), clipUrl(2)],
  s3_clip_poster_urls: [posterUrl(1), posterUrl(2)],
  cold_hooks: [],
  teaser_url: null,
  teaser_urls: [],
  s3_model_json_url: `${R2}/smart-reels/${JOB_ID}/model.json`,
  media_available: true,
  progress: 1,
  eta_seconds: null,
  crop_quality_summary: { ok: 2 },
  pack_id: null,
  error: null,
  ...overrides,
});

export const aManifestClip = (overrides: Partial<ManifestClipInput> = {}): ManifestClipInput => ({
  clip_id: 1,
  start: 12.5,
  end: 55.25,
  duration: 42.75,
  rendered_duration: 42.7,
  hook: 'The one habit that changed everything',
  title: 'Why habits beat motivation',
  description: 'A short story about habits.',
  text: 'So the thing about habits is that they compound over time.',
  score: 70,
  final_score: 82,
  poster_url: null,
  ...overrides,
});

export const aManifest = (clips: readonly ManifestClipInput[]): z.input<typeof ManifestSchema> => ({
  clips: [...clips],
});

export const aColdHook = (overrides: Partial<ColdHookInput> = {}): ColdHookInput => ({
  url: `${R2}/smart-reels/${JOB_ID}/hooks/hook_1.mp4`,
  clip_id: 1,
  duration: 4.25,
  text: 'You will not believe this',
  ...overrides,
});

export const aDownloadProbe = (
  overrides: Partial<z.input<typeof DownloadProbeSchema>> = {},
): z.input<typeof DownloadProbeSchema> => ({
  downloadable: true,
  reason: null,
  title: 'Talk about habits',
  duration: 600,
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  ...overrides,
});

type Respond = FakeRoute['respond'];

const always =
  (response: FakeResponse): Respond =>
  () =>
    response;

export const downloadsProbeRoute = (respond: Respond = always(ok(aDownloadProbe()))): FakeRoute => ({
  method: 'POST',
  path: '/downloads/probe',
  respond,
});

export const yandexProbeRoute = (respond: Respond): FakeRoute => ({
  method: 'POST',
  path: '/yandex-disk/probe',
  respond,
});

export const driveProbeRoute = (respond: Respond): FakeRoute => ({
  method: 'POST',
  path: '/google-drive/probe',
  respond,
});

export const jobRoute = (respond: Respond, jobId = JOB_ID): FakeRoute => ({
  method: 'GET',
  path: `/videos/${jobId}`,
  respond,
});

export const manifestRoute = (respond: Respond, jobId = JOB_ID): FakeRoute => ({
  method: 'GET',
  path: `/videos/${jobId}/model-json`,
  respond,
});

export const listRoute = (respond: Respond): FakeRoute => ({ method: 'GET', path: '/videos', respond });

export const createRoute = (respond: Respond = always(ok(aJob({ status: 'queued' })))): FakeRoute => ({
  method: 'POST',
  path: '/videos',
  respond,
});

export const recutRoute = (respond: Respond, jobId = JOB_ID): FakeRoute => ({
  method: 'POST',
  path: `/videos/${jobId}/recut`,
  respond,
});

export const reloadRoute = (respond: Respond, jobId = JOB_ID): FakeRoute => ({
  method: 'POST',
  path: `/tasks/${jobId}/reload`,
  respond,
});

export const jobKindRoutes = (
  kind: 'clip' | 'transcription' | 'republication' = 'clip',
  jobId = JOB_ID,
): readonly FakeRoute[] => [
  {
    method: 'GET',
    path: `/transcriptions/${jobId}`,
    respond: () =>
      kind === 'transcription'
        ? ok({ id: jobId, status: 'completed', kind: 'transcribe' })
        : status(404, 'transcription job not found'),
  },
  {
    method: 'GET',
    path: `/republications/${jobId}`,
    respond: () =>
      kind === 'republication' ? ok({ id: jobId, status: 'completed' }) : status(404, 'republication not found'),
  },
];

export const startClips = async (options: HarnessOptions = {}): Promise<Harness> => {
  const harness = await createHarness({ tools: clipsToolset.tools, ...options });
  onTestFinished(harness.close);
  return harness;
};

export const callTool = (harness: Harness, name: string, args: Readonly<Record<string, unknown>> = {}) =>
  harness.client.callTool({ name, arguments: { ...args } });
