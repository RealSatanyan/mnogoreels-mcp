import { z } from 'zod';
import { ApiError, fail, mapApiFailure } from '../../api/errors.js';
import type { Http, RequestControl } from '../../api/http.js';
import { safeHttpUrl } from '../../domain/media-urls.js';
import { detectPlatform, parseSourceUrl, type Platform, type SourceProbe } from '../../domain/source-url.js';
import type { Deps } from '../../runtime/deps.js';
import type { ToolContext } from '../../server/registry.js';
import { DownloadProbeSchema, DurationProbeSchema } from './schemas.js';

export const PROBE_REASONS = ['audio_only', 'too_large', 'unavailable'] as const;

export const PLATFORMS = [
  'youtube',
  'vk',
  'rutube',
  'dzen',
  'twitch',
  'yandex_disk',
  'google_drive',
  'direct_file',
  'other',
] as const satisfies readonly Platform[];

export const PlatformOutput = z.enum(PLATFORMS);

type ProbeReason = (typeof PROBE_REASONS)[number];

const UNAVAILABLE_DETAIL_RE =
  /Yandex Disk API error: Client error '4\d\d|did not return href|ffprobe failed|google drive metadata api returned 4\d\d|canDownload=false|did not return a downloadable URL|did not contain download URL|Could not parse Google Drive file id/i;

const DURATION_PROBES = {
  yandex_disk: { path: '/yandex-disk/probe', checkedWith: 'yandex_disk' },
  google_drive: { path: '/google-drive/probe', checkedWith: 'google_drive' },
} as const;

export const parsedSource = (raw: string): { readonly href: string; readonly host: string } => {
  const parsed = parseSourceUrl(raw);
  return parsed.kind === 'ok' ? parsed : fail('invalid_arguments', parsed.message);
};

const knownDuration = (value: number | null | undefined): number | null =>
  value !== null && value !== undefined && Number.isFinite(value) && value > 0 ? value : null;

const normalizedReason = (reason: string | null | undefined): ProbeReason => {
  const known = PROBE_REASONS.find((candidate) => candidate === reason);
  return known ?? 'unavailable';
};

const refusal = (platform: Platform, reason: ProbeReason, checkedWith: SourceProbe['checkedWith']): SourceProbe => ({
  platform,
  downloadable: false,
  reason,
  durationSec: null,
  title: null,
  thumbnailUrl: null,
  checkedWith,
});

const durationProbeRefusal = (error: unknown): ProbeReason | undefined => {
  if (!(error instanceof ApiError) || error.failure.kind !== 'http') return undefined;
  const { status, detail } = error.failure;
  if (status === 413) return 'too_large';
  if (status === 400 || status === 422) return 'unavailable';
  return status === 502 && UNAVAILABLE_DETAIL_RE.test(detail ?? '') ? 'unavailable' : undefined;
};

type ProbeCall = {
  readonly http: Http;
  readonly href: string;
  readonly platform: Platform;
  readonly control: RequestControl;
  readonly timeoutMs: number | undefined;
};

const probeDuration = async (
  call: ProbeCall,
  target: (typeof DURATION_PROBES)[keyof typeof DURATION_PROBES],
): Promise<SourceProbe> => {
  try {
    const result = await call.http.request(
      {
        method: 'POST',
        path: target.path,
        body: { kind: 'json', value: { url: call.href } },
        schema: DurationProbeSchema,
        auth: 'none',
        timeoutMs: call.timeoutMs ?? 35_000,
        retry: 'probe',
        forwardFor: true,
        resource: 'video source',
      },
      call.control,
    );
    return {
      platform: call.platform,
      downloadable: true,
      reason: null,
      durationSec: knownDuration(result.duration_sec),
      title: null,
      thumbnailUrl: null,
      checkedWith: target.checkedWith,
    };
  } catch (error) {
    const reason = durationProbeRefusal(error);
    if (reason === undefined) throw error;
    return refusal(call.platform, reason, target.checkedWith);
  }
};

const probeDownload = async (call: ProbeCall): Promise<SourceProbe> => {
  const result = await call.http.request(
    {
      method: 'POST',
      path: '/downloads/probe',
      body: { kind: 'json', value: { url: call.href } },
      schema: DownloadProbeSchema,
      auth: 'none',
      timeoutMs: call.timeoutMs ?? 45_000,
      retry: 'probe',
      forwardFor: true,
      resource: 'video source',
    },
    call.control,
  );
  if (!result.downloadable) return refusal(call.platform, normalizedReason(result.reason), 'downloads');
  return {
    platform: call.platform,
    downloadable: true,
    reason: null,
    durationSec: knownDuration(result.duration),
    title: result.title ?? null,
    thumbnailUrl: safeHttpUrl(result.thumbnail),
    checkedWith: 'downloads',
  };
};

const runProbe = (call: ProbeCall): Promise<SourceProbe> => {
  if (call.platform === 'yandex_disk' || call.platform === 'google_drive') {
    return probeDuration(call, DURATION_PROBES[call.platform]);
  }
  return probeDownload(call);
};

export const probeSource = async (options: {
  readonly http: Http;
  readonly href: string;
  readonly tenant: string;
  readonly deps: Pick<Deps, 'probeCache'>;
  readonly control: RequestControl;
  readonly timeoutMs?: number;
}): Promise<{ readonly probe: SourceProbe; readonly cached: boolean }> => {
  const key = `${options.tenant}|${options.href}`;
  const hit = options.deps.probeCache.get(key);
  if (hit) return { probe: hit, cached: true };
  const probe = await runProbe({
    http: options.http,
    href: options.href,
    platform: detectPlatform(options.href),
    control: options.control,
    timeoutMs: options.timeoutMs,
  });
  options.deps.probeCache.set(key, probe);
  return { probe, cached: false };
};

const isTolerable = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.failure.kind !== 'aborted' &&
  mapApiFailure(error.failure, { ...error.context, apiUrl: '' }).retryable;

export const probeForPricing = async (options: {
  readonly ctx: Pick<ToolContext, 'http' | 'keyHash' | 'deps' | 'signal' | 'deadline'>;
  readonly href: string;
  readonly windowComplete: boolean;
  readonly timeoutMs?: number;
}): Promise<SourceProbe | null> => {
  const { ctx } = options;
  try {
    const { probe } = await probeSource({
      http: ctx.http,
      href: options.href,
      tenant: ctx.keyHash,
      deps: ctx.deps,
      control: { signal: ctx.signal, deadline: ctx.deadline },
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
    if (!probe.downloadable) {
      return fail(
        'source_not_downloadable',
        `MnogoReels cannot download this source (${probe.reason ?? 'unavailable'}: audio_only = no video track, too_large = over 17 GB, unavailable = private, removed, region-locked or not a video). Nothing was charged.`,
        { reason: probe.reason },
      );
    }
    return probe;
  } catch (error) {
    if (options.windowComplete && isTolerable(error)) return null;
    throw error;
  }
};
