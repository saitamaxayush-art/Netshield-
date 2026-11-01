/**
 * Runtime validation of backend responses, bound to the generated OpenAPI types.
 *
 * `api.generated.ts` (from `npm run gen:api`) is the single source of truth for every request and
 * response shape. TypeScript types cannot validate data at runtime, so each response schema below is
 * a Zod mirror of a generated type, and the `Equals` assertions at the bottom make the build fail
 * unless every mirror is exactly equal to its generated type. When the backend changes, regenerate
 * the types; `tsc` then points at every schema that must change. Schemas are strict: a response
 * with unknown, missing or mistyped fields is rejected, never partially accepted.
 */
import { z } from 'zod'
import type { components } from '@/types/api.generated'

type Schemas = components['schemas']

// --- Requests (types only: the backend validates requests) -------------------------------------

export type AnalyzeRequestBody = Schemas['AnalyzeRequest']
export type ApiNode = Schemas['Node']
export type ApiEdge = Schemas['Edge']
export type SimulateRequestBody = Schemas['SimulateRequest']
export type SweepRequestBody = Schemas['ReliabilitySweepRequest']

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
  engine: z.literal('networkx'),
  engineVersion: z.string(),
  apiVersion: z.string(),
})

export const AnalyzeResponseSchema = z.strictObject({
  current: AnalysisSchema,
  healthy: AnalysisSchema.nullable(),
  meta: MetaSchema,
})

// --- LEGACY POST /api/simulate and /api/reliability-sweep (pre-contract shapes until Phase 2) ----

const FailTargetSchema = z.enum(['nodes', 'edges', 'both'])

export const SimulateResponseSchema = z.strictObject({
  active_components_distribution: z.record(z.string(), z.number()).nullable().optional(),
  confidence_interval_95: z.tuple([z.number(), z.number()]),
  connected_trials: z.number(),
  estimated_reliability: z.number(),
  execution_time_ms: z.number(),
  fail_target: FailTargetSchema,
  failure_probability: z.number(),
  is_demo: z.boolean().optional(),
  standard_error: z.number(),
  trials: z.number(),
})

const SweepPointSchema = z.strictObject({
  connected_trials: z.number(),
  prob: z.number(),
  reliability: z.number(),
  standard_error: z.number(),
  total_trials: z.number(),
})

export const SweepResponseSchema = z.strictObject({
  fail_target: FailTargetSchema,
  is_demo: z.boolean().optional(),
  points: z.array(SweepPointSchema),
  trials_per_prob: z.number(),
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
export type SweepResponseBody = Schemas['ReliabilitySweepResponse']
export type SweepPoint = Schemas['ReliabilitySweepPoint']
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
  Assert<Equals<z.infer<typeof ErrorResponseSchema>, ErrorResponseBody>>,
]
