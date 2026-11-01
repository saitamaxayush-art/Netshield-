/**
 * Typed NetShield API client.
 *
 * Every response is validated with Zod at the boundary (schemas.ts, bound to the generated types).
 * Every failure becomes one ApiError. Nothing is ever substituted: the demo adapter is a separate
 * implementation of the same interface, chosen only by VITE_USE_DEMO_ADAPTER or an explicit user
 * action (see settingsStore and getApi), never as a fallback.
 */
import type { z } from 'zod'
import {
  AnalyzeResponseSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  SimulateResponseSchema,
  SweepResponseSchema,
  type AnalyzeRequestBody,
  type AnalyzeResponseBody,
  type HealthResponseBody,
  type SimulateRequestBody,
  type SimulateResponseBody,
  type SweepRequestBody,
  type SweepResponseBody,
} from './schemas'

/** A response stamped with its provenance. */
export type Stamped<T> = T & { isDemo: boolean }

/**
 * - network: the request never got a response (offline, refused, DNS).
 * - timeout: no response within the client timeout.
 * - cancelled: the caller cancelled, or a newer request of the same kind superseded it.
 * - validation: the server rejected the request (HTTP 4xx, for example VALIDATION_ERROR, PARALLEL_EDGE).
 * - server: the server failed (HTTP 5xx, including its own TIMEOUT budget, code TIMEOUT).
 * - invalid_response: HTTP 2xx, but the body is not JSON or does not match the schema.
 */
export type ApiErrorKind = 'network' | 'timeout' | 'cancelled' | 'validation' | 'server' | 'invalid_response'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  /** Server error code when the server sent one (VALIDATION_ERROR, LIMIT_EXCEEDED, TIMEOUT, ...), else a client code. */
  readonly code: string
  /** HTTP status, or null when no response arrived. */
  readonly status: number | null
  readonly details: unknown

  constructor(kind: ApiErrorKind, code: string, message: string, status: number | null = null, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.code = code
    this.status = status
    this.details = details
  }

  get isNetworkError(): boolean {
    return this.kind === 'network'
  }
  get isTimeout(): boolean {
    return this.kind === 'timeout'
  }
  get isCancelled(): boolean {
    return this.kind === 'cancelled'
  }
  get isValidationError(): boolean {
    return this.kind === 'validation'
  }
  get isServerError(): boolean {
    return this.kind === 'server'
  }
  get isInvalidResponse(): boolean {
    return this.kind === 'invalid_response'
  }
}

export interface RequestOptions {
  /** Cancel this request from the outside. */
  signal?: AbortSignal
  /** Override the client timeout for this call. */
  timeoutMs?: number
  /** Abort the previous in-flight request of the same method (default true, except health). */
  supersede?: boolean
}

export interface NetShieldApi {
  readonly isDemo: boolean
  health(options?: RequestOptions): Promise<Stamped<HealthResponseBody>>
  analyze(body: AnalyzeRequestBody, options?: RequestOptions): Promise<Stamped<AnalyzeResponseBody>>
  simulate(body: SimulateRequestBody, options?: RequestOptions): Promise<Stamped<SimulateResponseBody>>
  reliabilitySweep(body: SweepRequestBody, options?: RequestOptions): Promise<Stamped<SweepResponseBody>>
}

type Method = 'health' | 'analyze' | 'simulate' | 'reliabilitySweep'

export const DEFAULT_TIMEOUTS_MS: Record<Method, number> = {
  health: 3_000,
  analyze: 10_000,
  // The server budget is 10 s; leave room for transfer and validation.
  simulate: 15_000,
  reliabilitySweep: 15_000,
}

export interface HttpClientOptions {
  baseUrl: string
  fetchImpl?: typeof fetch
  timeoutsMs?: Partial<Record<Method, number>>
  /** Health checks only: total attempts (default 3) and base delay between them (default 250 ms). */
  healthRetry?: { attempts: number; delayMs: number }
  sleep?: (ms: number) => Promise<void>
}

type AbortReason = 'timeout' | 'cancelled' | 'superseded'

export class HttpApiClient implements NetShieldApi {
  readonly isDemo = false
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeouts: Record<Method, number>
  private readonly healthRetry: { attempts: number; delayMs: number }
  private readonly sleep: (ms: number) => Promise<void>
  private readonly inFlight = new Map<Method, AbortController>()

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.timeouts = { ...DEFAULT_TIMEOUTS_MS, ...options.timeoutsMs }
    this.healthRetry = options.healthRetry ?? { attempts: 3, delayMs: 250 }
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  async health(options: RequestOptions = {}): Promise<Stamped<HealthResponseBody>> {
    // Retries only here: GET /api/health is idempotent and cheap.
    let lastError: ApiError | null = null
    for (let attempt = 1; attempt <= this.healthRetry.attempts; attempt++) {
      try {
        return stamp(await this.request('health', 'GET', '/api/health', undefined, HealthResponseSchema, { supersede: false, ...options }))
      } catch (error) {
        if (!(error instanceof ApiError) || !(error.isNetworkError || error.isTimeout || error.isServerError)) throw error
        lastError = error
        if (attempt < this.healthRetry.attempts) await this.sleep(this.healthRetry.delayMs * attempt)
      }
    }
    throw lastError ?? new ApiError('network', 'NETWORK_ERROR', 'Health check failed.')
  }

