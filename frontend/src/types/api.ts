import { z } from 'zod'

// Request Schemas
export const AnalyzeRequestSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string().optional(),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
  })),
  failed_nodes: z.array(z.string()).default([]),
  failed_edges: z.array(z.string()).default([]),
  start_node: z.string().nullable().optional(),
  target_node: z.string().nullable().optional(),
})

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>

// Response Schemas
export const AnalyzeResponseSchema = z.object({
  node_degrees: z.record(z.string(), z.number()),
  connected_components: z.array(z.array(z.string())),
  num_components: z.number(),
  is_connected: z.boolean(),
  bridges: z.array(z.tuple([z.string(), z.string()])),
  articulation_points: z.array(z.string()),
  density: z.number(),
  diameter: z.number().nullable().optional(),
  average_clustering: z.number().nullable().optional(),
  bfs_order: z.array(z.string()).optional(),
  dfs_order: z.array(z.string()).optional(),
  path: z.array(z.string()).nullable().optional(),
  active_nodes_count: z.number(),
  active_edges_count: z.number(),
  is_demo: z.boolean().default(false),
})

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>

// Simulation Schemas
export const SimulateRequestSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
  })),
  failed_nodes: z.array(z.string()).default([]),
  failed_edges: z.array(z.string()).default([]),
  failure_prob: z.number().min(0).max(1).default(0.1),
  trials: z.number().int().min(1).max(5000).default(500),
  fail_target: z.enum(['nodes', 'edges', 'both']).default('edges'),
})

export type SimulateRequest = z.infer<typeof SimulateRequestSchema>

export const SimulateResponseSchema = z.object({
  trials: z.number(),
  connected_trials: z.number(),
  estimated_reliability: z.number(),
  standard_error: z.number(),
  confidence_interval_95: z.tuple([z.number(), z.number()]),
  failure_probability: z.number(),
  fail_target: z.enum(['nodes', 'edges', 'both']),
  active_components_distribution: z.record(z.string(), z.number()).optional(),
  execution_time_ms: z.number(),
  is_demo: z.boolean().default(false),
})

export type SimulateResponse = z.infer<typeof SimulateResponseSchema>

// Sweep Schemas
export const ReliabilitySweepRequestSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
  })),
  failed_nodes: z.array(z.string()).default([]),
  failed_edges: z.array(z.string()).default([]),
  probs: z.array(z.number().min(0).max(1)),
  trials_per_prob: z.number().int().min(10).max(1000).default(100),
  fail_target: z.enum(['nodes', 'edges', 'both']).default('edges'),
})

export type ReliabilitySweepRequest = z.infer<typeof ReliabilitySweepRequestSchema>

export const ReliabilitySweepPointSchema = z.object({
  prob: z.number(),
  reliability: z.number(),
  standard_error: z.number(),
  connected_trials: z.number(),
  total_trials: z.number(),
})

export type ReliabilitySweepPoint = z.infer<typeof ReliabilitySweepPointSchema>

export const ReliabilitySweepResponseSchema = z.object({
  points: z.array(ReliabilitySweepPointSchema),
  trials_per_prob: z.number(),
  fail_target: z.enum(['nodes', 'edges', 'both']),
  is_demo: z.boolean().default(false),
})

export type ReliabilitySweepResponse = z.infer<typeof ReliabilitySweepResponseSchema>
