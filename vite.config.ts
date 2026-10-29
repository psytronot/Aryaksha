import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'] },
  base: './',
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
    rollupOptions: {
      maxParallelFileOps: 128,
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (id.includes('/node_modules/three/')) return 'vendor-three';
          if (id.includes('/node_modules/satellite.js/')) return 'vendor-satellite';
          if (id.includes('/node_modules/lucide-react/')) return 'vendor-icons';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'vendor-react';
        },
      },
    },
  },
});
