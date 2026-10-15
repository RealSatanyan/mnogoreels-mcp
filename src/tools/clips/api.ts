import type { Http, RequestControl } from '../../api/http.js';
import { JobListSchema, JobResponseSchema, ManifestSchema, type JobResponse, type ManifestClip } from './schemas.js';

const READ_TIMEOUT_MS = 20_000;

export const jobPath = (jobId: string): string => `/videos/${encodeURIComponent(jobId)}`;

export const getJob = (http: Http, jobId: string, control: RequestControl): Promise<JobResponse> =>
  http.request(
    {
      method: 'GET',
      path: jobPath(jobId),
      schema: JobResponseSchema,
      auth: 'api_key',
      timeoutMs: READ_TIMEOUT_MS,
      retry: 'safe',
      resource: 'clip job',
    },
    control,
  );

export const listJobs = async (
  http: Http,
  page: { readonly limit: number; readonly offset: number; readonly callerType: 'user' | undefined },
  control: RequestControl,
): Promise<readonly JobResponse[]> => {
  const list = await http.request(
    {
      method: 'GET',
      path: '/videos',
      query: { limit: page.limit, offset: page.offset, caller_type: page.callerType },
      schema: JobListSchema,
      auth: 'api_key',
      timeoutMs: READ_TIMEOUT_MS,
      retry: 'safe',
      resource: 'clip job',
    },
    control,
  );
  return list.items;
};

export const getManifestClips = async (
  http: Http,
  jobId: string,
  control: RequestControl,
): Promise<readonly ManifestClip[]> => {
  const manifest = await http.request(
    {
      method: 'GET',
      path: `${jobPath(jobId)}/model-json`,
      schema: ManifestSchema,
      auth: 'api_key',
      timeoutMs: 30_000,
      maxBytes: 8 * 1024 * 1024,
      retry: 'safe',
      resource: 'clip job',
    },
    control,
  );
  return manifest.clips ?? [];
};

const UNBOUND: RequestControl = { signal: undefined, deadline: undefined };

const submitJson = (
  http: Http,
  request: { readonly path: string; readonly body?: unknown; readonly timeoutMs: number; readonly resource: string },
): Promise<JobResponse> =>
  http.request(
    {
      method: 'POST',
      path: request.path,
      ...(request.body === undefined ? {} : { body: { kind: 'json', value: request.body } }),
      schema: JobResponseSchema,
      auth: 'api_key',
      timeoutMs: request.timeoutMs,
      retry: 'never',
      resource: request.resource,
    },
    UNBOUND,
  );

export const submitClipJob = (http: Http, body: unknown): Promise<JobResponse> =>
  submitJson(http, { path: '/videos', body, timeoutMs: 30_000, resource: 'clip job' });

export const submitRecut = (http: Http, jobId: string, body: unknown): Promise<JobResponse> =>
  submitJson(http, { path: `${jobPath(jobId)}/recut`, body, timeoutMs: 30_000, resource: 'recut' });

export const reloadJob = (http: Http, jobId: string): Promise<JobResponse> =>
  submitJson(http, { path: `/tasks/${encodeURIComponent(jobId)}/reload`, timeoutMs: 20_000, resource: 'retry' });
