import type { z } from 'zod';
import type { RequestSpec } from '../../api/http.js';
import type { ToolContext } from '../../server/registry.js';
import type { Catalog } from './broll-shape.js';
import { BrollCardSchema, BrollListSchema, PackListSchema, PackSchema } from './schemas.js';

const read = <S extends z.ZodType>(
  ctx: ToolContext,
  spec: Pick<RequestSpec<S>, 'path' | 'query' | 'schema' | 'resource'>,
): Promise<z.output<S>> =>
  ctx.http.request(
    { method: 'GET', auth: 'api_key', timeoutMs: 20_000, retry: 'safe', ...spec },
    { signal: ctx.signal, deadline: ctx.deadline },
  );

const brollBase = (catalog: Catalog): string => (catalog === 'mine' ? '/broll/assets' : '/broll/shared/assets');

export const fetchBrollPage = (
  ctx: ToolContext,
  options: {
    readonly catalog: Catalog;
    readonly query?: string | undefined;
    readonly kind?: string | undefined;
    readonly cursor?: string | undefined;
    readonly limit: number;
  },
) =>
  read(ctx, {
    path: brollBase(options.catalog),
    query: { q: options.query, kind: options.kind, cursor: options.cursor, limit: options.limit },
    schema: BrollListSchema,
    resource: 'B-roll page',
  });

export const fetchBrollAsset = (ctx: ToolContext, options: { readonly catalog: Catalog; readonly assetId: string }) =>
  read(ctx, {
    path: `${brollBase(options.catalog)}/${encodeURIComponent(options.assetId)}`,
    schema: BrollCardSchema,
    resource: 'B-roll asset',
  });

export const fetchPacks = (ctx: ToolContext, options: { readonly limit: number; readonly offset: number }) =>
  read(ctx, { path: '/packs', query: options, schema: PackListSchema, resource: 'pack' });

export const fetchPack = (
  ctx: ToolContext,
  options: { readonly packId: string; readonly includeTranscript: boolean },
) =>
  read(ctx, {
    path: `/packs/${encodeURIComponent(options.packId)}`,
    query: { include_transcript: options.includeTranscript },
    schema: PackSchema,
    resource: 'pack',
  });
