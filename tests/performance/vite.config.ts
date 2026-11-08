import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({plugins:[react()],build:{outDir:'/tmp/ai-circuit-stage2-benchmark-dist',emptyOutDir:true,rollupOptions:{input:{app:resolve('index.html'),core:resolve('tests/performance/core.html')}}}});
