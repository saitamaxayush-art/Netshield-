/**
 * Graph files: export the editor graph as versioned JSON, and import one with Zod validation, the same
 * editing rules as the store, and a list of everything that is wrong. Nothing is applied here.
 */
import { z } from 'zod'
import type { EditorGraph } from '@/types/graph'
import { checkGraph, MAX_COORDINATE, MAX_EDGES, MAX_NODES } from '@/store/graphRules'
import { SavedEdge, SavedNode } from '@/store/persistence'

export const GRAPH_FILE_FORMAT = 'netshield-graph'
export const GRAPH_FILE_VERSION = 1
export const MAX_IMPORT_BYTES = 1024 * 1024
const MAX_LISTED = 10

const coordinate = z.number().refine((v) => Number.isFinite(v) && Math.abs(v) <= MAX_COORDINATE, `must be within ${MAX_COORDINATE} of the origin`)
const FileNode = SavedNode.extend({ position: z.strictObject({ x: coordinate, y: coordinate }) })

const GraphFile = z.strictObject({
  format: z.literal(GRAPH_FILE_FORMAT),
  version: z.literal(GRAPH_FILE_VERSION),
  exportedAt: z.string().optional(),
  graph: z.strictObject({ nodes: z.array(FileNode), edges: z.array(SavedEdge) }),
})

export function exportGraphFile(graph: EditorGraph, exportedAt: string): string {
  return JSON.stringify(
    {
      format: GRAPH_FILE_FORMAT,
      version: GRAPH_FILE_VERSION,
      exportedAt,
      graph: {
        nodes: graph.nodes.map((n) => ({ id: n.id, label: n.data.label, nodeType: n.data.nodeType, failed: n.data.failed, position: { x: n.position.x, y: n.position.y } })),
        edges: graph.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          failed: e.data?.failed ?? false,
          ...(e.data?.weight !== undefined ? { weight: e.data.weight } : {}),
          ...(e.data?.failureProbability !== undefined ? { failureProbability: e.data.failureProbability } : {}),
        })),
      },
    },
    null,
    2
  )
}

export type ImportResult = { ok: true; graph: EditorGraph } | { ok: false; errors: string[] }

const where = (path: PropertyKey[]) =>
  path.length === 0 ? 'file' : path.map((p, i) => (typeof p === 'number' ? `[${p}]` : `${i === 0 ? '' : '.'}${String(p)}`)).join('')

/** Parse a graph file's text. Never throws; lists up to 10 problems. */
export function parseGraphFile(text: string, sizeBytes = new Blob([text]).size): ImportResult {
  if (sizeBytes > MAX_IMPORT_BYTES) return { ok: false, errors: [`The file is ${(sizeBytes / 1024).toFixed(0)} KB; the limit is ${MAX_IMPORT_BYTES / 1024} KB.`] }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`The file is not valid JSON (${e instanceof Error ? e.message : 'parse error'}).`] }
  }
  // Friendly counts first, before listing hundreds of per item errors.
  if (typeof raw === 'object' && raw !== null && 'graph' in raw && typeof raw.graph === 'object' && raw.graph !== null) {
    const g = raw.graph
    if ('nodes' in g && Array.isArray(g.nodes) && g.nodes.length > MAX_NODES) return { ok: false, errors: [`The file has ${g.nodes.length} nodes; the limit is ${MAX_NODES}.`] }
    if ('edges' in g && Array.isArray(g.edges) && g.edges.length > MAX_EDGES) return { ok: false, errors: [`The file has ${g.edges.length} links; the limit is ${MAX_EDGES}.`] }
  }
  const parsed = GraphFile.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
    const listed = issues.slice(0, MAX_LISTED).map((i) => `${where(i.path)}: ${i.message}`)
    if (issues.length > MAX_LISTED) listed.push(`and ${issues.length - MAX_LISTED} more problems`)
    return { ok: false, errors: listed }
  }
  const graph: EditorGraph = {
    nodes: parsed.data.graph.nodes.map((n) => ({ id: n.id, type: 'netshieldNode', position: n.position, data: { label: n.label.trim(), nodeType: n.nodeType, failed: n.failed } })),
    edges: parsed.data.graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'netshieldEdge',
      data: {
        failed: e.failed,
        ...(e.weight !== undefined ? { weight: e.weight } : {}),
        ...(e.failureProbability !== undefined ? { failureProbability: e.failureProbability } : {}),
      },
    })),
  }
  const problem = checkGraph(graph)
  return problem ? { ok: false, errors: [problem] } : { ok: true, graph }
}
