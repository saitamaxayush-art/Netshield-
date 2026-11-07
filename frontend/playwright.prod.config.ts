import { defineConfig } from '@playwright/test'

/** Port of the production server for the smoke run (uvicorn serving the API and frontend/dist). */
export const PROD_PORT = '8811'

/**
 * Smoke test of the production setup: one uvicorn process, no reload, serving the built frontend and the
 * API from the same origin (no Vite at all). Build first: npm run build (npm run test:e2e:prod does it).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['journey.spec.ts', 'bundle.spec.ts'],
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PROD_PORT}`,
    channel: 'chrome',
    trace: 'off',
    storageState: { cookies: [], origins: [{ origin: `http://127.0.0.1:${PROD_PORT}`, localStorage: [{ name: 'netshield_tour_seen', value: '1' }] }] },
  },
  webServer: {
    command: 'node ../scripts/start-prod.mjs',
    env: { NETSHIELD_API_PORT: PROD_PORT },
    url: `http://127.0.0.1:${PROD_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
