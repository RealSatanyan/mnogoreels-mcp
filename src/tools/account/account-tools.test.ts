import { describe, expect, it, onTestFinished } from 'vitest';
import { html, ok, status, type FakeRoute } from '../../../test/support/fake-api.js';
import {
  TEST_API_KEY,
  createHarness,
  structuredOf,
  textOf,
  type HarnessOptions,
} from '../../../test/support/harness.js';
import { CAPTION_STYLE, OPTION_CATALOG } from '../../domain/options.js';
import { VERSION } from '../../version.js';

const KEYS = 'https://mnogo-reels.ru/dashboard/developers?tab=keys';
const videosRoute = (respond: FakeRoute['respond']): FakeRoute => ({ method: 'GET', path: '/videos', respond });

const start = async (options: HarnessOptions = {}) => {
  const harness = await createHarness(options);
  onTestFinished(harness.close);
  return harness;
};

const getAccount = async (options: HarnessOptions = {}) => {
  const harness = await start(options);
  const result = await harness.client.callTool({ name: 'get_account', arguments: {} });
  return { harness, result };
};

describe('account toolset listing', () => {
  it.each(['modern', 'legacy'] as const)(
    'lists get_account and get_options_guide first, with full annotations (%s)',
    async (era) => {
      const harness = await start({ era });
      const { tools } = await harness.client.listTools();
      const account = tools.filter((tool) => tool.name === 'get_account' || tool.name === 'get_options_guide');
      expect(account.map((tool) => tool.name)).toEqual(['get_account', 'get_options_guide']);
      expect(tools.slice(0, 2).map((tool) => tool.name)).toEqual(['get_account', 'get_options_guide']);
      expect(account.map((tool) => [tool.title, tool.annotations])).toEqual([
        [
          'Check API key and settings',
          {
            title: 'Check API key and settings',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        ],
        [
          'Explain clip options',
          {
            title: 'Explain clip options',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        ],
      ]);
      expect(account[0]?.inputSchema).toMatchObject({ type: 'object', properties: {}, additionalProperties: false });
    },
  );

  it('describes get_account exactly', async () => {
    const harness = await start();
    const tool = (await harness.client.listTools()).tools.find((candidate) => candidate.name === 'get_account');
    expect(tool?.description).toBe(
      [
        "Checks whether the configured MnogoReels API key works and shows this server's settings. Read-only and free; works without a key.",
        'Use it first when other tools fail with an authentication error, or when the user asks which account or mode is active. It does not change anything.',
        'Returns authenticated (true or false), a masked key hint (last 4 characters only), the API URL, the server version and transport, the active profile, enabled toolsets, whether read-only mode is on, the per-call credit cap if one is set, and links for managing keys and credits. The credit balance itself is not available through the API; the user can see it on mnogo-reels.ru.',
      ].join('\n\n'),
    );
  });

  it('describes get_options_guide exactly', async () => {
    const harness = await start();
    const tool = (await harness.client.listTools()).tools.find((candidate) => candidate.name === 'get_options_guide');
    expect(tool?.description).toBe(
      [
        'Explains the option values accepted by create_clip_job and recut_clip_job: video modes, clip lengths, caption styles, hook styles, story arc styles, outros, framing and languages, plus the pricing rules and the 30-minute limit per job. Read-only and free; works without an API key and makes no network calls.',
        'Use it when the user asks what a style looks like, which mode fits their video, or how much processing costs. topic selects one section; all returns everything.',
      ].join('\n\n'),
    );
    expect(tool?.inputSchema).toMatchObject({
      properties: { topic: { default: 'all', description: 'Which section to return.' } },
    });
  });
});

describe('get_account', () => {
  it('reports a missing key without calling the API', async () => {
    const { result, harness } = await getAccount({ apiKey: undefined, transport: 'stdio' });
    expect(result.structuredContent).toEqual({
      authenticated: false,
      key_configured: false,
      api_key_hint: null,
      api_url: harness.config.apiUrl,
      server_version: VERSION,
      transport: 'stdio',
      profile: 'default',
      toolsets: ['account', 'clips', 'transcripts', 'articles', 'library', 'thumbnails'],
      read_only: false,
      max_credits_per_call: null,
      credit_balance: null,
      message: `No MnogoReels API key is configured. Create one at ${KEYS}, then set MNOGOREELS_API_KEY (local server) or send it as 'Authorization: Bearer <key>' (remote server).`,
      links: {
        manage_keys: KEYS,
        credits_help: 'https://mnogo-reels.ru/docs/credits',
        buy_credits: 'https://mnogo-reels.ru',
        docs: 'https://github.com/RealSatanyan/mnogoreels-mcp#readme',
      },
    });
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('reports a malformed key without calling the API', async () => {
    const { result, harness } = await getAccount({ apiKey: 'mrfrt_svc_abcdefghijklmnopqrstuvwx' });
    expect(result.structuredContent).toMatchObject({
      authenticated: false,
      key_configured: true,
      api_key_hint: 'mrfrt_svc_…uvwx',
      message: `The configured API key does not look like a MnogoReels user key (it must start with mrfrt_usr_). Copy it again from ${KEYS}.`,
    });
    expect(harness.api.requests()).toHaveLength(0);
  });

  it('confirms a working key with one cheap list call', async () => {
    const { result, harness } = await getAccount({ routes: [videosRoute(() => ok({ items: [], total: 0 }))] });
    expect(result.structuredContent).toMatchObject({
      authenticated: true,
      key_configured: true,
      api_key_hint: `mrfrt_usr_…${TEST_API_KEY.slice(-4)}`,
      message: 'The API key works.',
      transport: 'http',
    });
    expect(harness.api.requests()).toMatchObject([
      { method: 'GET', path: '/videos', query: { limit: '1' }, authorized: true },
    ]);
    expect(textOf(result)).not.toContain(TEST_API_KEY);
  });

  it('reports a rejected key', async () => {
    const { result } = await getAccount({ routes: [videosRoute(() => status(401, 'Invalid token'))] });
    expect(result.structuredContent).toMatchObject({
      authenticated: false,
      key_configured: true,
      message: `MnogoReels rejected the API key (revoked, deleted or mistyped). Create a new key at ${KEYS} and update the client configuration.`,
    });
  });

  it('reports a key without a user', async () => {
    const { result } = await getAccount({ routes: [videosRoute(() => status(403, 'Token has no associated user'))] });
    expect(result.structuredContent).toMatchObject({
      authenticated: false,
      message: `This API key is not linked to a MnogoReels account. Create a new key at ${KEYS}.`,
    });
  });

  it.each([
    ['server error', () => status(500), 'upstream_error'],
    ['firewall', () => html(403), 'upstream_blocked'],
    ['other 403', () => status(403, 'Something else'), 'not_available_for_api_keys'],
  ])('turns other failures into tool errors (%s)', async (_label, respond, code) => {
    const { result } = await getAccount({ routes: [videosRoute(respond)] });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(new RegExp(`^Error \\[${code}\\]:`));
  });

  it('shows the effective settings', async () => {
    const { result } = await getAccount({
      routes: [videosRoute(() => ok({ items: [] }))],
      config: {
        profile: 'directory',
        directory: true,
        readOnly: true,
        maxCreditsPerCall: 25,
        toolsets: new Set(['library', 'account', 'clips']),
      },
    });
    expect(result.structuredContent).toMatchObject({
      profile: 'directory',
      read_only: true,
      max_credits_per_call: 25,
      toolsets: ['account', 'clips', 'library'],
    });
  });

  it('omits the buy link in the directory profile', async () => {
    const { result } = await getAccount({
      apiKey: undefined,
      config: { profile: 'directory', directory: true },
    });
    expect(structuredOf(result)['links']).toMatchObject({ manage_keys: KEYS });
    expect(structuredOf(result)['links']).not.toHaveProperty('buy_credits');
  });
});

describe('get_options_guide', () => {
  const guide = async (args: Record<string, unknown>, options: HarnessOptions = {}) => {
    const harness = await start({ apiKey: undefined, ...options });
    const result = await harness.client.callTool({ name: 'get_options_guide', arguments: args });
    expect(harness.api.requests()).toHaveLength(0);
    return result;
  };

  it('returns every section and the pricing by default', async () => {
    const result = await guide({});
    const content = structuredOf(result);
    expect(content['topic']).toBe('all');
    expect(content['sections']).toMatchObject([
      ...OPTION_CATALOG.map((spec) => ({ option: spec.option })),
      { option: 'language' },
    ]);
    expect(content['pricing']).toMatchObject({
      examples: ['45 s → 1 credit', '10 min → 10 credits', '29 min 30 s → 30 credits'],
    });
    expect(textOf(result).length).toBeLessThanOrEqual(24_000);
  });

  it('returns one section for a topic, with defaults marked', async () => {
    const result = await guide({ topic: 'caption_style' });
    expect(result.structuredContent).toEqual({
      topic: 'caption_style',
      sections: [
        {
          option: 'caption_style',
          description: CAPTION_STYLE.description,
          values: CAPTION_STYLE.entries.map((entry) => ({
            value: entry.value,
            description: entry.description,
            is_default: entry.value === 'karaoke',
          })),
        },
      ],
    });
  });

  it('returns only pricing for the pricing topic, using the window cap', async () => {
    const result = await guide({ topic: 'pricing' }, { config: { maxWindowSec: 600 } });
    expect(structuredOf(result)['sections']).toEqual([]);
    expect(JSON.stringify(structuredOf(result)['pricing'])).toContain('at most 10 minutes;');
  });

  it('returns the language suggestions', async () => {
    const result = await guide({ topic: 'language' });
    expect(structuredOf(result)['sections']).toMatchObject([{ option: 'language' }]);
    expect(JSON.stringify(structuredOf(result)['sections'])).toContain(
      '{"value":"ru","description":"Russian","is_default":false}',
    );
  });

  it('notes that smart_cut works only with podcast in the video_mode section', async () => {
    const result = await guide({ topic: 'video_mode' });
    expect(JSON.stringify(result.structuredContent)).toContain('smart_cut');
  });

  it('rejects unknown topics through the schema', async () => {
    const result = await guide({ topic: 'watermark' });
    expect(result.isError).toBe(true);
  });

  it.each(['modern', 'legacy'] as const)('works over stdio and HTTP in the %s era', async (era) => {
    const viaHttp = await guide({ topic: 'framing' }, { era });
    const viaStdio = await guide({ topic: 'framing' }, { era, transport: 'stdio' });
    expect(viaHttp.structuredContent).toEqual(viaStdio.structuredContent);
  });
});
