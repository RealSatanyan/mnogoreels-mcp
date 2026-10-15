import {
  hostHeaderValidationResponse,
  originValidationResponse,
  validateOriginHeader,
} from '@modelcontextprotocol/server';

export const MAX_BODY_BYTES = 1_048_576;

const SECRET_RE = /mrfrt_(usr|svc)_/i;
const SECRET_PARAMS = new Set([
  'api_key',
  'apikey',
  'key',
  'token',
  'access_token',
  'authorization',
  'x-api-key',
  'mnogoreels_api_key',
]);

const MCP_CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, X-API-Key, Content-Type, Accept, Last-Event-ID, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, X-MnogoReels-Toolsets, X-MnogoReels-Read-Only, X-MnogoReels-Max-Credits-Per-Call',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Retry-After, Mcp-Session-Id, ETag',
  'Access-Control-Max-Age': '86400',
} as const;

export type AllowedOrigins = readonly string[] | '*';

export const jsonResponse = (body: unknown, status: number, headers: Readonly<Record<string, string>> = {}): Response =>
  Response.json(body, { status, headers });

export const hostGuard = (request: Request, allowedHosts: readonly string[]): Response | undefined =>
  hostHeaderValidationResponse(request, [...allowedHosts]);

export const originGuard = (request: Request, allowedOrigins: AllowedOrigins): Response | undefined =>
  allowedOrigins === '*' ? undefined : originValidationResponse(request, [...allowedOrigins]);

const safeDecode = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

const hasSecret = (url: URL): boolean => {
  const raw = url.search;
  if (SECRET_RE.test(raw) || SECRET_RE.test(safeDecode(raw))) return true;
  if ([...url.searchParams.keys()].some((name) => SECRET_PARAMS.has(name.toLowerCase()))) return true;
  return url.searchParams
    .getAll('config')
    .some((value) => SECRET_RE.test(Buffer.from(value, 'base64').toString('utf8')));
};

export const querySecretGuard = (url: URL): Response | undefined =>
  hasSecret(url)
    ? jsonResponse(
        {
          error: 'api_key_in_url',
          message: "Never put the API key in the URL. Send it as 'Authorization: Bearer <key>' or 'X-API-Key: <key>'.",
        },
        400,
      )
    : undefined;

const payloadTooLarge = (): Response =>
  jsonResponse({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Request body too large.' } }, 413);

export const declaredBodyGuard = (request: Request): Response | undefined =>
  Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES ? payloadTooLarge() : undefined;

const originHeaders = (request: Request, allowedOrigins: AllowedOrigins): Readonly<Record<string, string>> => {
  if (allowedOrigins === '*') return { 'Access-Control-Allow-Origin': '*' };
  const origin = request.headers.get('origin');
  if (origin === null || origin === '') return {};
  return validateOriginHeader(origin, [...allowedOrigins]).ok
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
};

export const mcpCorsHeaders = (request: Request, allowedOrigins: AllowedOrigins): Readonly<Record<string, string>> => ({
  ...MCP_CORS,
  ...originHeaders(request, allowedOrigins),
});

export const preflightResponse = (request: Request, allowedOrigins: AllowedOrigins): Response =>
  new Response(null, { status: 204, headers: mcpCorsHeaders(request, allowedOrigins) });

export const withHeaders = (response: Response, extra: Readonly<Record<string, string>>): Response => {
  const headers = new Headers(response.headers);
  Object.entries(extra).forEach(([name, value]) => {
    headers.set(name, value);
  });
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
