import { z } from 'zod';
import { ApiError, MESSAGES, mapApiFailure } from '../../api/errors.js';
import type { ToolsetName } from '../../config.js';
import { VERSION } from '../../version.js';
import { defineTool, type ToolContext } from '../../server/registry.js';

const TOOLSET_ORDER: readonly ToolsetName[] = ['account', 'clips', 'transcripts', 'articles', 'library', 'thumbnails'];
const KEYS_PAGE = 'https://mnogo-reels.ru/dashboard/developers?tab=keys';
const KEY_REJECTIONS = new Set(['invalid_api_key', 'api_key_without_user']);

const GetAccountOutput = z.object({
  authenticated: z.boolean().describe('True when MnogoReels accepted the API key.'),
  key_configured: z.boolean(),
  api_key_hint: z.string().nullable().describe('Masked key, e.g. mrfrt_usr_…a1b2; null when no key is configured.'),
  api_url: z.string(),
  server_version: z.string(),
  transport: z.enum(['stdio', 'http']),
  profile: z.enum(['default', 'readonly', 'directory']),
  toolsets: z.array(z.string()),
  read_only: z.boolean(),
  max_credits_per_call: z.number().int().nullable(),
  credit_balance: z.null().describe('Not available through the API.'),
  message: z.string().describe('What to do next, e.g. how to create a key.'),
  links: z.object({
    manage_keys: z.string(),
    credits_help: z.string(),
    buy_credits: z.string().optional(),
    docs: z.string(),
  }),
});

const checkKey = async (ctx: ToolContext): Promise<{ readonly authenticated: boolean; readonly message: string }> => {
  if (ctx.apiKeyStatus === 'missing') return { authenticated: false, message: MESSAGES.missing_api_key };
  if (ctx.apiKeyStatus === 'invalid_format') return { authenticated: false, message: MESSAGES.invalid_api_key_format };
  try {
    await ctx.http.request(
      {
        method: 'GET',
        path: '/videos',
        query: { limit: 1 },
        schema: z.object({}),
        auth: 'api_key',
        timeoutMs: 20_000,
        retry: 'safe',
      },
      { signal: ctx.signal, deadline: ctx.deadline },
    );
    return { authenticated: true, message: 'The API key works.' };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const mapped = mapApiFailure(error.failure, { ...error.context, apiUrl: ctx.config.apiUrl });
    if (!KEY_REJECTIONS.has(mapped.code)) throw error;
    return { authenticated: false, message: mapped.message };
  }
};

export const getAccount = defineTool({
  name: 'get_account',
  toolset: 'account',
  title: 'Check API key and settings',
  description: [
    "Checks whether the configured MnogoReels API key works and shows this server's settings. Read-only and free; works without a key.",
    'Use it first when other tools fail with an authentication error, or when the user asks which account or mode is active. It does not change anything.',
    'Returns authenticated (true or false), a masked key hint (last 4 characters only), the API URL, the server version and transport, the active profile, enabled toolsets, whether read-only mode is on, the per-call credit cap if one is set, and links for managing keys and credits. The credit balance itself is not available through the API; the user can see it on mnogo-reels.ru.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: z.object({}).strict(),
  outputSchema: GetAccountOutput,
  requiresApiKey: false,
  handler: async (_args, ctx) => {
    const { authenticated, message } = await checkKey(ctx);
    const { config } = ctx;
    return {
      authenticated,
      key_configured: ctx.hasApiKey,
      api_key_hint: ctx.apiKeyHint,
      api_url: config.apiUrl,
      server_version: VERSION,
      transport: config.transport,
      profile: config.profile,
      toolsets: TOOLSET_ORDER.filter((name) => config.toolsets.has(name)),
      read_only: config.readOnly,
      max_credits_per_call: config.maxCreditsPerCall ?? null,
      credit_balance: null,
      message,
      links: {
        manage_keys: KEYS_PAGE,
        credits_help: 'https://mnogo-reels.ru/docs/credits',
        ...(config.directory ? {} : { buy_credits: 'https://mnogo-reels.ru' }),
        docs: 'https://github.com/RealSatanyan/mnogoreels-mcp#readme',
      },
    };
  },
});
