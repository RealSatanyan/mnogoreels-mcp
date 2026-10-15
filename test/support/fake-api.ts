export type FakeRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly authorized: boolean;
  readonly body: unknown;
  readonly signal: AbortSignal | null;
};

export type FakeResponse =
  | {
      readonly status?: number;
      readonly json?: unknown;
      readonly text?: string;
      readonly headers?: Readonly<Record<string, string>>;
    }
  | 'network-error';

export type FakeRoute = {
  readonly method: 'GET' | 'POST';
  readonly path: string | RegExp;
  readonly respond: (request: FakeRequest) => FakeResponse | Promise<FakeResponse>;
};

export type FakeApi = {
  readonly fetch: typeof globalThis.fetch;
  readonly baseUrl: string;
  readonly requests: () => readonly FakeRequest[];
  readonly requestsTo: (method: string, path: string | RegExp) => readonly FakeRequest[];
  readonly unmatched: () => readonly string[];
  readonly assertAllMatched: () => void;
};

export const FAKE_API_URL = 'https://api.test.local';

const pathMatches = (pattern: string | RegExp, path: string): boolean =>
  typeof pattern === 'string' ? pattern === path : pattern.test(path);

const MULTIPART_FIELD_RE = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g;

const parseMultipart = (text: string): Record<string, string> =>
  Object.fromEntries([...text.matchAll(MULTIPART_FIELD_RE)].map((match) => [match[1] ?? '', match[2] ?? '']));

const parseBody = async (request: Request): Promise<unknown> => {
  const type = request.headers.get('content-type') ?? '';
  if (request.method === 'GET') return undefined;
  if (type.includes('application/json')) return request.json();
  if (type.includes('multipart/form-data')) return parseMultipart(await request.text());
  const text = await request.text();
  return text === '' ? undefined : text;
};

const toResponse = (response: Exclude<FakeResponse, 'network-error'>): Response => {
  const status = response.status ?? 200;
  const body = response.json !== undefined ? JSON.stringify(response.json) : (response.text ?? null);
  const headers = new Headers(response.headers);
  if (response.json !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Response(status === 204 || status === 304 ? null : body, { status, headers });
};

export const createFakeApi = (routes: readonly FakeRoute[], options: { readonly baseUrl?: string } = {}): FakeApi => {
  const baseUrl = options.baseUrl ?? FAKE_API_URL;
  const recorded: FakeRequest[] = [];
  const unmatched: string[] = [];

  const fakeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const headers = Object.fromEntries([...request.headers.entries()].filter(([name]) => name !== 'authorization'));
    const entry: FakeRequest = {
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers,
      authorized: request.headers.has('authorization'),
      body: await parseBody(request),
      signal: init?.signal ?? null,
    };
    recorded.push(entry);
    const route =
      url.origin === new URL(baseUrl).origin
        ? routes.find((candidate) => candidate.method === request.method && pathMatches(candidate.path, url.pathname))
        : undefined;
    if (!route) {
      unmatched.push(`${request.method} ${url.origin}${url.pathname}`);
      return toResponse({ status: 599, json: { detail: `FakeApi: no route for ${request.method} ${url.pathname}` } });
    }
    const response = await route.respond(entry);
    if (response === 'network-error') throw new TypeError('fetch failed');
    return toResponse(response);
  };

  return {
    fetch: fakeFetch,
    baseUrl,
    requests: () => [...recorded],
    requestsTo: (method, path) =>
      recorded.filter((request) => request.method === method && pathMatches(path, request.path)),
    unmatched: () => [...unmatched],
    assertAllMatched: () => {
      if (unmatched.length > 0) throw new Error(`FakeApi received unexpected requests:\n${unmatched.join('\n')}`);
    },
  };
};

export const ok = (json: unknown, headers?: Readonly<Record<string, string>>): FakeResponse => ({
  status: 200,
  json,
  ...(headers ? { headers } : {}),
});

export const status = (code: number, detail?: unknown, headers?: Readonly<Record<string, string>>): FakeResponse => ({
  status: code,
  ...(detail === undefined ? {} : { json: { detail } }),
  ...(headers ? { headers } : {}),
});

export const html = (code: number, text = '<html><body>error</body></html>'): FakeResponse => ({
  status: code,
  text,
  headers: { 'content-type': 'text/html' },
});
