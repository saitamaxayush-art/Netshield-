import React, { useState, useMemo } from 'react'
import {
  buildActiveGraph,
  findConnectedComponents,
  findBridges,
  findArticulationPoints,
} from '@/lib/graphAlgorithms'
import { Container } from '@/components/layout/Container'
import { RotateCcw, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * MathematicalInsightsSection:
 * Section 6 of precision layout pass.
 * Charcoal theme (#17181B background, #1E2024 surfaces, #2A2C31 borders).
 * Interactive bridges, articulation points, and connectivity demo on a labelled example graph.
 * Removing a node or edge animates the change, recolours components in silver steps (#F3F5F7, #E4E8EC, #C3CAD2, #8E97A2),
 * marks bridges and articulation points in Signal Red (#E5484D) with warning icons and dashed strokes,
 * and updates live component/bridge/cut-vertex counts.
 * Short mathematical definitions placed alongside.
 */
export const MathematicalInsightsSection: React.FC = () => {
  // Example graph with deliberate bridges and articulation points
  const initialNodes = useMemo(
    () => [
      { id: 'v1', label: 'v1', x: 100, y: 150 },
      { id: 'v2', label: 'v2', x: 220, y: 80 },
      { id: 'v3', label: 'v3', x: 220, y: 220 },
      { id: 'v4', label: 'v4 (Cut)', x: 380, y: 150 },
      { id: 'v5', label: 'v5', x: 540, y: 80 },
      { id: 'v6', label: 'v6', x: 540, y: 220 },
      { id: 'v7', label: 'v7', x: 680, y: 150 },
    ],
    []
  )

  const initialEdges = useMemo(
    () => [
      { id: 'e_1_2', source: 'v1', target: 'v2' },
      { id: 'e_1_3', source: 'v1', target: 'v3' },
      { id: 'e_2_3', source: 'v2', target: 'v3' },
      { id: 'e_2_4', source: 'v2', target: 'v4' },
      { id: 'e_3_4', source: 'v3', target: 'v4' },
      { id: 'e_4_5', source: 'v4', target: 'v5' },
      { id: 'e_5_6', source: 'v5', target: 'v6' },
      { id: 'e_5_7', source: 'v5', target: 'v7' },
      { id: 'e_6_7', source: 'v6', target: 'v7' },
    ],
    []
  )

  const [failedNodes, setFailedNodes] = useState<string[]>([])
  const [failedEdges, setFailedEdges] = useState<string[]>([])

  const toggleNode = (nodeId: string) => {
    setFailedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    )
  }

  const toggleEdge = (edgeId: string) => {
    setFailedEdges((prev) =>
      prev.includes(edgeId) ? prev.filter((id) => id !== edgeId) : [...prev, edgeId]
    )
  }

  const resetInteractiveGraph = () => {
    setFailedNodes([])
    setFailedEdges([])
  }

  // Real algorithm execution on active graph
  const analysis = useMemo(() => {
    const active = buildActiveGraph(
      initialNodes,
      initialEdges,
      new Set(failedNodes),
      new Set(failedEdges)
    )

    const comps = findConnectedComponents(active)
    const bridges = findBridges(active)
    const artPoints = findArticulationPoints(active)

    const compMap = new Map<string, number>()
    comps.forEach((comp, idx) => {
      comp.forEach((nodeId) => compMap.set(nodeId, idx))
    })

    const bridgeKeys = new Set(
      bridges.map(([u, v]) => (u < v ? `${u}-${v}` : `${v}-${u}`))
    )

    return {
      comps,
      numComponents: comps.length,
      bridges,
      bridgeKeys,
      artPoints: new Set(artPoints),
      compMap,
      isConnected: active.activeNodes.size > 0 && comps.length === 1,
      activeNodesCount: active.activeNodes.size,
      activeEdgesCount: active.activeEdges.length,
    }
  }, [initialNodes, initialEdges, failedNodes, failedEdges])

  // Silver tonal component steps
  const compSilverColors = ['#F3F5F7', '#E4E8EC', '#C3CAD2', '#8E97A2']

  return (
    <section id="analysis" className="py-24 sm:py-32 border-t border-[#2A2C31] bg-[#17181B] text-[#E4E8EC] select-none">
      <Container size="wide">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-14 gap-6 pb-6 border-b border-[#2A2C31]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8E97A2]">
                Interactive Theorem Validation
              </span>
            </div>
            <h2 className="headline-chapter text-[#F3F5F7] text-balance">
              Bridges &amp; Articulation Points
            </h2>
          </div>

          <button
            type="button"
            onClick={resetInteractiveGraph}
            className="h-10 px-4 bg-[#1E2024] hover:bg-[#2A2C31] text-[#E4E8EC] border border-[#2A2C31] hover:border-[#3A3D44] font-mono text-xs uppercase tracking-wider rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#E5484D]" />
            <span>Reset Graph</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Interactive Graph Box (7 cols) */}
          <div className="lg:col-span-7 bg-[#1E2024] border border-[#2A2C31] rounded-[3px] p-6 lg:p-7 relative shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-[#2A2C31]">
              <div className="text-xs text-[#C3CAD2] flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-[#E5484D] shrink-0" />
                <span>Click any connection line or vertex to sever or restore it.</span>
              </div>
              <div
                className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded-[2px] border ${
                  analysis.isConnected
                    ? 'bg-[#1E2024] border-[#3A3D44] text-[#E4E8EC]'
                    : 'bg-[#2A161E] border-[#E5484D]/40 text-[#E5484D]'
                }`}
              >
                {analysis.isConnected ? 'Connected Graph' : `${analysis.numComponents} Disconnected Components`}
              </div>
            </div>

            <div className="relative aspect-[16/9] w-full bg-[#121315] rounded-[2px] border border-[#2A2C31] flex items-center justify-center p-2 overflow-hidden">
              <svg viewBox="0 0 780 300" className="w-full h-full select-none cursor-pointer">
                {/* Edges */}
                {initialEdges.map((edge) => {
                  const u = initialNodes.find((n) => n.id === edge.source)
                  const v = initialNodes.find((n) => n.id === edge.target)
                  if (!u || !v) return null

                  const isEdgeFailed = failedEdges.includes(edge.id)
                  const isIncidentNodeFailed =
                    failedNodes.includes(edge.source) || failedNodes.includes(edge.target)
                  const isInactive = isEdgeFailed || isIncidentNodeFailed

                  const key = edge.source < edge.target ? `${edge.source}-${edge.target}` : `${edge.target}-${edge.source}`
                  const isBridge = analysis.bridgeKeys.has(key) && !isInactive

                  return (
                    <g key={edge.id} onClick={() => toggleEdge(edge.id)}>
                      {/* Invisible touch target line */}
                      <line
                        x1={u.x}
                        y1={u.y}
                        x2={v.x}
                        y2={v.y}
                        stroke="transparent"
                        strokeWidth="24"
                      />
                      <line
                        x1={u.x}
                        y1={u.y}
                        x2={v.x}
                        y2={v.y}
                        stroke={
                          isInactive
                            ? '#E5484D'
                            : isBridge
                            ? '#E5484D'
                            : '#3A3D44'
                        }
                        strokeWidth={isBridge ? 2.5 : 1.5}
                        strokeDasharray={isInactive ? '4 4' : isBridge ? '5 3' : 'none'}
                        opacity={isInactive ? 0.45 : 1}
                        className="transition-all duration-150"
                      />
                    </g>
                  )
                })}

                {/* Nodes */}
                {initialNodes.map((node) => {
                  const isNodeFailed = failedNodes.includes(node.id)
                  const compIdx = analysis.compMap.get(node.id) ?? 0
                  const color = isNodeFailed
                    ? '#E5484D'
                    : compSilverColors[compIdx % compSilverColors.length]
                  const isArticulation = analysis.artPoints.has(node.id) && !isNodeFailed

                  return (
                    <g
                      key={node.id}
                      onClick={() => toggleNode(node.id)}
                      className="transition-all duration-150 hover:opacity-90"
                    >
                      {/* Articulation point dashed ring in Signal Red */}
                      {isArticulation && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="22"
                          fill="none"
                          stroke="#E5484D"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                          className="animate-pulse"
                        />
                      )}

                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="14"
                        fill="#1E2024"
                        stroke={color}
                        strokeWidth={isArticulation ? 2.5 : 1.5}
                      />

                      {isNodeFailed ? (
                        <text
                          x={node.x}
                          y={node.y + 4}
                          textAnchor="middle"
                          fill="#E5484D"
                          fontSize="12"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="bold"
                        >
                          X
                        </text>
                      ) : (
                        <circle cx={node.x} cy={node.y} r="3" fill={color} />
                      )}

                      <text
                        x={node.x}
                        y={node.y + 26}
                        textAnchor="middle"
                        fill={isNodeFailed ? '#E5484D' : '#C3CAD2'}
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {node.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Live Metrics Counter Row */}
            <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 bg-[#121315] rounded-[2px] border border-[#2A2C31]">
                <span className="text-[#8E97A2] text-[10px] uppercase block">Components k:</span>
                <span className="text-xl font-bold text-[#E4E8EC] mt-1 block">
                  {analysis.numComponents}
                </span>
              </div>
              <div className="p-3 bg-[#121315] rounded-[2px] border border-[#2A2C31]">
                <span className="text-[#8E97A2] text-[10px] uppercase block">Bridges:</span>
                <span className="text-xl font-bold text-[#E5484D] mt-1 block">
                  {analysis.bridges.length}
                </span>
              </div>
              <div className="p-3 bg-[#121315] rounded-[2px] border border-[#2A2C31]">
                <span className="text-[#8E97A2] text-[10px] uppercase block">Cut Vertices:</span>
                <span className="text-xl font-bold text-[#E5484D] mt-1 block">
                  {analysis.artPoints.size}
                </span>
              </div>
            </div>
          </div>

          {/* Definitions Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Bridges Definition */}
            <div className="p-5 bg-[#1E2024] border border-[#2A2C31] rounded-[2px] space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E5484D]" />
                <h3 className="font-semibold text-sm text-[#F3F5F7]">
                  Bridge (Cut Edge)
                </h3>
              </div>
              <p className="text-xs text-[#C3CAD2] leading-relaxed text-pretty">
                An edge in an undirected graph whose deletion strictly increases the number of connected
                components. Severs communication between partitioned vertex sets.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#8E97A2] border-t border-[#2A2C31]">
                Tarjan criterion: low[v] &gt; tin[u]
              </div>
            </div>

            {/* Articulation Point Definition */}
            <div className="p-5 bg-[#1E2024] border border-[#2A2C31] rounded-[2px] space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#E5484D]" />
                <h3 className="font-semibold text-sm text-[#F3F5F7]">
                  Articulation Point (Cut Vertex)
                </h3>
              </div>
              <p className="text-xs text-[#C3CAD2] leading-relaxed text-pretty">
                A vertex whose removal along with all its incident edges disconnects the remaining graph.
                Represents a single point of failure in network routing.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#8E97A2] border-t border-[#2A2C31]">
                Root with &ge; 2 DFS children or non-root with low[v] &ge; tin[u]
              </div>
            </div>

            {/* Connected Components Definition */}
            <div className="p-5 bg-[#1E2024] border border-[#2A2C31] rounded-[2px] space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#E4E8EC]" />
                <h3 className="font-semibold text-sm text-[#F3F5F7]">
                  Connected Components
                </h3>
              </div>
              <p className="text-xs text-[#C3CAD2] leading-relaxed text-pretty">
                Maximal subgraphs where every vertex has at least one active connecting path to every other
                vertex in that component. As components fragment, end-to-end communication collapses.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#8E97A2] border-t border-[#2A2C31]">
                Disjoint partitions: V = C_1 &cup; C_2 &cup; ... &cup; C_k
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
