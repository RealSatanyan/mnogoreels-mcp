import { createMcpHandler } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  parseConfigHeaders,
  profileForPath,
  resolveEffectiveConfig,
  type EffectiveConfig,
  type ProcessConfig,
} from '../../config.js';
import { ipBucketKey, ipLogPrefix, type RateRule } from '../../policy/rate-limit.js';
import type { Deps } from '../../runtime/deps.js';
import { buildServerCard } from '../../server/card.js';
import { createMcpServer } from '../../server/create-server.js';
import type { RegistrableTool } from '../../server/registry.js';
import { selectTools } from '../../server/toolsets.js';
import { VERSION } from '../../version.js';
import { extractApiKey } from './auth.js';
import { createCardRoute } from './card-route.js';
import {
  MAX_BODY_BYTES,
  declaredBodyGuard,
  hostGuard,
  jsonResponse,
  mcpCorsHeaders,
  originGuard,
  preflightResponse,
  querySecretGuard,
  withHeaders,
} from './guards.js';

export type HttpApp = {
  readonly fetch: (request: Request, options?: { readonly clientIp?: string }) => Promise<Response>;
  readonly close: () => Promise<void>;
};

type ResolvedRequest = {
  readonly config: EffectiveConfig;
  readonly apiKey: string | undefined;
  readonly clientIp: string | undefined;
};

const README_URL = 'https://github.com/RealSatanyan/mnogoreels-mcp#readme';
const CARD_PATHS = new Set(['/.well-known/mcp/server-card.json', '/mcp/server-card']);
const GLAMA_PATH = '/.well-known/glama.json';
const HEALTH_PATH = '/healthz';
const DEFAULT_PATH = '/mcp';
const CLIENT_IP_HEADER = 'x-mnogoreels-client-ip';
const ANONYMOUS_RULE: RateRule = { limit: 120, windowSec: 60 };
const KEYED_RULE: RateRule = { limit: 2_000, windowSec: 60 };
const KEYS_PAGE = 'https://mnogo-reels.ru/dashboard/developers?tab=keys';
const KEY_REQUIRED = `MnogoReels API key required. Send 'Authorization: Bearer <key>' or 'X-API-Key: <key>'. Create a key at ${KEYS_PAGE}`;
const KEY_BAD_FORMAT = 'The API key format is invalid (it must start with mrfrt_usr_)';
const CHALLENGE = 'Bearer realm="mnogoreels", error="invalid_token", error_description="MnogoReels API key required"';
const MAX_LOGGED_METHOD = 64;

const ToolCallSchema = z.object({
  id: z.union([z.string(), z.number()]),
  method: z.literal('tools/call'),
  params: z.object({ name: z.string() }),
});

const toolCallOf = (text: string): z.output<typeof ToolCallSchema> | undefined => {
  try {
    return ToolCallSchema.safeParse(JSON.parse(text)).data;
  } catch {
    return undefined;
  }
};

const resolveRequest = (processConfig: ProcessConfig, request: Request): ResolvedRequest => {
  const parsed = parseConfigHeaders(request.headers);
  const extraction = extractApiKey(request.headers);
  return {
    config: resolveEffectiveConfig({
      process: processConfig,
      path: new URL(request.url).pathname,
      ...(parsed.ok ? { headers: parsed.value } : {}),
    }),
    apiKey: extraction.kind === 'key' ? extraction.key : undefined,
    clientIp: request.headers.get(CLIENT_IP_HEADER) ?? undefined,
  };
};

const withClientIp = (request: Request, clientIp: string | undefined): Request => {
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  if (clientIp !== undefined) headers.set(CLIENT_IP_HEADER, clientIp);
  return new Request(request, { headers });
};

const headerGuard = (request: Request): Response | undefined => {
  const parsed = parseConfigHeaders(request.headers);
  return parsed.ok ? undefined : jsonResponse({ error: 'invalid_header', ...parsed.error }, 400);
};

