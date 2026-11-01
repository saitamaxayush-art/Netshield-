/**
 * Which API implementation is active. The mode lives in settingsStore (`adapterMode`), starts from
 * VITE_USE_DEMO_ADAPTER, and changes only through an explicit user action. There is no automatic
 * switch: a failed backend call is reported as an error, never answered by the demo adapter.
 */
import { HttpApiClient, type NetShieldApi } from './client'
import { DemoApi } from './demoAdapter'

export type AdapterMode = 'backend' | 'demo'

/** Only the exact string "true" enables demo mode. */
export function apiModeFromEnv(flag: string | undefined): AdapterMode {
  return flag === 'true' ? 'demo' : 'backend'
}

export const httpApi = new HttpApiClient({
  // Empty by default: requests go to the same origin (/api), which the Vite dev and preview
  // servers proxy to FastAPI. Set VITE_API_BASE_URL for a separately hosted API.
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
})
export const demoApi = new DemoApi()

export function getApi(mode: AdapterMode): NetShieldApi {
  return mode === 'demo' ? demoApi : httpApi
}
