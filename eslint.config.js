import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const TOOL_GROUPS = ['account', 'clips', 'transcripts', 'articles', 'library', 'thumbnails'];

const restrict = (patterns) => ({
  '@typescript-eslint/no-restricted-imports': ['error', { patterns }],
});

const banned = (regex, message, allowTypeImports = false) => ({ regex, message, allowTypeImports });

const SDK = banned('^@modelcontextprotocol/', 'This layer must not depend on the MCP SDK (spec 2.3).');
const API = (allowTypeImports) => banned('(^|/)api/', 'This layer must not import api/ (spec 2.3).', allowTypeImports);
const SERVER = banned('(^|/)server/', 'This layer must not import server/ (spec 2.3).');
const TOOLS = banned('(^|/)tools/', 'This layer must not import tools/ (spec 2.3).');
const TRANSPORTS = banned('(^|/)transports/', 'This layer must not import transports/ (spec 2.3).');
const RUNTIME_TYPES = banned(
  '(^|/)runtime/(?!ttl-cache(\\.js)?$)',
  'Only type imports from runtime/ (and the pure ttl-cache) are allowed here (spec 2.3).',
  true,
);

const otherGroups = (group) =>
  banned(
    `(^|/)(tools/|\\.\\./)(${TOOL_GROUPS.filter((name) => name !== group).join('|')})/`,
    'Tool groups must not import each other (spec 2.3).',
  );

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'reports/',
      '.stryker-tmp*/',
      'plans/',
      'test/protocol/__snapshots__/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-param-reassign': ['error', { props: true }],
      'prefer-const': 'error',
      'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement'],
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly', fetch: 'readonly' },
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/shaping/**/*.ts', 'src/policy/**/*.ts'],
    ignores: ['src/policy/elicitation.ts', 'src/policy/spend.ts', '**/*.test.ts'],
    rules: restrict([SDK, API(false), SERVER, TOOLS, TRANSPORTS, RUNTIME_TYPES]),
  },
  {
    files: ['src/policy/elicitation.ts', 'src/policy/spend.ts'],
    rules: restrict([API(false), SERVER, TOOLS, TRANSPORTS, RUNTIME_TYPES]),
  },
  {
    files: ['src/api/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: restrict([SDK, SERVER, TOOLS, TRANSPORTS, RUNTIME_TYPES]),
  },
  {
    files: ['src/runtime/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: restrict([API(true), SERVER, TOOLS, TRANSPORTS]),
  },
  ...TOOL_GROUPS.map((group) => ({
    files: [`src/tools/${group}/**/*.ts`],
    ignores: ['**/*.test.ts'],
    rules: restrict([
      TRANSPORTS,
      otherGroups(group),
      banned('(^|/)server/(?!registry(\\.js)?$)', 'Tools may import only server/registry (spec 2.3).'),
    ]),
  })),
  {
    files: ['src/server/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: restrict([TRANSPORTS]),
  },
  {
    files: ['src/transports/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: restrict([TOOLS]),
  },
);
