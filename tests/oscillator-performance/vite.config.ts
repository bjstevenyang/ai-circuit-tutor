import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: '/tmp/ai-circuit-oscillator-benchmark-dist',
    emptyOutDir: true,
    rollupOptions: { input: resolve('tests/oscillator-performance/index.html') },
  },
});