  async analyze(body: AnalyzeRequestBody, options: RequestOptions = {}): Promise<Stamped<AnalyzeResponseBody>> {
    return stamp(await this.request('analyze', 'POST', '/api/analyze', body, AnalyzeResponseSchema, options))
  }

  async simulate(body: SimulateRequestBody, options: RequestOptions = {}): Promise<Stamped<SimulateResponseBody>> {
    return stamp(await this.request('simulate', 'POST', '/api/simulate', body, SimulateResponseSchema, options))
  }

  async reliabilitySweep(body: SweepRequestBody, options: RequestOptions = {}): Promise<Stamped<SweepResponseBody>> {
    return stamp(await this.request('reliabilitySweep', 'POST', '/api/reliability-sweep', body, SweepResponseSchema, options))
  }

  private async request<T>(
    method: Method,
    httpMethod: 'GET' | 'POST',
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    options: RequestOptions
  ): Promise<T> {
    const controller = new AbortController()
    let reason: AbortReason | null = null
    const abort = (why: AbortReason) => {
      if (reason === null) reason = why
      controller.abort()
    }

    if (options.supersede ?? method !== 'health') {
      this.inFlight.get(method)?.abort()
      this.inFlight.set(method, controller)
    }
    // A superseded controller is aborted by the newer call; mark it so the error says why.
    controller.signal.addEventListener('abort', () => {
      if (reason === null) reason = 'superseded'
    })
    const onExternalAbort = () => abort('cancelled')
    if (options.signal?.aborted) abort('cancelled')
    options.signal?.addEventListener('abort', onExternalAbort)
    const timer = setTimeout(() => abort('timeout'), options.timeoutMs ?? this.timeouts[method])

    try {
      let response: Response
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: httpMethod,
          headers: httpMethod === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
          body: httpMethod === 'POST' ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
      } catch {
        throw abortError(reason, path, options.timeoutMs ?? this.timeouts[method]) ??
          new ApiError('network', 'NETWORK_ERROR', `Could not reach the NetShield backend (${path}). Check that it is running, for example with npm run dev:all.`)
      }

      let json: unknown
      try {
        json = await response.json()
      } catch {
        const aborted = abortError(reason, path, options.timeoutMs ?? this.timeouts[method])
        if (aborted) throw aborted
        if (!response.ok) throw httpError(response.status, `The backend returned HTTP ${response.status} without an error body.`)
        throw new ApiError('invalid_response', 'INVALID_RESPONSE', `The backend response from ${path} was not valid JSON. No result is shown.`, response.status)
      }

      if (!response.ok) {
        const error = ErrorResponseSchema.safeParse(json)
        if (error.success) {
          const { code, message, details } = error.data.error
          throw httpError(response.status, `${message} (${code})`, code, details)
        }
        throw httpError(response.status, `The backend returned HTTP ${response.status}.`)
      }

      const parsed = schema.safeParse(json)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        const where = issue && issue.path.length > 0 ? issue.path.join('.') : 'response'
        throw new ApiError(
          'invalid_response',
          'INVALID_RESPONSE',
          `The backend response from ${path} did not match the expected format (${where}: ${issue?.message ?? 'invalid'}). No result is shown.`,
          response.status,
          parsed.error.issues
        )
      }
      return parsed.data
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onExternalAbort)
      if (this.inFlight.get(method) === controller) this.inFlight.delete(method)
    }
  }
}

function stamp<T extends object>(data: T): Stamped<T> {
  return { ...data, isDemo: false }
}

function abortError(reason: AbortReason | null, path: string, timeoutMs: number): ApiError | null {
  if (reason === 'timeout') return new ApiError('timeout', 'CLIENT_TIMEOUT', `No response from ${path} within ${timeoutMs} ms.`)
  if (reason === 'superseded') return new ApiError('cancelled', 'SUPERSEDED', `Request to ${path} was replaced by a newer one.`)
  if (reason === 'cancelled') return new ApiError('cancelled', 'CANCELLED', `Request to ${path} was cancelled.`)
  return null
}

function httpError(status: number, message: string, code?: string, details?: unknown): ApiError {
  const kind: ApiErrorKind = status >= 500 ? 'server' : 'validation'
  return new ApiError(kind, code ?? `HTTP_${status}`, message, status, details)
}
