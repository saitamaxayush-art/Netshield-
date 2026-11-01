/**
 * Zod schemas for every API response and the error body, bound to the generated OpenAPI types.
 *
 * `api.generated.ts` (from `npm run gen:api`) is the single source of truth for every request and
 * response shape. TypeScript types cannot validate data at runtime, so each response schema below is
 * a Zod mirror of a generated type, and the `Equals` assertions at the bottom make the build fail
 * unless every mirror is exactly equal to its generated type. When the backend changes, regenerate
 * the types; `tsc` then points at every schema that must change. `Equals` is stronger than
 * assignability: it fails if either side has a field, optionality or literal the other lacks.
 * Schemas are strict: a response with unknown, missing or mistyped fields is rejected.
 */
import { z } from 'zod'
import type { components } from '@/types/api.generated'

type Schemas = components['schemas']

// --- Requests (types only: the backend validates requests) -------------------------------------

export type AnalyzeRequestBody = Schemas['AnalyzeRequest']
export type ApiNode = Schemas['Node']
export type ApiEdge = Schemas['Edge']
export type SimulateRequestBody = Schemas['SimulateRequest']
export type SweepRequestBody = Schemas['SweepRequest']
export type SimulationMode = NonNullable<SimulateRequestBody['mode']>

// --- POST /api/analyze --------------------------------------------------------------------------

const SummarySchema = z.strictObject({
  nodeCount: z.number(),
  edgeCount: z.number(),
  operationalNodeCount: z.number(),
  operationalEdgeCount: z.number(),
  failedNodeCount: z.number(),
  failedEdgeCount: z.number(),
  unavailableEdgeCount: z.number(),
  density: z.number(),
  explanationKey: z.literal('density_definition'),
})

const ConnectivitySchema = z.strictObject({
  connected: z.boolean(),
  componentCount: z.number(),
  reasonKey: z.enum(['empty_network', 'single_component', 'multiple_components']),
  reason: z.string(),
  explanationKey: z.literal('connectivity_definition'),
})

const ComponentsSchema = z.strictObject({
  items: z.array(z.array(z.string())),
  componentOf: z.record(z.string(), z.number().nullable()),
  explanationKey: z.literal('component_definition'),
})

const DegreeEntrySchema = z.strictObject({ operational: z.number(), stored: z.number() })

const DegreesSchema = z.strictObject({
  byNode: z.record(z.string(), DegreeEntrySchema),
  explanationKey: z.literal('degree_definition'),
})

const BridgesSchema = z.strictObject({
  edgeIds: z.array(z.string()),
  explanationKey: z.literal('bridge_definition'),
})

const ArticulationPointsSchema = z.strictObject({
  nodeIds: z.array(z.string()),
  explanationKey: z.literal('articulation_point_definition'),
})

const BfsStepSchema = z.strictObject({ nodeId: z.string(), layer: z.number() })

const TraversalErrorSchema = z.strictObject({ code: z.literal('START_NODE_FAILED'), message: z.string() })

const TraversalSchema = z.strictObject({
  startNodeId: z.string(),
  error: TraversalErrorSchema.nullable(),
  bfs: z.array(BfsStepSchema),
  dfs: z.array(z.string()),
  bfsExplanationKey: z.literal('bfs_definition'),
  dfsExplanationKey: z.literal('dfs_definition'),
})

const PathResultSchema = z.strictObject({
  source: z.string(),
  target: z.string(),
  metric: z.enum(['hops', 'weight']),
  weightsIgnoredReason: z.literal('MISSING_WEIGHTS').nullable(),
  found: z.boolean(),
  reason: z.enum(['SOURCE_FAILED', 'TARGET_FAILED', 'DISCONNECTED']).nullable(),
  reasonKey: z.enum(['path_source_failed', 'path_target_failed', 'path_disconnected']).nullable(),
  nodeIds: z.array(z.string()).nullable(),
  edgeIds: z.array(z.string()).nullable(),
  hops: z.number().nullable(),
  length: z.number().nullable(),
  explanationKey: z.enum(['shortest_path_hops', 'shortest_path_weighted']),
})

const AnalysisSchema = z.strictObject({
  summary: SummarySchema,
  connectivity: ConnectivitySchema,
  components: ComponentsSchema,
  degrees: DegreesSchema,
  bridges: BridgesSchema,
  articulationPoints: ArticulationPointsSchema,
  traversal: TraversalSchema.nullable(),
  path: PathResultSchema.nullable(),
})

const MetaSchema = z.strictObject({
  engine: z.enum(['networkx', 'demo']),
  engineVersion: z.string(),
  apiVersion: z.string(),
})

export const AnalyzeResponseSchema = z.strictObject({
  current: AnalysisSchema,
  healthy: AnalysisSchema.nullable(),
  meta: MetaSchema,
})

