import type { ToolsetDefinition } from '../../server/registry.js';
import { getAccount } from './get-account.js';
import { getOptionsGuide } from './get-options-guide.js';

export const accountToolset: ToolsetDefinition = { name: 'account', tools: [getAccount, getOptionsGuide] };
