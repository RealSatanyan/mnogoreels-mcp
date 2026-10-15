import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/protocol/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        '**/fixtures.ts',
        'src/cli.ts',
        'src/transports/stdio.ts',
        'src/transports/http/node-server.ts',
      ],
      thresholds: { lines: 95, functions: 95, statements: 95, branches: 90 },
      reporter: ['text-summary', 'html', 'json-summary'],
    },
  },
});
