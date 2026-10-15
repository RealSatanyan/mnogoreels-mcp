import { z } from 'zod';
import { SourceUrl, UNTRUSTED_TEXT_NOTE } from '../../shaping/fragments.js';
import { defineTool } from '../../server/registry.js';
import { fenceShort, round1 } from './assemble.js';
import { PROBE_REASONS, PlatformOutput, parsedSource, probeSource } from './probe.js';

const TITLE_MAX = 300;

const CheckVideoSourceOutput = z.object({
  source_url: z.string(),
  platform: PlatformOutput,
  downloadable: z.boolean(),
  reason: z.enum(PROBE_REASONS).nullable(),
  duration_sec: z.number().nullable(),
  title: z.string().nullable().describe(`Video title from the platform. ${UNTRUSTED_TEXT_NOTE}.`),
  thumbnail_url: z.string().nullable(),
  cached: z.boolean().describe('True when this result came from a check you made in the last 10 minutes.'),
});

const reasonOf = (reason: string | null) => PROBE_REASONS.find((candidate) => candidate === reason) ?? null;

export const checkVideoSource = defineTool({
  name: 'check_video_source',
  toolset: 'clips',
  title: 'Check video source',
  description: [
    'Checks whether MnogoReels can download a video link and returns its title, length and platform. Free: spends no credits and creates no job.',
    'Use it to answer "is this link usable?" or "how long is this video?" without pricing anything (private, removed, region-locked, audio-only or very large sources fail). To price a job call quote_clip_job directly: it runs the same check. Do not use it for existing jobs; use get_clip_job instead.',
    'Supports YouTube, VK Video, RuTube, Dzen, Twitch, Yandex Disk and Google Drive file links, and direct links to .mp4, .mov, .mkv or .webm files. Local files are not supported: the user must upload the file somewhere public first.',
    'Returns downloadable (true or false), reason when not downloadable (audio_only, too_large, unavailable), duration_sec (null when the platform does not report it, which is typical for direct file links), title, thumbnail_url and platform. Usually takes 2 to 15 seconds, occasionally up to 45.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  inputSchema: z.object({ source_url: SourceUrl }),
  outputSchema: CheckVideoSourceOutput,
  requiresApiKey: false,
  rateLimit: { bucket: 'probe', limit: 30, windowSec: 60 },
  handler: async (args, ctx) => {
    const { href } = parsedSource(args.source_url);
    const { probe, cached } = await probeSource({
      http: ctx.http,
      href,
      tenant: ctx.keyHash,
      deps: ctx.deps,
      control: { signal: ctx.signal, deadline: ctx.deadline },
    });
    return {
      source_url: href,
      platform: probe.platform,
      downloadable: probe.downloadable,
      reason: reasonOf(probe.reason),
      duration_sec: round1(probe.durationSec),
      title: fenceShort(probe.title, TITLE_MAX),
      thumbnail_url: probe.thumbnailUrl,
      cached,
    };
  },
});
