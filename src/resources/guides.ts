import type { EffectiveConfig } from '../config.js';
import { LANGUAGE, OPTION_CATALOG, PAID_JOB_NOTICE, pricingGuide } from '../domain/options.js';
import { buildInstructions } from '../server/metadata.js';

type GuideOption = {
  readonly option: string;
  readonly description: string;
  readonly entries: readonly { readonly value: string; readonly description: string; readonly isDefault: boolean }[];
};

export type Guide = {
  readonly name: string;
  readonly uri: string;
  readonly title: string;
  readonly description: string;
  readonly render: (config: EffectiveConfig) => string;
};

const optionTable = (option: GuideOption): string =>
  [
    `## ${option.option}`,
    '',
    option.description,
    '',
    '| Value | Description | Default |',
    '|---|---|---|',
    ...option.entries.map((entry) => `| \`${entry.value}\` | ${entry.description} | ${entry.isDefault ? 'yes' : ''} |`),
    '',
  ].join('\n');

const optionsGuide = (): string =>
  [
    '# Clip options guide',
    '',
    'Values accepted by create_clip_job and recut_clip_job (get_options_guide returns the same data as JSON).',
    '',
    ...[...OPTION_CATALOG, LANGUAGE].map(optionTable),
  ].join('\n');

const pricingText = (config: EffectiveConfig): string => {
  const pricing = pricingGuide(config.maxWindowSec);
  return [
    '# Pricing and credits',
    '',
    pricing.rule,
    '',
    'Examples:',
    ...pricing.examples.map((example) => `- ${example}`),
    '',
    `Free: ${pricing.free.join(', ')}.`,
    '',
    PAID_JOB_NOTICE,
    '',
  ].join('\n');
};

export const GUIDES: readonly Guide[] = [
  {
    name: 'guide-options',
    uri: 'mnogoreels://guide/options',
    title: 'Clip options guide',
    description:
      'Every clip option value (video modes, clip lengths, caption and hook styles, outros, framing, languages).',
    render: optionsGuide,
  },
  {
    name: 'guide-pricing',
    uri: 'mnogoreels://guide/pricing',
    title: 'Pricing and credits',
    description: 'How clip jobs are priced, the per-job length limit and what is free.',
    render: pricingText,
  },
  {
    name: 'guide-workflow',
    uri: 'mnogoreels://guide/workflow',
    title: 'How to use MnogoReels tools',
    description: 'The recommended order of tool calls for clips, transcripts and articles.',
    render: (config) => `# How to use MnogoReels tools\n\n${buildInstructions(config)}\n`,
  },
];
