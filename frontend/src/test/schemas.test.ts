/**
 * The Zod schemas against real responses captured from the running backend
 * (src/test/fixtures/backend, written by scripts/capture-api-fixtures.mjs). The compile time half of
 * the check (Zod types equal the generated OpenAPI types) lives in schemas.ts itself.
 */
import { describe, expect, it } from 'vitest'
import {
  AnalyzeResponseSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  SimulateResponseSchema,
  SweepResponseSchema,
} from '../services/api/schemas'
import { backendFixture, backendFixtureNames } from './fixtures'

const schemaFor = (name: string) =>
  name === 'health'
    ? HealthResponseSchema
    : name.startsWith('analyze-')
      ? AnalyzeResponseSchema
      : name.startsWith('simulate-')
        ? SimulateResponseSchema
        : name === 'sweep'
          ? SweepResponseSchema
          : ErrorResponseSchema

describe('schemas parse every captured backend response', () => {
  it('has fixtures for every endpoint and the error shape', () => {
    expect(backendFixtureNames.length).toBeGreaterThanOrEqual(14)
    for (const prefix of ['health', 'analyze-', 'simulate-', 'sweep', 'error-']) {
      expect(backendFixtureNames.some((n) => n.startsWith(prefix))).toBe(true)
    }
  })

  for (const name of backendFixtureNames) {
    it(`${name}`, () => {
      const fixture = backendFixture(name)
      const parsed = schemaFor(name).safeParse(fixture.response)
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
      expect(fixture.status).toBe(name.startsWith('error-') ? 422 : 200)
    })
  }

  it('the error fixtures carry the codes the client maps', () => {
    const code = (name: string) => ErrorResponseSchema.parse(backendFixture(name).response).error.code
    expect(code('error-parallel-edge')).toBe('PARALLEL_EDGE')
    expect(code('error-validation')).toBe('VALIDATION_ERROR')
    expect(code('error-two-terminal-missing')).toBe('VALIDATION_ERROR')
  })
})

/** Deep copy of a captured body as a plain record, so a test can break one field. */
function mutable(name: string): Record<string, unknown> {
  const copy: unknown = JSON.parse(JSON.stringify(backendFixture(name).response))
  if (typeof copy !== 'object' || copy === null || Array.isArray(copy)) throw new Error('fixture is not an object')
  return Object.fromEntries(Object.entries(copy))
}

describe('schemas reject anything that is not the contract', () => {
  it('an unknown top level key (strict objects)', () => {
    expect(AnalyzeResponseSchema.safeParse({ ...mutable('analyze-star'), extra: 1 }).success).toBe(false)
    expect(SimulateResponseSchema.safeParse({ ...mutable('simulate-all-terminal'), extra: 1 }).success).toBe(false)
    expect(SweepResponseSchema.safeParse({ ...mutable('sweep'), extra: 1 }).success).toBe(false)
  })

  it('a missing required key', () => {
    const { meta: _meta, ...noMeta } = mutable('analyze-star')
    expect(AnalyzeResponseSchema.safeParse(noMeta).success).toBe(false)
    const { wilson95: _w, ...noInterval } = mutable('simulate-all-terminal')
    expect(SimulateResponseSchema.safeParse(noInterval).success).toBe(false)
  })

  it('an engine other than networkx or demo', () => {
    const body = mutable('analyze-star')
    expect(AnalyzeResponseSchema.safeParse({ ...body, meta: { engine: 'browser', engineVersion: '1', apiVersion: '2.0.0' } }).success).toBe(false)
  })

  it('the pre Phase 1 analysis shape and the pre Phase 2 simulation shape', () => {
    expect(AnalyzeResponseSchema.safeParse({ is_connected: true, num_components: 1, bridges: [] }).success).toBe(false)
    expect(
      SimulateResponseSchema.safeParse({ estimated_reliability: 0.9, connected_trials: 90, trials: 100, standard_error: 0.03, confidence_interval_95: [0.8, 0.95] })
        .success
    ).toBe(false)
    expect(SweepResponseSchema.safeParse({ points: [{ prob: 0, reliability: 1, standard_error: 0 }] }).success).toBe(false)
  })

  it('a probability outside [0, 1] in a sweep point', () => {
    const body = mutable('sweep')
    const points = SweepResponseSchema.parse(body).points
    const broken = { ...body, points: [{ ...points[0], estimate: 1.5 }, ...points.slice(1)] }
    expect(SweepResponseSchema.safeParse(broken).success).toBe(false)
  })

  it('an error body without a code', () => {
    expect(ErrorResponseSchema.safeParse({ error: { message: 'x' } }).success).toBe(false)
    expect(ErrorResponseSchema.safeParse({ detail: 'Not Found' }).success).toBe(false)
  })
})
