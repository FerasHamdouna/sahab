/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend (../backend, `npm run dev`) listens on 8080; the browser only ever talks to Vite.
const api = { '/api': { target: 'http://localhost:8080', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three';
          if (/node_modules\/(@react-three|postprocessing)/.test(id)) return 'r3f';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
