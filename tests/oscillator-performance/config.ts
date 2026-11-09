import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: '*.perf.ts', fullyParallel: false, workers: 1, retries: 0,
  timeout: 900000, reporter: 'list', outputDir: '/tmp/ai-circuit-oscillator-performance-results',
  use: { baseURL: 'http://127.0.0.1:5188', viewport: { width: 1440, height: 900 }, trace: 'off', screenshot: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    cwd: process.cwd(),
    command: 'npx vite preview --config tests/oscillator-performance/vite.config.ts --host 127.0.0.1 --port 5188 --strictPort',
    url: 'http://127.0.0.1:5188/tests/oscillator-performance/index.html', reuseExistingServer: false,
  },
});
