/**
 * A tiny, deliberately naive reference used only by the journey test, independent of the backend and of
 * the app code: components by depth first search, bridges and articulation points by brute force (remove
 * each element and count components again), density from its definition.
 */
export interface RefGraph {
  nodes: Array<{ id: string; failed: boolean }>
  edges: Array<{ id: string; source: string; target: string; failed: boolean }>
}

function operational(g: RefGraph, skipNode?: string, skipEdge?: string) {
  const alive = new Set(g.nodes.filter((n) => !n.failed && n.id !== skipNode).map((n) => n.id))
  const edges = g.edges.filter((e) => !e.failed && e.id !== skipEdge && alive.has(e.source) && alive.has(e.target))
  return { alive, edges }
}

function countComponents(alive: Set<string>, edges: RefGraph['edges']): number {
  const adjacency = new Map([...alive].map((id) => [id, [] as string[]]))
  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target)
    adjacency.get(e.target)?.push(e.source)
  }
  const seen = new Set<string>()
  let count = 0
  for (const start of alive) {
    if (seen.has(start)) continue
    count++
    const stack = [start]
    seen.add(start)
    while (stack.length > 0) {
      const u = stack.pop() ?? ''
      for (const v of adjacency.get(u) ?? []) {
        if (seen.has(v)) continue
        seen.add(v)
        stack.push(v)
      }
    }
  }
  return count
}

export function reference(g: RefGraph) {
  const { alive, edges } = operational(g)
  const components = countComponents(alive, edges)
  const bridges = edges.filter((e) => countComponents(alive, operational(g, undefined, e.id).edges) > components).map((e) => e.id).sort()
  const articulation = [...alive]
    .filter((id) => {
      const without = operational(g, id)
      return countComponents(without.alive, without.edges) > components
    })
    .sort()
  const n = alive.size
  return { components, connected: components === 1, bridges, articulation, density: n >= 2 ? (2 * edges.length) / (n * (n - 1)) : 0 }
}
