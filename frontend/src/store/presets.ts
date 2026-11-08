/**
 * Example networks (star, ring, mesh, campus) with fixed, deterministic layouts. The UI labels a loaded
 * preset "Example" so it is never mistaken for the user's own data.
 */
import type { EditorEdge, EditorGraph, EditorNode, NodeType } from '@/types/graph'

export type PresetName = 'star' | 'ring' | 'mesh' | 'campus'
export const PRESET_NAMES: readonly PresetName[] = ['star', 'ring', 'mesh', 'campus']
export const PRESET_TITLES: Record<PresetName, string> = {
  star: 'Example: star network',
  ring: 'Example: ring network',
  mesh: 'Example: partial mesh',
  campus: 'Example: campus network',
}

const node = (id: string, label: string, nodeType: NodeType, x: number, y: number): EditorNode => ({
  id,
  type: 'netshieldNode',
  position: { x, y },
  data: { label, nodeType, failed: false },
})
const edge = (id: string, source: string, target: string, weight?: number): EditorEdge => ({
  id,
  source,
  target,
  type: 'netshieldEdge',
  data: weight === undefined ? { failed: false } : { failed: false, weight },
})

function star(): EditorGraph {
  return {
    nodes: [
      node('hub', 'Core Router', 'router', 400, 250),
      node('srv', 'Primary Server', 'server', 400, 80),
      node('fw', 'Border Firewall', 'firewall', 90, 250),
      node('c1', 'Client 1', 'client', 700, 110),
      node('c2', 'Client 2', 'client', 720, 310),
      node('c3', 'Client 3', 'client', 150, 450),
      node('c4', 'Client 4', 'client', 560, 480),
    ],
    edges: [
      edge('e-hub-srv', 'hub', 'srv'),
      edge('e-hub-fw', 'hub', 'fw'),
      edge('e-hub-c1', 'hub', 'c1'),
      edge('e-hub-c2', 'hub', 'c2'),
      edge('e-hub-c3', 'hub', 'c3'),
      edge('e-hub-c4', 'hub', 'c4'),
    ],
  }
}

function ring(): EditorGraph {
  const spec: Array<[string, string, NodeType]> = [
    ['r1', 'Router A', 'router'],
    ['r2', 'Server 1', 'server'],
    ['r3', 'Router B', 'router'],
    ['r4', 'Client 1', 'client'],
    ['r5', 'Firewall', 'firewall'],
    ['r6', 'Client 2', 'client'],
  ]
  // Fixed coordinates (a hexagon of radius 200 around (400, 250)), rounded once and written out.
  const xy: Array<[number, number]> = [
    [400, 50],
    [573, 150],
    [573, 350],
    [400, 450],
    [227, 350],
    [227, 150],
  ]
  return {
    nodes: spec.map(([id, label, type], i) => node(id, label, type, xy[i][0], xy[i][1])),
    edges: spec.map(([id], i) => {
      const next = spec[(i + 1) % spec.length][0]
      return edge(`e-${id}-${next}`, id, next)
    }),
  }
}

function mesh(): EditorGraph {
  return {
    nodes: [
      node('g1', 'Gateway 1', 'firewall', 110, 140),
      node('core', 'Core Router', 'router', 420, 110),
      node('g2', 'Gateway 2', 'firewall', 730, 140),
      node('db', 'Database Cluster', 'server', 230, 320),
      node('app', 'Application Cluster', 'server', 610, 320),
      node('agg', 'Aggregation Switch', 'router', 420, 440),
    ],
    edges: [
      edge('e-g1-core', 'g1', 'core'),
      edge('e-core-g2', 'core', 'g2'),
      edge('e-g1-db', 'g1', 'db'),
      edge('e-core-db', 'core', 'db'),
      edge('e-core-app', 'core', 'app'),
      edge('e-g2-app', 'g2', 'app'),
      edge('e-db-app', 'db', 'app'),
      edge('e-db-agg', 'db', 'agg'),
      edge('e-app-agg', 'app', 'agg'),
    ],
  }
}

/**
 * The demonstration network: 10 nodes and 12 links that show every panel at once. Redundant loops in
 * the core (no bridges there), single points of failure at the edges (5 bridges, 4 cut vertices), varied
 * degrees, and one slow link (weight 5, Edge Router to Core B) so the weighted shortest path from the
 * gateway to the Library PC differs from the fewest hops path.
 */
function campus(): EditorGraph {
  return {
    nodes: [
      node('gw', 'Internet Gateway', 'firewall', 40, 250),
      node('edge', 'Edge Router', 'router', 260, 250),
      node('core-a', 'Core A', 'router', 480, 110),
      node('core-b', 'Core B', 'router', 480, 390),
      node('web', 'Web Server', 'server', 720, 0),
      node('lab', 'Lab Switch', 'router', 720, 250),
      node('lib', 'Library Switch', 'router', 720, 500),
      node('db', 'Database', 'server', 960, 0),
      node('lab-pc', 'Lab PC', 'client', 960, 250),
      node('lib-pc', 'Library PC', 'client', 960, 500),
    ],
    edges: [
      edge('e-gw-edge', 'gw', 'edge', 1),
      edge('e-edge-a', 'edge', 'core-a', 1),
      edge('e-edge-b', 'edge', 'core-b', 5),
      edge('e-a-b', 'core-a', 'core-b', 1),
      edge('e-a-web', 'core-a', 'web', 1),
      edge('e-a-lab', 'core-a', 'lab', 1),
      edge('e-b-lab', 'core-b', 'lab', 1),
      edge('e-b-lib', 'core-b', 'lib', 1),
      edge('e-web-lab', 'web', 'lab', 1),
      edge('e-web-db', 'web', 'db', 1),
      edge('e-lab-pc', 'lab', 'lab-pc', 1),
      edge('e-lib-pc', 'lib', 'lib-pc', 1),
    ],
  }
}

export function preset(name: PresetName): EditorGraph {
  return name === 'ring' ? ring() : name === 'mesh' ? mesh() : name === 'campus' ? campus() : star()
}
