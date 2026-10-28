import React from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Container } from '@/components/layout/Container'
import { useGraphStore } from '@/store/graphStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Network,
  Activity,
  Layers,
  ArrowRight,
  GitCommit,
  Share2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react'
import { buildActiveGraph, findConnectedComponents, findBridges, findArticulationPoints } from '@/lib/graphAlgorithms'

export const DashboardPage: React.FC = () => {
  const {
    nodes,
    edges,
    failedNodeIds,
    failedEdgeIds,
    simulationResult,
    loadExample,
  } = useGraphStore()

  // Evaluate current active graph state
  const active = React.useMemo(() => {
    const pureNodes = nodes.map((n) => ({ id: n.id, label: n.data.label, type: n.data.nodeType }))
    const pureEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
    const g = buildActiveGraph(pureNodes, pureEdges, new Set(failedNodeIds), new Set(failedEdgeIds))
    const comps = findConnectedComponents(g)
    const bridges = findBridges(g)
    const artPoints = findArticulationPoints(g)
    return {
      activeNodes: g.activeNodes.size,
      activeEdges: g.activeEdges.length,
      comps,
      numComps: comps.length,
      bridges,
      artPoints,
      isConnected: g.activeNodes.size > 0 && comps.length === 1,
    }
  }, [nodes, edges, failedNodeIds, failedEdgeIds])

  const isEmpty = nodes.length === 0

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <Navbar />

      <main className="flex-1">
        <Container size="wide" className="pt-28 pb-16 space-y-8">
          {/* Dashboard Title Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="accent">Topological Overview</Badge>
              <span className="text-xs text-text-muted font-mono">Active Session</span>
            </div>
            <h1 className="headline-sub text-text-primary">Network Reliability Dashboard</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Topological metrics derived from your current workspace graph.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/studio">
              <Button
                variant="primary"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Open Studio
              </Button>
            </Link>
          </div>
        </div>

        {/* Empty State when no nodes exist */}
        {isEmpty ? (
          <div className="p-12 text-center bg-bg-surface border border-border-subtle rounded-[4px] space-y-4 max-w-xl mx-auto my-12">
            <Network className="w-10 h-10 mx-auto text-text-muted stroke-1" />
            <h2 className="text-base font-semibold text-text-primary">
              No Graph Topology In Workspace
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Your canvas is currently empty. Open the Studio to construct custom router and server
              topologies, or load a preconfigured example graph to inspect discrete math connectivity.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                onClick={() => loadExample('star')}
              >
                Load Star Example
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                onClick={() => loadExample('ring')}
              >
                Load Ring Example
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                onClick={() => loadExample('mesh')}
              >
                Load Mesh Example
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Vertices */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-[3px] space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-[11px] font-mono uppercase">Vertices |V|</span>
                  <Layers className="w-4 h-4 text-accent-teal" />
                </div>
                <div className="text-2xl font-mono font-semibold text-text-primary">
                  {nodes.length}
                </div>
                <div className="text-[11px] text-text-muted flex justify-between font-mono">
                  <span>Active: {active.activeNodes}</span>
                  <span className={failedNodeIds.length > 0 ? 'text-state-failure' : ''}>
                    Failed: {failedNodeIds.length}
                  </span>
                </div>
              </div>

              {/* Edges */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-[3px] space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-[11px] font-mono uppercase">Edges |E|</span>
                  <Network className="w-4 h-4 text-accent-cyan" />
                </div>
                <div className="text-2xl font-mono font-semibold text-text-primary">
                  {edges.length}
                </div>
                <div className="text-[11px] text-text-muted flex justify-between font-mono">
                  <span>Active: {active.activeEdges}</span>
                  <span className={failedEdgeIds.length > 0 ? 'text-state-failure' : ''}>
                    Severed: {failedEdgeIds.length}
                  </span>
                </div>
              </div>

              {/* Connected Components */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-[3px] space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-[11px] font-mono uppercase">Components (k)</span>
                  <Badge variant={active.isConnected ? 'success' : 'failure'} size="sm">
                    {active.isConnected ? 'Connected' : 'Fragmented'}
                  </Badge>
                </div>
                <div className="text-2xl font-mono font-semibold text-text-primary">
                  {active.numComps}
                </div>
                <div className="text-[11px] text-text-muted font-mono flex items-center gap-1.5">
                  {active.isConnected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-state-success" />
                      <span>Single partition</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-state-failure" />
                      <span>Isolated partitions</span>
                    </>
                  )}
                </div>
              </div>

              {/* Critical Elements */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-[3px] space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-[11px] font-mono uppercase">Vulnerabilities</span>
                  <Activity className="w-4 h-4 text-state-warning" />
                </div>
                <div className="text-2xl font-mono font-semibold text-accent-teal">
                  {active.bridges.length + active.artPoints.length}
                </div>
                <div className="text-[11px] text-text-muted font-mono flex justify-between">
                  <span>Bridges: {active.bridges.length}</span>
                  <span>Cut Vertices: {active.artPoints.length}</span>
                </div>
              </div>
            </div>

            {/* In-depth Graph Details */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Bridges and Articulation Points Inspection */}
              <div className="lg:col-span-8 p-6 bg-bg-surface border border-border-subtle rounded-[4px] space-y-6">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary mb-1">
                    Graph Critical Vulnerabilities
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Tarjan cut components that cause network partitioning when severed.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bridges */}
                  <div className="p-4 bg-bg-primary rounded-[2px] border border-border-subtle space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-xs text-text-primary">
                      <GitCommit className="w-3.5 h-3.5 text-accent-teal" />
                      <span>Bridges ({active.bridges.length})</span>
                    </div>
                    {active.bridges.length > 0 ? (
                      <ul className="space-y-1.5 font-mono text-[11px]">
                        {active.bridges.map(([u, v], i) => {
                          const labelU = nodes.find((n) => n.id === u)?.data.label || u
                          const labelV = nodes.find((n) => n.id === v)?.data.label || v
                          return (
                            <li
                              key={i}
                              className="p-1.5 bg-bg-surface border border-border-subtle rounded-[2px] text-accent-teal"
                            >
                              {labelU} &harr; {labelV}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-text-muted italic">
                        No bridge links found in active graph.
                      </p>
                    )}
                  </div>

                  {/* Articulation Points */}
                  <div className="p-4 bg-bg-primary rounded-[2px] border border-border-subtle space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-xs text-text-primary">
                      <Share2 className="w-3.5 h-3.5 text-accent-teal" />
                      <span>Articulation Points ({active.artPoints.length})</span>
                    </div>
                    {active.artPoints.length > 0 ? (
                      <ul className="space-y-1.5 font-mono text-[11px]">
                        {active.artPoints.map((artId) => {
                          const label = nodes.find((n) => n.id === artId)?.data.label || artId
                          return (
                            <li
                              key={artId}
                              className="p-1.5 bg-bg-surface border border-border-subtle rounded-[2px] text-accent-teal"
                            >
                              {label}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-text-muted italic">
                        No articulation cut vertices found.
                      </p>
                    )}
                  </div>
                </div>

                {/* Connected Components breakdown */}
                <div className="space-y-3 pt-4 border-t border-border-subtle">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Partition Breakdown ({active.comps.length} Component{active.comps.length !== 1 ? 's' : ''})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {active.comps.map((comp, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-1.5"
                      >
                        <div className="text-xs font-mono font-semibold text-accent-teal">
                          Component {idx + 1} ({comp.length} vertices)
                        </div>
                        <div className="text-[10px] text-text-secondary font-mono truncate">
                          {comp
                            .map((id) => nodes.find((n) => n.id === id)?.data.label || id)
                            .join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Latest Simulation Result Card */}
              <div className="lg:col-span-4 p-6 bg-bg-surface border border-border-subtle rounded-[4px] space-y-5">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary mb-1">
                    Monte Carlo Reliability
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Statistical reliability estimate from trial failure simulations.
                  </p>
                </div>

                {simulationResult ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-bg-primary rounded-[2px] border border-border-subtle text-center space-y-1">
                      <div className="text-[11px] font-mono text-text-muted uppercase">
                        Estimated Network Reliability
                      </div>
                      <div className="text-3xl font-mono font-semibold text-accent-teal">
                        {(simulationResult.estimated_reliability * 100).toFixed(1)}%
                      </div>
                      <div className="text-[10px] font-mono text-text-muted">
                        Confidence Interval (95%): [
                        {(simulationResult.confidence_interval_95[0] * 100).toFixed(1)}%,{' '}
                        {(simulationResult.confidence_interval_95[1] * 100).toFixed(1)}%]
                      </div>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-border-subtle">
                        <span className="text-text-muted">Sample Trials:</span>
                        <span>{simulationResult.trials}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-subtle">
                        <span className="text-text-muted">Connected Runs:</span>
                        <span>{simulationResult.connected_trials}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-subtle">
                        <span className="text-text-muted">Failure Rate (p):</span>
                        <span>{(simulationResult.failure_probability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-text-muted">Standard Error:</span>
                        <span>&plusmn;{(simulationResult.standard_error * 100).toFixed(2)}%</span>
                      </div>
                    </div>

                    <Link to="/studio" className="block pt-2">
                      <Button variant="outline" size="sm" className="w-full">
                        Run New Simulation
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="p-6 text-center bg-bg-primary rounded-[2px] border border-border-subtle space-y-3">
                    <Activity className="w-8 h-8 mx-auto text-text-muted stroke-1" />
                    <p className="text-xs text-text-secondary leading-relaxed">
                      No simulation has been executed in the current session yet.
                    </p>
                    <Link to="/studio">
                      <Button variant="primary" size="sm">
                        Simulate in Studio
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        </Container>
      </main>

      <Footer />
    </div>
  )
}

export default DashboardPage
