import { z } from 'zod';
import { ApiError, MESSAGES, fail } from '../../api/errors.js';
import type { Http, RequestControl } from '../../api/http.js';
import type { ToolContext } from '../../server/registry.js';
import { getJob } from './api.js';
import type { JobResponse } from './schemas.js';

const AnyObject = z.object({});

const exists = async (http: Http, path: string, control: RequestControl): Promise<boolean> => {
  try {
    await http.request(
      {
        method: 'GET',
        path,
        schema: AnyObject,
        auth: 'api_key',
        timeoutMs: 20_000,
        retry: 'safe',
        resource: 'clip job',
      },
      control,
    );
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.failure.kind === 'http' && error.failure.status === 404) return false;
    throw error;
  }
};

export const assertClipJob = async (options: {
  readonly http: Http;
  readonly id: string;
  readonly control: RequestControl;
}): Promise<void> => {
  const id = encodeURIComponent(options.id);
  const [transcription, republication] = await Promise.all([
    exists(options.http, `/transcriptions/${id}`, options.control),
    exists(options.http, `/republications/${id}`, options.control),
  ]);
  if (transcription) fail('invalid_arguments', 'This is a transcription id; use get_transcription.');
  if (republication) {
    fail('invalid_arguments', 'This is a republication job, not a clip job; it cannot be retried or recut here.');
  }
};

export const requireApiKey = (ctx: Pick<ToolContext, 'apiKeyStatus'>): void => {
  if (ctx.apiKeyStatus === 'missing') fail('missing_api_key', MESSAGES.missing_api_key);
  if (ctx.apiKeyStatus === 'invalid_format') fail('invalid_api_key_format', MESSAGES.invalid_api_key_format);
};

export const loadClipJob = async (options: {
  readonly http: Http;
  readonly id: string;
  readonly control: RequestControl;
}): Promise<JobResponse> => {
  const [, job] = await Promise.all([assertClipJob(options), getJob(options.http, options.id, options.control)]);
  return job;
};
