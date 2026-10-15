import type { ToolsetDefinition } from '../../server/registry.js';
import { createTranscription } from './create-transcription.js';
import { getTranscription } from './get-transcription.js';

export const transcriptsToolset: ToolsetDefinition = {
  name: 'transcripts',
  tools: [createTranscription, getTranscription],
};
