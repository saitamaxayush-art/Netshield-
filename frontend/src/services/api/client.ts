import type { z } from 'zod'
import {
  AnalyzeResponseSchema,
  ErrorResponseSchema,
  SimulateResponseSchema,
  SweepResponseSchema,
  type AnalyzeRequestBody,
  type AnalyzeResponseBody,
  type SimulateRequestBody,
  type SimulateResponseBody,
  type SweepRequestBody,
  type SweepResponseBody,
} from './contract'
import { DemoAdapter } from './demoAdapter'

/** Where a result came from. Set by the code path that produced it, never read from the payload. */
export type ResultSource = 'backend' | 'demo'

export interface Sourced<T> {
  data: T
  source: ResultSource
}

/**
 * `backend`: every call goes to FastAPI; any failure is an error, never a substitute result.
 * `demo`: only when VITE_USE_DEMO_ADAPTER is exactly "true", an explicit deploy time switch that the
 * studio shows as a banner. Demo results are labelled "Demo result". There is no automatic switch
 * from backend to demo.
 */
export type ApiMode = 'backend' | 'demo'

export function apiModeFromEnv(flag: string | undefined): ApiMode {
  return flag === 'true' ? 'demo' : 'backend'
}

export type ApiErrorKind = 'network' | 'http' | 'contract' | 'unavailable_in_demo'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  readonly code: string | undefined

  constructor(kind: ApiErrorKind, message: string, status?: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = code
  }
}

export interface ApiClientOptions {
  baseUrl: string
  mode: ApiMode
  fetchImpl?: typeof fetch
}

export class NetworkApiClient {
  readonly mode: ApiMode
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly demo = new DemoAdapter()

  constructor(options: ApiClientOptions) {
    this.mode = options.mode
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
  }

  async analyze(body: AnalyzeRequestBody): Promise<Sourced<AnalyzeResponseBody>> {
    if (this.mode === 'demo') {
      throw new ApiError(
        'unavailable_in_demo',
        'Graph analysis needs the NetShield backend. Demo mode is on (VITE_USE_DEMO_ADAPTER=true) and does not ' +
          'compute analysis. Turn demo mode off and start the backend.'
      )
    }
    return { data: await this.post('/api/analyze', body, AnalyzeResponseSchema), source: 'backend' }
  }

  async simulate(body: SimulateRequestBody): Promise<Sourced<SimulateResponseBody>> {
    if (this.mode === 'demo') return { data: this.demo.simulate(body), source: 'demo' }
    return { data: await this.post('/api/simulate', body, SimulateResponseSchema), source: 'backend' }
  }

  async reliabilitySweep(body: SweepRequestBody): Promise<Sourced<SweepResponseBody>> {
    if (this.mode === 'demo') return { data: this.demo.reliabilitySweep(body), source: 'demo' }
    return { data: await this.post('/api/reliability-sweep', body, SweepResponseSchema), source: 'backend' }
  }

  /** POST and validate. Every failure becomes an ApiError; nothing is substituted. */
  private async post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new ApiError(
        'network',
        `Could not reach the NetShield backend (${path}). Check that it is running, for example with npm run dev:all.`
      )
    }

    let json: unknown
    try {
      json = await response.json()
    } catch {
      if (!response.ok) {
        throw new ApiError('http', `The backend returned HTTP ${response.status} without an error body.`, response.status)
      }
      throw new ApiError('contract', `The backend response from ${path} was not valid JSON. No result is shown.`)
    }

    if (!response.ok) {
      const error = ErrorResponseSchema.safeParse(json)
      if (error.success) {
        const { code, message } = error.data.error
        throw new ApiError('http', `${message} (${code})`, response.status, code)
      }
      throw new ApiError('http', `The backend returned HTTP ${response.status}.`, response.status)
    }

    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const where = issue && issue.path.length > 0 ? issue.path.join('.') : 'response'
      throw new ApiError(
        'contract',
        `The backend response from ${path} did not match the expected format (${where}: ${issue?.message ?? 'invalid'}). ` +
          'No result is shown.'
      )
    }
    return parsed.data
  }
}

export const apiService = new NetworkApiClient({
  // Empty by default: requests go to the same origin (/api), which the Vite dev and preview
  // servers proxy to FastAPI. Set VITE_API_BASE_URL for a separately hosted API.
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  mode: apiModeFromEnv(import.meta.env.VITE_USE_DEMO_ADAPTER),
})
