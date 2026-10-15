import { ApiError } from '../../api/errors.js';
import type { Http, RequestControl } from '../../api/http.js';
import { ArticleJobSchema, type ArticleJob } from './schemas.js';

const isNotFound = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.failure.kind === 'http' && error.failure.status === 404;

export const submitArticle = async (options: {
  readonly http: Http;
  readonly clipJobId: string;
}): Promise<ArticleJob> => {
  try {
    return await options.http.request(
      {
        method: 'POST',
        path: `/videos/${encodeURIComponent(options.clipJobId)}/article`,
        schema: ArticleJobSchema,
        auth: 'api_key',
        timeoutMs: 20_000,
        retry: 'never',
        resource: 'article',
      },
      { signal: undefined, deadline: undefined },
    );
  } catch (error) {
    if (isNotFound(error)) throw new ApiError(error.failure, { operation: 'submit', resource: 'clip job' });
    throw error;
  }
};

export const fetchArticle = (options: {
  readonly http: Http;
  readonly id: string;
  readonly control: RequestControl;
}): Promise<ArticleJob> =>
  options.http.request(
    {
      method: 'GET',
      path: `/articles/${encodeURIComponent(options.id)}`,
      schema: ArticleJobSchema,
      auth: 'api_key',
      timeoutMs: 20_000,
      retry: 'safe',
      resource: 'article',
    },
    options.control,
  );
