import { CLIENT_CAPABILITIES_META_KEY, type McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

const CapsSchema = z
  .object({
    elicitation: z
      .object({ form: z.object({}).loose().nullish(), url: z.object({}).loose().nullish() })
      .loose()
      .nullish(),
  })
  .loose();

const EnvelopeSchema = z.object({ [CLIENT_CAPABILITIES_META_KEY]: CapsSchema.nullish() }).loose();

export const supportsFormElicitation = (input: {
  readonly envelope: unknown;
  readonly legacyCapabilities: unknown;
}): boolean => {
  const capabilities =
    EnvelopeSchema.safeParse(input.envelope).data?.[CLIENT_CAPABILITIES_META_KEY] ??
    CapsSchema.safeParse(input.legacyCapabilities).data;
  const elicitation = capabilities?.elicitation;
  if (!elicitation) return false;
  return Boolean(elicitation.form) || !elicitation.url;
};

export const legacyClientCapabilities = (server: McpServer): unknown =>
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- 2025-era sessions expose client capabilities only via initialize
  server.server.getClientCapabilities();
