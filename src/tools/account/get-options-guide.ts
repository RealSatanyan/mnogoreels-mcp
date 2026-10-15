import { z } from 'zod';
import { LANGUAGE, OPTION_CATALOG, pricingGuide } from '../../domain/options.js';
import { defineTool } from '../../server/registry.js';

const TOPICS = [
  'all',
  'video_mode',
  'clip_length',
  'caption_style',
  'hook_style',
  'story_arc_style',
  'outro',
  'framing',
  'language',
  'pricing',
] as const;

type GuideSection = {
  readonly option: string;
  readonly description: string;
  readonly values: readonly { readonly value: string; readonly description: string; readonly is_default: boolean }[];
};

const toSection = (spec: {
  readonly option: string;
  readonly description: string;
  readonly entries: readonly { readonly value: string; readonly description: string; readonly isDefault: boolean }[];
}): GuideSection => ({
  option: spec.option,
  description: spec.description,
  values: spec.entries.map((entry) => ({
    value: entry.value,
    description: entry.description,
    is_default: entry.isDefault,
  })),
});

const ALL_SECTIONS: readonly GuideSection[] = [...OPTION_CATALOG.map(toSection), toSection(LANGUAGE)];

const GuideOutput = z.object({
  topic: z.string(),
  sections: z.array(
    z.object({
      option: z.string(),
      description: z.string(),
      values: z.array(z.object({ value: z.string(), description: z.string(), is_default: z.boolean() })),
    }),
  ),
  pricing: z.object({ rule: z.string(), examples: z.array(z.string()), free: z.array(z.string()) }).optional(),
});

export const getOptionsGuide = defineTool({
  name: 'get_options_guide',
  toolset: 'account',
  title: 'Explain clip options',
  description: [
    'Explains the option values accepted by create_clip_job and recut_clip_job: video modes, clip lengths, caption styles, hook styles, story arc styles, outros, framing and languages, plus the pricing rules and the 30-minute limit per job. Read-only and free; works without an API key and makes no network calls.',
    'Use it when the user asks what a style looks like, which mode fits their video, or how much processing costs. topic selects one section; all returns everything.',
  ].join('\n\n'),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: z.object({ topic: z.enum(TOPICS).default('all').describe('Which section to return.') }),
  outputSchema: GuideOutput,
  requiresApiKey: false,
  handler: ({ topic }, ctx) =>
    Promise.resolve({
      topic,
      sections: ALL_SECTIONS.filter((section) => topic === 'all' || section.option === topic),
      ...(topic === 'all' || topic === 'pricing' ? { pricing: pricingGuide(ctx.config.maxWindowSec) } : {}),
    }),
});