// --- POST /api/simulate and /api/reliability-sweep ---------------------------------------------------

const ModeSchema = z.enum(['all-terminal', 'two-terminal'])
/** Probabilities and proportions. OpenAPI types cannot carry the range, so it is checked here. */
const unit = z.number().min(0).max(1)
const count = z.number().int().min(0)
const Wilson95Schema = z.strictObject({ low: unit, high: unit })
const HistogramBinSchema = z.strictObject({ components: count, trials: count })
const CriticalEdgeSchema = z.strictObject({
  edgeId: z.string(),
  pivotalTrials: count,
  share: unit,
  explanationKey: z.literal('critical_edge_definition'),
})

export const SimulateResponseSchema = z.strictObject({
  mode: ModeSchema,
  source: z.string().nullable(),
  target: z.string().nullable(),
  trials: count,
  connectedTrials: count,
  estimate: unit,
  standardError: unit,
  wilson95: Wilson95Schema,
  seed: count,
  edgeFailureProbability: unit,
  nodeFailureProbability: unit,
  averageComponents: z.number(),
  componentHistogram: z.array(HistogramBinSchema),
  criticalEdge: CriticalEdgeSchema.nullable(),
  assumptions: z.array(z.string()),
  elapsedMs: z.number(),
  explanationKey: z.literal('monte_carlo_estimate'),
  meta: MetaSchema,
})

const SweepPointSchema = z.strictObject({
  p: unit,
  estimate: unit,
  connectedTrials: count,
  standardError: unit,
  wilson95: Wilson95Schema,
})

export const SweepResponseSchema = z.strictObject({
  mode: ModeSchema,
  source: z.string().nullable(),
  target: z.string().nullable(),
  trialsPerPoint: count,
  seed: count,
  nodeFailureProbability: unit,
  points: z.array(SweepPointSchema),
  assumptions: z.array(z.string()),
  elapsedMs: z.number(),
  explanationKey: z.literal('reliability_sweep'),
  meta: MetaSchema,
})

// --- GET /api/health ------------------------------------------------------------------------------------

export const HealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.string(),
  engine: z.string(),
  version: z.string(),
})

// --- Error body (every non 2xx response) ----------------------------------------------------------

export const ErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    details: z
      .union([
        z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])),
        z.array(z.record(z.string(), z.string())),
      ])
      .nullable()
      .optional(),
  }),
})

// --- Exported types ---------------------------------------------------------------------------------

export type AnalyzeResponseBody = Schemas['AnalyzeResponse']
export type Analysis = Schemas['Analysis']
export type SimulateResponseBody = Schemas['SimulateResponse']
export type SweepResponseBody = Schemas['SweepResponse']
export type SweepPoint = Schemas['SweepPoint']
export type HealthResponseBody = Schemas['HealthResponse']
export type Meta = Schemas['Meta']
export type ErrorResponseBody = Schemas['ErrorResponse']

// --- Compile time proof that every runtime schema equals its generated type ------------------------

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type ContractChecks = [
  Assert<Equals<z.infer<typeof AnalyzeResponseSchema>, AnalyzeResponseBody>>,
  Assert<Equals<z.infer<typeof AnalysisSchema>, Analysis>>,
  Assert<Equals<z.infer<typeof SummarySchema>, Schemas['Summary']>>,
  Assert<Equals<z.infer<typeof ConnectivitySchema>, Schemas['Connectivity']>>,
  Assert<Equals<z.infer<typeof ComponentsSchema>, Schemas['Components']>>,
  Assert<Equals<z.infer<typeof DegreesSchema>, Schemas['Degrees']>>,
  Assert<Equals<z.infer<typeof BridgesSchema>, Schemas['Bridges']>>,
  Assert<Equals<z.infer<typeof ArticulationPointsSchema>, Schemas['ArticulationPoints']>>,
  Assert<Equals<z.infer<typeof TraversalSchema>, Schemas['Traversal']>>,
  Assert<Equals<z.infer<typeof PathResultSchema>, Schemas['PathResult']>>,
  Assert<Equals<z.infer<typeof MetaSchema>, Schemas['Meta']>>,
  Assert<Equals<z.infer<typeof SimulateResponseSchema>, SimulateResponseBody>>,
  Assert<Equals<z.infer<typeof SweepResponseSchema>, SweepResponseBody>>,
  Assert<Equals<z.infer<typeof SweepPointSchema>, SweepPoint>>,
  Assert<Equals<z.infer<typeof CriticalEdgeSchema>, Schemas['CriticalEdge']>>,
  Assert<Equals<z.infer<typeof HealthResponseSchema>, HealthResponseBody>>,
  Assert<Equals<z.infer<typeof ErrorResponseSchema>, ErrorResponseBody>>,
]
