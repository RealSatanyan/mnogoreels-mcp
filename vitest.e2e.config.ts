import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    environment: 'node',
    testTimeout: 1_200_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
