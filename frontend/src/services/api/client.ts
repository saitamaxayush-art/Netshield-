import {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalyzeResponseSchema,
  SimulateRequest,
  SimulateResponse,
  SimulateResponseSchema,
  ReliabilitySweepRequest,
  ReliabilitySweepResponse,
  ReliabilitySweepResponseSchema,
} from '@/types/api'
import { DemoAdapter } from './demoAdapter'

export interface INetworkAnalysisService {
  analyze(req: AnalyzeRequest): Promise<AnalyzeResponse>
  simulate(req: SimulateRequest): Promise<SimulateResponse>
  reliabilitySweep(req: ReliabilitySweepRequest): Promise<ReliabilitySweepResponse>
  isUsingDemo(): boolean
}

export class NetworkApiClient implements INetworkAnalysisService {
  private baseUrl: string
  private forceDemo: boolean
  private demoAdapter: DemoAdapter
  private lastUsedDemo: boolean = false

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    this.forceDemo = import.meta.env.VITE_USE_DEMO_ADAPTER === 'true'
    this.demoAdapter = new DemoAdapter()
  }

  isUsingDemo(): boolean {
    return this.forceDemo || this.lastUsedDemo
  }

  async analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
    if (this.forceDemo) {
      this.lastUsedDemo = true
      return this.demoAdapter.analyze(req)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const rawJson = await response.json()
      // Runtime validation via Zod
      const parsed = AnalyzeResponseSchema.parse(rawJson)
      this.lastUsedDemo = false
      return { ...parsed, is_demo: false }
    } catch {
      // Graceful fallback to deterministic demo adapter
      this.lastUsedDemo = true
      return this.demoAdapter.analyze(req)
    }
  }

  async simulate(req: SimulateRequest): Promise<SimulateResponse> {
    if (this.forceDemo) {
      this.lastUsedDemo = true
      return this.demoAdapter.simulate(req)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const rawJson = await response.json()
      const parsed = SimulateResponseSchema.parse(rawJson)
      this.lastUsedDemo = false
      return { ...parsed, is_demo: false }
    } catch {
      this.lastUsedDemo = true
      return this.demoAdapter.simulate(req)
    }
  }

  async reliabilitySweep(req: ReliabilitySweepRequest): Promise<ReliabilitySweepResponse> {
    if (this.forceDemo) {
      this.lastUsedDemo = true
      return this.demoAdapter.reliabilitySweep(req)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/reliability-sweep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const rawJson = await response.json()
      const parsed = ReliabilitySweepResponseSchema.parse(rawJson)
      this.lastUsedDemo = false
      return { ...parsed, is_demo: false }
    } catch {
      this.lastUsedDemo = true
      return this.demoAdapter.reliabilitySweep(req)
    }
  }
}

export const apiService = new NetworkApiClient()
