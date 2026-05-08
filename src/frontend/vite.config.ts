import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.spec.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
    // Keep happy-dom + Ant Design suites below the default worker fan-out to avoid
    // intermittent App.spec.tsx timeouts caused by worker contention.
    maxWorkers: 2,
    testTimeout: 15_000,
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.{ts,tsx}', 'src/test/**'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 85,
      },
    },
    // HappyDOM environment options
    environmentOptions: {
      happyDOM: {
        width: 1920,
        height: 1080,
      },
    },
  },
});
