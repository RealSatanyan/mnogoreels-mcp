import { createHash } from 'node:crypto';
import type { ServerCard } from '../../server/card.js';

const CARD_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
} as const;

const GLAMA_JSON = '{"$schema":"https://glama.ai/mcp/schemas/server.json","maintainers":["RealSatanyan"]}';

export type CardRoute = {
  readonly card: (request: Request) => Response;
  readonly glama: () => Response;
  readonly preflight: () => Response;
};

const etagMatches = (request: Request, etag: string): boolean =>
  (request.headers.get('if-none-match') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .includes(etag);

export const createCardRoute = (card: ServerCard): CardRoute => {
  const body = JSON.stringify(card);
  const etag = `"sha256-${createHash('sha256').update(body).digest('base64url')}"`;
  const headers = {
    ...CARD_CORS,
    'Content-Type': 'application/mcp-server-card+json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ETag: etag,
  };
  return {
    card: (request) =>
      etagMatches(request, etag) ? new Response(null, { status: 304, headers }) : new Response(body, { headers }),
    glama: () =>
      new Response(GLAMA_JSON, {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }),
    preflight: () => new Response(null, { status: 204, headers: CARD_CORS }),
  };
};
