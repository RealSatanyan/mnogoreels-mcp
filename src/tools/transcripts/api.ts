import type { Http, RequestControl } from '../../api/http.js';
import { TranscriptionSchema, type Transcription } from './schemas.js';

const RESOURCE = 'transcription';

export const submitTranscription = (options: {
  readonly http: Http;
  readonly url: string;
  readonly language: string | undefined;
}): Promise<Transcription> =>
  options.http.request(
    {
      method: 'POST',
      path: '/transcriptions',
      body: { kind: 'form', fields: { url: options.url, language: options.language } },
      schema: TranscriptionSchema,
      auth: 'api_key',
      timeoutMs: 30_000,
      retry: 'never',
      resource: RESOURCE,
    },
    { signal: undefined, deadline: undefined },
  );

export const fetchTranscription = (options: {
  readonly http: Http;
  readonly id: string;
  readonly control: RequestControl;
}): Promise<Transcription> =>
  options.http.request(
    {
      method: 'GET',
      path: `/transcriptions/${encodeURIComponent(options.id)}`,
      schema: TranscriptionSchema,
      auth: 'api_key',
      timeoutMs: 20_000,
      retry: 'safe',
      resource: RESOURCE,
    },
    options.control,
  );
