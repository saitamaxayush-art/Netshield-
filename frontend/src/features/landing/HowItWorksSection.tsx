import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  buildActiveGraph,
  findConnectedComponents,
  findBridges,
  findArticulationPoints,
} from '@/lib/graphAlgorithms'
import { Container } from '@/components/layout/Container'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

interface StageStep {
  step: number
  title: string
  subtitle: string
  description: string
  failedNodes: string[]
  failedEdges: string[]
}

/**
 * HowItWorksSection:
 * Section 4 of precision layout pass.
 * Charcoal theme (#17181B background, #1E2024 surfaces, #2A2C31 borders).
 * Three-stage pinned story:
 * 1. Model the network
 * 2. Introduce failures
 * 3. Measure connectivity
 * One graph visual that updates state as user scrolls or clicks controls.
 * Segment progress indicator in Signal Red (#E5484D).
 * Touch & keyboard previous/next controls, clean vertical stack on mobile/reduced-motion.
 */
export const HowItWorksSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(1)
  const prefersReducedMotion = usePrefersReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const stepElementsRef = useRef<(HTMLDivElement | null)[]>([])

  // Graph model for the 3-stage narrative
  const baseNodes = useMemo(
    () => [
      { id: 'gw_a', label: 'Gateway A', x: 120, y: 150 },
      { id: 'r_1', label: 'Router 1', x: 260, y: 80 },
      { id: 'r_2', label: 'Router 2', x: 260, y: 220 },
      { id: 'bridge_hub', label: 'Relay Hub', x: 420, y: 150 },
      { id: 'srv_1', label: 'Server 1', x: 580, y: 80 },
      { id: 'srv_2', label: 'Server 2', x: 580, y: 220 },
      { id: 'gw_b', label: 'Gateway B', x: 720, y: 150 },
    ],
    []
  )

  const baseEdges = useMemo(
    () => [
      { id: 'e1', source: 'gw_a', target: 'r_1' },
      { id: 'e2', source: 'gw_a', target: 'r_2' },
      { id: 'e3', source: 'r_1', target: 'r_2' },
      { id: 'e4', source: 'r_1', target: 'bridge_hub' },
      { id: 'e5', source: 'r_2', target: 'bridge_hub' },
      { id: 'e_bridge', source: 'bridge_hub', target: 'srv_1' },
      { id: 'e7', source: 'srv_1', target: 'srv_2' },
      { id: 'e8', source: 'srv_1', target: 'gw_b' },
      { id: 'e9', source: 'srv_2', target: 'gw_b' },
    ],
    []
  )

  const stages: StageStep[] = [
    {
      step: 1,
      title: 'Model the network',
      subtitle: 'Construct deterministic graph topology',
      description:
        'Represent routers, compute servers, and connections as discrete mathematical vertices V and edges E. NetShield computes initial degrees, adjacency matrices, and baseline component connectivity.',
      failedNodes: [],
      failedEdges: [],
    },
    {
      step: 2,
      title: 'Introduce failures',
      subtitle: 'Simulate component degradation',
      description:
        'Trigger isolated edge severing or vertex shutdowns. When a node fails, all its incident edges become inactive, modeling hardware breakdown or physical link loss.',
      failedNodes: [],
      failedEdges: ['e_bridge'], // Fail the critical bridge
    },
    {
      step: 3,
      title: 'Measure connectivity',
      subtitle: 'Graph decomposition and reliability estimation',
      description:
        'Tarjan algorithms detect bridges and articulation points in real time. Connected components partition into isolated subsets, exposing bottlenecks and quantifying failure probabilities.',
      failedNodes: ['bridge_hub'],
      failedEdges: ['e_bridge'],
    },
  ]

  // Synchronize activeStep with scroll position without hijacking
  useEffect(() => {
    if (prefersReducedMotion || typeof window === 'undefined') return

    const handleScroll = () => {
      const vh = window.innerHeight
      const elements = stepElementsRef.current
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= vh * 0.55 && rect.bottom >= vh * 0.25) {
          setActiveStep(i + 1)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [prefersReducedMotion])

  const currentStage = stages[activeStep - 1]

  // Real graph algorithm execution on the stage state
  const analysis = useMemo(() => {
    const active = buildActiveGraph(
      baseNodes,
      baseEdges,
      new Set(currentStage.failedNodes),
      new Set(currentStage.failedEdges)
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
  }, [baseNodes, baseEdges, currentStage])

  // Silver tonal component colors (replacing cyan/amber/green)
  const componentColors = ['#E4E8EC', '#C3CAD2', '#8E97A2']

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="py-24 sm:py-32 bg-[#17181B] text-[#E4E8EC] border-t border-[#2A2C31] relative select-none"
    >
      <Container size="wide" className="space-y-12">
        {/* Section Header */}
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8E97A2]">
              Narrative Walkthrough
            </span>
          </div>

          <h2 className="headline-chapter text-[#F3F5F7]">
            How NetShield Analyzes Networks
          </h2>

          <p className="text-sm sm:text-base text-[#C3CAD2] leading-relaxed max-w-2xl text-pretty">
            Follow the analytical pipeline from raw topological layout to stress-induced edge cuts and
            decomposition analysis.
          </p>
        </div>

        {/* 3-Segment Progress Bar in Signal Red */}
        <div className="w-full max-w-xl flex items-center gap-2" aria-label="3-Stage Progress">
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                stepNum <= activeStep ? 'bg-[#E5484D]' : 'bg-[#2A2C31]'
              }`}
            />
          ))}
        </div>

        {/* Step Selector Tabs (Touch & Keyboard accessible) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stages.map((stage) => {
            const isActive = stage.step === activeStep
            return (
              <button
                key={stage.step}
                type="button"
                onClick={() => setActiveStep(stage.step)}
                className={`p-4 text-left border rounded-[2px] transition-all cursor-pointer focus-visible:outline-none ${
                  isActive
                    ? 'bg-[#1E2024] border-[#E5484D] shadow-xs'
                    : 'bg-[#1E2024]/40 border-[#2A2C31] hover:border-[#3A3D44] text-[#8E97A2]'
                }`}
                aria-pressed={isActive}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-mono font-semibold uppercase ${
                      isActive ? 'text-[#E5484D]' : 'text-[#8E97A2]'
                    }`}
                  >
                    Stage 0{stage.step}
                  </span>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />}
                </div>
                <div className="text-sm font-semibold text-[#E4E8EC] mb-1">{stage.title}</div>
                <div className="text-xs text-[#8E97A2] line-clamp-1">{stage.subtitle}</div>
              </button>
            )
          })}
        </div>

        {/* Main Layout: Sticky Visualizer Canvas on Desktop, Clean Stack on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Visualizer Canvas */}
          <div className="lg:col-span-7 lg:sticky lg:top-24 bg-[#1E2024] border border-[#2A2C31] rounded-[3px] p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2C31]">
              <span className="text-xs font-mono text-[#8E97A2] uppercase tracking-wider">
                Active Topology &bull; Stage 0{activeStep}
              </span>
              <div
                className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded-[2px] border ${
                  analysis.isConnected
                    ? 'bg-[#1E2024] border-[#3A3D44] text-[#E4E8EC]'
                    : 'bg-[#2A161E] border-[#E5484D]/40 text-[#E5484D]'
                }`}
              >
                {analysis.isConnected ? 'Connected Network' : `${analysis.numComponents} Components`}
              </div>
            </div>

            {/* SVG Visual Canvas */}
            <div className="relative aspect-[16/9] bg-[#121315] rounded-[2px] border border-[#2A2C31] overflow-hidden flex items-center justify-center p-3">
              <svg viewBox="0 0 840 300" className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
                {/* Edges */}
                {baseEdges.map((edge) => {
                  const u = baseNodes.find((n) => n.id === edge.source)
                  const v = baseNodes.find((n) => n.id === edge.target)
                  if (!u || !v) return null

                  const isFailed = currentStage.failedEdges.includes(edge.id)
                  const isIncidentToFailedNode =
                    currentStage.failedNodes.includes(edge.source) ||
                    currentStage.failedNodes.includes(edge.target)
                  const isInactive = isFailed || isIncidentToFailedNode

                  const key = edge.source < edge.target ? `${edge.source}-${edge.target}` : `${edge.target}-${edge.source}`
                  const isBridge = analysis.bridgeKeys.has(key) && !isInactive

                  return (
                    <g key={edge.id}>
                      <line
                        x1={u.x}
                        y1={u.y}
                        x2={v.x}
                        y2={v.y}
                        stroke={
                          isInactive
                            ? '#E5484D'
                            : isBridge
                            ? '#F3F5F7'
                            : '#3A3D44'
                        }
                        strokeWidth={isBridge ? 2.5 : isInactive ? 1.5 : 1.5}
                        strokeDasharray={isInactive ? '4 4' : isBridge ? '6 3' : 'none'}
                        opacity={isInactive ? 0.7 : 1}
                        className="transition-all duration-300"
                      />
                    </g>
                  )
                })}

                {/* Nodes */}
                {baseNodes.map((node) => {
                  const isFailed = currentStage.failedNodes.includes(node.id)
                  const compIndex = analysis.compMap.get(node.id) ?? 0
                  const color = isFailed
                    ? '#E5484D'
                    : componentColors[compIndex % componentColors.length]
                  const isArticulation = analysis.artPoints.has(node.id) && !isFailed

                  return (
                    <g key={node.id} className="transition-all duration-300">
                      {isArticulation && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="20"
                          fill="none"
                          stroke="#E5484D"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                      )}

                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="12"
                        fill="#1E2024"
                        stroke={color}
                        strokeWidth={isArticulation ? 2.5 : 1.5}
                      />

                      {isFailed && (
                        <line
                          x1={node.x - 5}
                          y1={node.y - 5}
                          x2={node.x + 5}
                          y2={node.y + 5}
                          stroke="#E5484D"
                          strokeWidth="2"
                        />
                      )}

                      <text
                        x={node.x}
                        y={node.y + 24}
                        textAnchor="middle"
                        fill={isFailed ? '#E5484D' : '#C3CAD2'}
                        fontSize="10"
                        fontFamily="Inter, sans-serif"
                        fontWeight="500"
                      >
                        {node.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Quick Metrics Bar below Canvas */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 font-mono text-[11px]">
              <div className="p-2.5 bg-[#121315] rounded-[2px] border border-[#2A2C31]">
                <span className="text-[#8E97A2] text-[10px] block">Components k:</span>
                <span className="text-base font-semibold text-[#E4E8EC] mt-0.5 block">
                  {analysis.numComponents}
                </span>
              </div>
              <div className="p-2.5 bg-[#121315] rounded-[2px] border border-[#2A2C31]">
                <span className="text-[#8E97A2] text-[10px] block">Bridges:</span>
                <span className="text-base font-semibold text-[#E5484D] mt-0.5 block">
                  {analysis.bridges.length}
                </span>
              </div>
              <div className="p-2.5 bg-[#121315] rounded-[2px] border border-[#2A2C31]">
                <span className="text-[#8E97A2] text-[10px] block">Cut Vertices:</span>
                <span className="text-base font-semibold text-[#E5484D] mt-0.5 block">
                  {analysis.artPoints.size}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Narrative Steps */}
          <div className="lg:col-span-5 space-y-6">
            {stages.map((stg, idx) => (
              <div
                key={stg.step}
                ref={(el) => {
                  stepElementsRef.current[idx] = el
                }}
                className={`p-6 rounded-[2px] border transition-all ${
                  activeStep === stg.step
                    ? 'bg-[#1E2024] border-[#E5484D] shadow-sm'
                    : 'bg-[#1E2024]/40 border-[#2A2C31] opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#E5484D]">
                    Phase 0{stg.step}
                  </span>
                  {activeStep === stg.step && (
                    <span className="text-[10px] font-mono uppercase text-[#E4E8EC] px-2 py-0.5 bg-[#121315] border border-[#2A2C31] rounded-[2px]">
                      Active Phase
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-[#F3F5F7] mb-2">
                  {stg.title}: {stg.subtitle}
                </h3>
                <p className="text-xs text-[#C3CAD2] leading-relaxed text-pretty mb-4">
                  {stg.description}
                </p>

                {/* Step navigation buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-[#2A2C31] text-xs font-mono">
                  <button
                    type="button"
                    disabled={activeStep <= 1}
                    onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                    className="text-[#8E97A2] hover:text-[#E4E8EC] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    disabled={activeStep >= 3}
                    onClick={() => setActiveStep((prev) => Math.min(3, prev + 1))}
                    className="text-[#E5484D] hover:text-[#F0666A] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <span>Next Phase</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
