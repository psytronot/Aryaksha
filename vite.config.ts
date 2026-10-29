import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts'] },
  base: './',
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
    rollupOptions: {
      maxParallelFileOps: 128,
    },
  },
});