export const createHttpApp = (options: {
  readonly processConfig: ProcessConfig;
  readonly deps: Deps;
  readonly tools?: readonly RegistrableTool[];
}): HttpApp => {
  const { processConfig, deps } = options;
  const toolOverride = options.tools ? { tools: options.tools } : {};
  const { allowedHosts, allowedOrigins } = processConfig.http;
  const cards = createCardRoute(
    buildServerCard({
      config: resolveEffectiveConfig({ process: processConfig, path: DEFAULT_PATH }),
      publicUrl: processConfig.http.publicUrl,
    }),
  );
  const handler = createMcpHandler(
    ({ requestInfo }) =>
      createMcpServer({
        ...resolveRequest(processConfig, requestInfo ?? new Request(`http://localhost${DEFAULT_PATH}`)),
        deps,
        ...toolOverride,
      }),
    {
      legacy: 'stateless',
      responseMode: 'auto',
      maxRequestBodySize: MAX_BODY_BYTES,
      onerror: (error) => {
        deps.logger.errorOf('mcp_handler_error', error);
      },
    },
  );

  const rateLimitGuard = (request: Request, clientIp: string | undefined): Response | undefined => {
    const keyed = extractApiKey(request.headers).kind === 'key';
    const bucket = `http:${ipBucketKey(clientIp ?? 'unknown')}:${keyed ? 'key' : 'anonymous'}`;
    const decision = deps.limiter.hit(bucket, keyed ? KEYED_RULE : ANONYMOUS_RULE);
    if (decision.allowed) return undefined;
    return jsonResponse(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: `Too many requests from this IP; retry in ${String(decision.retryAfterSec)} s.`,
        },
      },
      429,
      { 'Retry-After': String(decision.retryAfterSec) },
    );
  };

  const authGuard = async (request: Request): Promise<Response | undefined> => {
    const text = await request.clone().text();
    const call = toolCallOf(text);
    if (call === undefined) return undefined;
    const { config } = resolveRequest(processConfig, request);
    const tool = selectTools(config, options.tools).find((candidate) => candidate.name === call.params.name);
    const extraction = extractApiKey(request.headers);
    if (tool?.requiresApiKey !== true || extraction.kind === 'key') return undefined;
    return jsonResponse(
      {
        jsonrpc: '2.0',
        id: call.id,
        error: { code: -32001, message: extraction.kind === 'none' ? KEY_REQUIRED : KEY_BAD_FORMAT },
      },
      401,
      { 'WWW-Authenticate': CHALLENGE },
    );
  };

  const serveMcp = async (request: Request, clientIp: string | undefined): Promise<Response> => {
    const rejection =
      originGuard(request, allowedOrigins) ??
      declaredBodyGuard(request) ??
      rateLimitGuard(request, clientIp) ??
      headerGuard(request);
    if (rejection) return rejection;
    const forwarded = withClientIp(request, clientIp);
    return (await authGuard(forwarded)) ?? handler.fetch(forwarded);
  };

  const route = async (request: Request, clientIp: string | undefined): Promise<Response> => {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === HEALTH_PATH) return jsonResponse({ status: 'ok', version: VERSION }, 200);
    if (pathname === '/') return Response.redirect(README_URL, 302);
    const isCard = CARD_PATHS.has(pathname);
    const isMcp = profileForPath(pathname) !== undefined;
    if (request.method === 'OPTIONS') return isCard ? cards.preflight() : preflightResponse(request, allowedOrigins);
    if (!isCard && !isMcp && pathname !== GLAMA_PATH) return jsonResponse({ error: 'not_found' }, 404);
    const early = hostGuard(request, allowedHosts) ?? querySecretGuard(url);
    if (early) return early;
    if (isCard) return cards.card(request);
    if (!isMcp) return cards.glama();
    const response = await serveMcp(request, clientIp);
    return withHeaders(response, { ...mcpCorsHeaders(request, allowedOrigins), 'Cache-Control': 'no-store' });
  };

  const fetch = async (request: Request, fetchOptions: { readonly clientIp?: string } = {}): Promise<Response> => {
    const startedAt = deps.clock.now();
    const response = await route(request, fetchOptions.clientIp);
    const path = new URL(request.url).pathname;
    if (path === HEALTH_PATH && response.ok) return response;
    deps.logger.info('http_request', {
      method: request.method,
      path,
      status: response.status,
      ms: deps.clock.now() - startedAt,
      ip: fetchOptions.clientIp === undefined ? undefined : ipLogPrefix(fetchOptions.clientIp),
      mcp_method: request.headers.get('mcp-method')?.slice(0, MAX_LOGGED_METHOD),
    });
    return response;
  };

  return { fetch, close: () => handler.close() };
};
