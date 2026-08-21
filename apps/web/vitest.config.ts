import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@dt/contracts': resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@': resolve(__dirname, './src'),
    },
  },
  test: { environment: 'node', include: ['src/**/*.spec.ts'] },
});
