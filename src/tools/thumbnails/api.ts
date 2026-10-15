import type { z } from 'zod';
import type { ToolContext } from '../../server/registry.js';
import { ThumbnailJobSchema } from './schemas.js';

export type ThumbnailJob = z.output<typeof ThumbnailJobSchema>;

export type ThumbnailRequest = {
  readonly url: string;
  readonly language: string;
  readonly title: string | undefined;
  readonly prompt: string | undefined;
  readonly style: string;
  readonly variants: number;
};

const RESOURCE = 'thumbnail job';

export const createThumbnailJob = (ctx: ToolContext, request: ThumbnailRequest): Promise<ThumbnailJob> =>
  ctx.http.request(
    {
      method: 'POST',
      path: '/youtube-thumbnails',
      body: {
        kind: 'form',
        fields: {
          url: request.url,
          title: request.title,
          prompt: request.prompt,
          language: request.language,
          style: request.style,
          variants: String(request.variants),
        },
      },
      schema: ThumbnailJobSchema,
      auth: 'api_key',
      timeoutMs: 30_000,
      retry: 'never',
      resource: RESOURCE,
    },
    { signal: undefined, deadline: undefined },
  );

export const getThumbnailJob = (ctx: ToolContext, id: string, signal: AbortSignal): Promise<ThumbnailJob> =>
  ctx.http.request(
    {
      method: 'GET',
      path: `/youtube-thumbnails/${encodeURIComponent(id)}`,
      schema: ThumbnailJobSchema,
      auth: 'api_key',
      timeoutMs: 20_000,
      retry: 'safe',
      resource: RESOURCE,
    },
    { signal, deadline: ctx.deadline },
  );
