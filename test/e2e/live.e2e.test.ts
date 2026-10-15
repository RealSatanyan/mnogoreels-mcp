import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { describe, expect, it, onTestFinished } from 'vitest';
import { USER_AGENT } from '../../src/api/http.js';
import { loadProcessConfig, resolveEffectiveConfig } from '../../src/config.js';
import { createDeps } from '../../src/runtime/deps.js';
import { createMcpServer } from '../../src/server/create-server.js';

const API_KEY = process.env['MNOGOREELS_E2E_API_KEY'] ?? '';
const VIDEO_URL = process.env['MNOGOREELS_E2E_VIDEO_URL'] ?? 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const SPEND = process.env['MNOGOREELS_E2E_SPEND'] === '1';
const API_URL = 'https://api.mnogo-reels.ru';
const JOB_WAIT_MS = 15 * 60_000;

type Structured = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Structured =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordsOf = (value: unknown): readonly Structured[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const textOf = (content: unknown): string =>
  recordsOf(content)
    .map((block) => (typeof block['text'] === 'string' ? block['text'] : ''))
    .join('\n');

const connect = async () => {
  const loaded = loadProcessConfig({ env: { MNOGOREELS_API_KEY: API_KEY } });
  if (!loaded.ok) throw new Error(loaded.error);
  const config = resolveEffectiveConfig({ process: loaded.config });
  const { apiKey } = loaded.config;
  const deps = createDeps();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const handle = serveStdio(() => createMcpServer({ config, apiKey, clientIp: undefined, deps }), {
    transport: serverSide,
  });
  const client = new Client(
    { name: 'mnogoreels-e2e', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(clientSide);
  await client.listTools();
  onTestFinished(async () => {
    await client.close();
    await handle.close();
  });
  const call = async (name: string, args: Structured = {}): Promise<Structured> => {
    const result = await client.callTool({ name, arguments: { ...args } });
    if (result.isError === true) throw new Error(`${name} failed: ${textOf(result.content)}`);
    expect(JSON.parse(textOf(result.content))).toEqual(result.structuredContent);
    return isRecord(result.structuredContent) ? result.structuredContent : {};
  };
  return { call };
};

const waitUntilTerminal = async (load: () => Promise<Structured>): Promise<Structured> => {
  const deadline = Date.now() + JOB_WAIT_MS;
  const poll = async (): Promise<Structured> => {
    const value = await load();
    if (value['is_terminal'] === true || Date.now() > deadline) return value;
    return poll();
  };
  return poll();
};

describe.skipIf(API_KEY === '')('live API, read-only (0 credits)', () => {
  it('the production user agent gets JSON from the API, not a firewall page', async () => {
    const response = await fetch(`${API_URL}/videos?limit=1`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', Authorization: `Bearer ${API_KEY}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('get_account reports a working key', async () => {
    const { call } = await connect();
    expect(await call('get_account')).toMatchObject({ authenticated: true, key_configured: true });
  });

  it('get_options_guide answers every topic', async () => {
    const { call } = await connect();
    expect(await call('get_options_guide', { topic: 'all' })).toMatchObject({ topic: 'all' });
  });

  it('list_clip_jobs returns a page and get_clip_job reads the latest completed job', async () => {
    const { call } = await connect();
    const page = await call('list_clip_jobs', { limit: 10 });
    expect(Array.isArray(page['jobs'])).toBe(true);
    const completed = recordsOf(page['jobs']).find(
      (job) => job['status'] === 'completed' && job['likely_kind'] !== 'republication',
    );
    if (completed === undefined) return;
    const job = await call('get_clip_job', {
      job_id: completed['job_id'],
      wait_sec: 0,
      response_format: 'detailed',
      max_clips: 3,
    });
    expect(job).toMatchObject({ job_id: completed['job_id'], status: 'completed', is_terminal: true });
  });

  it('check_video_source reports the duration of the test video', async () => {
    const { call } = await connect();
    const source = await call('check_video_source', { source_url: VIDEO_URL });
    expect(source).toMatchObject({ downloadable: true });
    expect(source['duration_sec']).toEqual(expect.any(Number));
  });

  it('quote_clip_job prices the short test video at 1 credit', async () => {
    const { call } = await connect();
    expect(await call('quote_clip_job', { source_url: VIDEO_URL })).toMatchObject({
      credits: 1,
      credits_exact: true,
      downloadable: true,
    });
  });

  it.each(['mine', 'shared'])('search_broll and get_broll_asset read the %s catalog', async (catalog) => {
    const { call } = await connect();
    const page = await call('search_broll', { catalog, limit: 5 });
    expect(page).toMatchObject({ catalog });
    const [first] = recordsOf(page['items']);
    if (first === undefined) return;
    expect(await call('get_broll_asset', { catalog, asset_id: first['asset_id'] })).toMatchObject({
      asset_id: first['asset_id'],
      catalog,
    });
  });

  it('list_packs returns a page and get_pack reads the first pack', async () => {
    const { call } = await connect();
    const page = await call('list_packs', { limit: 5 });
    expect(Array.isArray(page['packs'])).toBe(true);
    const [first] = recordsOf(page['packs']);
    if (first === undefined) return;
    expect(await call('get_pack', { pack_id: first['pack_id'], include_transcript: true })).toMatchObject({
      pack_id: first['pack_id'],
    });
  });
});

describe.skipIf(API_KEY === '' || !SPEND)('live API, paid flow (about 1 credit)', () => {
  it('creates a clip job, an article, a transcription and thumbnails', async () => {
    const { call } = await connect();
    const quote = await call('quote_clip_job', { source_url: VIDEO_URL });
    const created = await call('create_clip_job', {
      source_url: VIDEO_URL,
      max_credits: quote['credits'],
      clip_length: 'up_to_30s',
    });
    expect(created).toMatchObject({ credits: quote['credits'], deduplicated: false });
    const duplicate = await call('create_clip_job', {
      source_url: VIDEO_URL,
      max_credits: quote['credits'],
      clip_length: 'up_to_30s',
    });
    expect(duplicate).toMatchObject({ job_id: created['job_id'], deduplicated: true });

    const job = await waitUntilTerminal(() => call('get_clip_job', { job_id: created['job_id'], wait_sec: 50 }));
    expect(job['status']).toBe('completed');
    const [clip] = recordsOf(job['clips']);
    const video = clip?.['video'];
    const url = isRecord(video) ? String(video['url']) : '';
    expect((await fetch(url, { method: 'HEAD' })).status).toBe(200);

    const article = await call('create_article', { clip_job_id: created['job_id'] });
    const articleDone = await waitUntilTerminal(() =>
      call('get_article', { article_id: article['article_id'], wait_sec: 50 }),
    );
    expect(articleDone['content_markdown']).toEqual(expect.any(String));

    const transcription = await call('create_transcription', { source_url: VIDEO_URL });
    const transcript = await waitUntilTerminal(() =>
      call('get_transcription', { transcription_id: transcription['transcription_id'], wait_sec: 50 }),
    );
    expect(transcript['status']).toBe('completed');

    const thumbnails = await call('create_youtube_thumbnails', { source_url: VIDEO_URL, variants: 1, language: 'en' });
    const thumbnailsDone = await waitUntilTerminal(() =>
      call('get_youtube_thumbnails', { thumbnail_job_id: thumbnails['thumbnail_job_id'], wait_sec: 50 }),
    );
    expect(thumbnailsDone['status']).toBe('completed');
    expect(recordsOf(thumbnailsDone['variants']).length).toBeGreaterThanOrEqual(1);
  });
});
