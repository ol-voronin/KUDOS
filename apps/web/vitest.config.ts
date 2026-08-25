import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // JSX у тестах без окремого плагіна: esbuild уміє .tsx сам, йому лише
  // треба сказати, що рантайм автоматичний. Тягнути @vitejs/plugin-react
  // заради двох тестів — зайва залежність у продовому дереві.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@dt/contracts': resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@': resolve(__dirname, './src'),
    },
  },
  test: { environment: 'node', include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'] },
});
