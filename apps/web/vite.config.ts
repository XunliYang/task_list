import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 直接以 TS 源码方式引用共享包，web 不依赖 shared 的构建产物。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@task-list/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    // 开发代理：把同源 /api/* 转发到本地 API（默认 3000，可用 VITE_API_PROXY_TARGET 覆盖），
    // 使 `npm run dev` 双进程形态下前端拿到 JSON 而非 index.html。
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
