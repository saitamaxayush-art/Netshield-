/** Short mathematical explanations for the backend's explanation keys. Missing keys fail the build. */
import type { Analysis, SimulateResponseBody, SweepResponseBody } from '@/services/api/schemas'

type Traversal = NonNullable<Analysis['traversal']>
type Critical = NonNullable<SimulateResponseBody['criticalEdge']>
export type ExplanationKey =
  | Analysis['summary']['explanationKey']
  | Analysis['connectivity']['explanationKey']
  | Analysis['components']['explanationKey']
  | Analysis['degrees']['explanationKey']
  | Analysis['bridges']['explanationKey']
  | Analysis['articulationPoints']['explanationKey']
  | Traversal['bfsExplanationKey']
  | Traversal['dfsExplanationKey']
  | NonNullable<Analysis['path']>['explanationKey']
  | SimulateResponseBody['explanationKey']
  | SweepResponseBody['explanationKey']
  | Critical['explanationKey']

export const EXPLANATIONS: Record<ExplanationKey, string> = {
  density_definition: 'Density is the share of possible links that exist: 2|E| / (|V|(|V| - 1)) for the operational graph.',
  connectivity_definition: 'A graph is connected when a path joins every pair of its operational nodes.',
  component_definition: 'A connected component is a largest set of nodes that are all reachable from one another.',
  degree_definition: 'The degree of a node is the number of links attached to it. Operational degree counts only links that are available.',
  bridge_definition: 'A bridge is an edge whose removal increases the number of connected components.',
  articulation_point_definition: 'An articulation point is a node whose removal increases the number of connected components.',
  bfs_definition: 'Breadth first search visits all nodes at one distance from the start (a layer) before moving to the next layer.',
  dfs_definition: 'Depth first search follows one route as far as it can, then backtracks to the most recent node with an unvisited neighbour.',
  shortest_path_hops: 'The shortest path is the route with the fewest links, found by breadth first search.',
  shortest_path_weighted: 'The shortest weighted path is the route with the smallest total link weight, found by Dijkstra\'s algorithm.',
  monte_carlo_estimate: 'Monte Carlo estimation repeats random failure trials; reliability is estimated by the share of trials that succeed.',
  reliability_sweep: 'A reliability sweep repeats the estimate across link failure probabilities to show how reliability falls as p grows.',
  critical_edge_definition: 'The most critical link is the one that, when failed, was most often the only thing keeping a trial from succeeding.',
}
