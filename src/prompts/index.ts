import { completable, type McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { EffectiveConfig } from '../config.js';
import { CAPTION_STYLE, CLIP_LENGTH, LANGUAGE } from '../domain/options.js';
import { completeJobId } from '../resources/job-templates.js';
import type { Deps } from '../runtime/deps.js';
import { selectTools } from '../server/toolsets.js';
import { PROMPTS, type Completion, type PromptArgument, type PromptDefinition } from './catalog.js';

export type PromptRegistration = {
  readonly server: McpServer;
  readonly config: EffectiveConfig;
  readonly apiKey: string | undefined;
  readonly clientIp: string | undefined;
  readonly deps: Deps;
};

type Completer = (value: string) => string[] | Promise<string[]>;

const startingWith =
  (values: readonly string[]): Completer =>
  (prefix) =>
    values.filter((value) => value.startsWith(prefix));

const completers = (options: PromptRegistration): Readonly<Record<Completion, Completer>> => ({
  language: startingWith(LANGUAGE.codes),
  caption_style: startingWith(CAPTION_STYLE.values),
  clip_length: startingWith(CLIP_LENGTH.values),
  format: startingWith(['text', 'srt']),
  clip_job_id: completeJobId(options),
});

const enabledPrompts = (config: EffectiveConfig): readonly PromptDefinition[] => {
  const enabled = new Set(selectTools(config).map((tool) => tool.name));
  return PROMPTS.filter((prompt) => prompt.tools.every((tool) => enabled.has(tool)));
};

const argumentSchema = (argument: PromptArgument, complete: Readonly<Record<Completion, Completer>>) => {
  const base = z.string().describe(argument.description);
  const field = argument.completion ? completable(base, complete[argument.completion]) : base;
  return argument.required ? field : field.optional();
};

const filled = (args: Readonly<Record<string, unknown>>) => (name: string) => {
  const value = args[name];
  return typeof value === 'string' ? value.trim() : '';
};

export const registerPrompts = (options: PromptRegistration): void => {
  const complete = completers(options);
  enabledPrompts(options.config).forEach((prompt) => {
    options.server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: z.object(
          Object.fromEntries(prompt.arguments.map((argument) => [argument.name, argumentSchema(argument, complete)])),
        ),
      },
      (args) => ({
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: prompt.text(filled(args), { maxWindowSec: options.config.maxWindowSec }) },
          },
        ],
      }),
    );
  });
};

export const describePrompts = (config: EffectiveConfig): readonly Readonly<Record<string, unknown>>[] =>
  enabledPrompts(config).map((prompt) => ({
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    arguments: prompt.arguments.map(({ name, description, required }) => ({ name, description, required })),
  }));
