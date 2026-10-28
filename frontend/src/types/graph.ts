import { z } from 'zod'

export type NodeType = 'router' | 'server' | 'client' | 'firewall'

export type ElementStatus = 'healthy' | 'failed'

export interface GraphNodeData {
  id: string
  label: string
  nodeType: NodeType
  status: ElementStatus
  failureProb?: number
  componentIndex?: number
  isArticulationPoint?: boolean
}

export interface GraphEdgeData {
  id: string
  source: string
  target: string
  status: ElementStatus
  weight?: number
  failureProb?: number
  isBridge?: boolean
}

export interface NetworkGraphState {
  nodes: GraphNodeData[]
  edges: GraphEdgeData[]
  failedNodeIds: string[]
  failedEdgeIds: string[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
}

export const NodeTypeSchema = z.enum(['router', 'server', 'client', 'firewall'])

export const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  nodeType: NodeTypeSchema,
  status: z.enum(['healthy', 'failed']),
  failureProb: z.number().min(0).max(1).optional(),
  componentIndex: z.number().int().optional(),
  isArticulationPoint: z.boolean().optional(),
})

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  status: z.enum(['healthy', 'failed']),
  weight: z.number().optional(),
  failureProb: z.number().min(0).max(1).optional(),
  isBridge: z.boolean().optional(),
})
