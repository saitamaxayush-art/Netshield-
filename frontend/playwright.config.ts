import { defineConfig } from '@playwright/test'

/**
 * Landing QA suite. Runs against the production build (vite preview) in the
 * locally installed Google Chrome. Build first: npm run build.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4317',
    channel: 'chrome',
    trace: 'off',
  },
  webServer: {
    command: 'npx vite preview --port 4317 --strictPort',
    url: 'http://localhost:4317',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
