import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@dt/contracts': resolve(__dirname, '../../packages/contracts/src/index.ts') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'prisma/**/*.spec.ts'],
    coverage: { provider: 'v8', reportsDirectory: './coverage', thresholds: { lines: 80, functions: 80 } },
  },
});
