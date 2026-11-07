import { defineConfig } from '@playwright/test'

/** Port of the real FastAPI backend started for the suite (not the developer's 8000). */
export const E2E_API_PORT = '8799'

/**
 * End to end suite against the production build (vite preview) in the locally installed Google
 * Chrome, with the real FastAPI backend running. The preview server proxies /api to that backend.
 * Neither server is reused from outside the run, so studio tests always talk to the backend this
 * run started. Build first: npm run build (npm run test:e2e does it).
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
    trace: 'off',
    // Every spec starts as a returning visitor, so the first visit guided tour does not cover the page.
    // The tour specs reset this to an empty storage.
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:4317', localStorage: [{ name: 'netshield_tour_seen', value: '1' }] }] },
  },
  projects: [
    // Every spec in the locally installed Google Chrome.
    { name: 'chrome', use: { channel: 'chrome' } },
    // The user facing journeys and layout in WebKit (Safari's engine), installed with `npx playwright install webkit`.
    { name: 'webkit', use: { browserName: 'webkit' }, testMatch: ['journey.spec.ts', 'studio-failure.spec.ts', 'simulation.spec.ts', 'layout.spec.ts', 'tour.spec.ts'] },
  ],
  webServer: [
    {
      command: 'node ../scripts/dev-backend.mjs',
      env: { NETSHIELD_API_PORT: E2E_API_PORT, NETSHIELD_API_RELOAD: '0' },
      url: `http://127.0.0.1:${E2E_API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite preview --port 4317 --strictPort',
      env: { NETSHIELD_API_PORT: E2E_API_PORT },
      url: 'http://localhost:4317',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
