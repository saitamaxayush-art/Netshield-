/** Display names for nodes: the label, with the id added when another node has the same label. */
import type { EditorNode } from '@/types/graph'

export function nodeNames(nodes: EditorNode[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const n of nodes) counts.set(n.data.label, (counts.get(n.data.label) ?? 0) + 1)
  return new Map(nodes.map((n) => [n.id, (counts.get(n.data.label) ?? 0) > 1 ? `${n.data.label} (${n.id})` : n.data.label]))
}
