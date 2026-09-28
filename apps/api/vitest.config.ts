import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// API 的测试直接引用共享包的 TS 源码，避免依赖 shared 的 dist 构建产物。
export default defineConfig({
  resolve: {
    alias: {
      '@task-list/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
  },
});