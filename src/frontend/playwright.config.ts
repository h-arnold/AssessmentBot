import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-tests',
  // Compile E2E specs under the E2E-specific options (the `playwright/test`
  // types and the `@/*` / `@synthetic/*` aliases). Without this, Playwright
  // falls back to the nearest tsconfig.json, which declares no `paths`.
  tsconfig: './tsconfig.e2e.json',
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
