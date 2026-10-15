import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Playwright selects this E2E-specific config for test files under e2e-tests.
  tsconfig: './tsconfig.e2e.json',
  testDir: './e2e-tests',
  workers: 2,
  retries: 2,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
