import type { ToolsetDefinition } from '../../server/registry.js';
import { createArticle } from './create-article.js';
import { getArticle } from './get-article.js';

export const articlesToolset: ToolsetDefinition = { name: 'articles', tools: [createArticle, getArticle] };
