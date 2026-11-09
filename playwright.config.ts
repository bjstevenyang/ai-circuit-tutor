import { defineConfig, devices } from '@playwright/test';

const port=Number(process.env.CIRCUIT_E2E_PORT??5173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid CIRCUIT_E2E_PORT');
const baseURL=`http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: process.env.CIRCUIT_E2E_REUSE==='1',
  },
});
