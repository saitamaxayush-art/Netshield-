import { useMemo, useRef, useState } from 'react'
import { RotateCcw, X as XIcon, Check } from 'lucide-react'
import { analyzeNetwork } from '@/lib/graphAlgorithms'
import { generatePreset, type LayoutEdge, type PresetKind } from '@/lib/seededGraphGenerator'
import { PanelWipe } from '../components/PanelWipe'
import { LContainer, LGrid, Cell, Eyebrow, ExampleTag } from '../components/Layout'
import { ScriptCaps, SplitLines } from '../components/SplitLines'
import { RollingCounter } from '../components/RollingCounter'
import { LButton } from '../components/Button'
import { GraphCanvas } from '../graph/GraphCanvas'
import { componentFill } from '../graph/palette'
import { BridgeGlyph, CutGlyph, FailedEdgeGlyph, FailedNodeGlyph, HealthyGlyph } from '../graph/Glyphs'

const PRESETS: Array<{ kind: PresetKind; label: string }> = [
  { kind: 'star', label: 'Star' },
  { kind: 'ring', label: 'Ring' },
  { kind: 'mesh', label: 'Mesh' },
]

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function Sandbox() {
  const [kind, setKind] = useState<PresetKind>('mesh')
  const base = useMemo(() => generatePreset(kind, 7), [kind])
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({})
  const [failedNodes, setFailedNodes] = useState<Set<string>>(new Set())
  const [failedEdges, setFailedEdges] = useState<Set<string>>(new Set())
  const [announcement, setAnnouncement] = useState('')
  const frame = useRef(0)

  const nodes = useMemo(() => base.nodes.map((n) => (moved[n.id] ? { ...n, ...moved[n.id] } : n)), [base, moved])
  const analysis = useMemo(() => analyzeNetwork(base.nodes, base.edges, failedNodes, failedEdges), [base, failedNodes, failedEdges])
  const edgeById = useMemo(() => new Map(base.edges.map((e) => [e.id, e])), [base])

  const summary = (a = analysis) =>
    `${plural(a.components.length, 'component', 'components')}, ${plural(a.bridgeEdgeIds.size, 'bridge', 'bridges')}, ${plural(
      a.articulationPoints.size,
      'articulation point',
      'articulation points'
    )}. Network ${a.isConnected ? 'connected' : 'disconnected'}.`

  const announce = (what: string, fn: Set<string>, fe: Set<string>) => {
    setAnnouncement(`${what}. ${summary(analyzeNetwork(base.nodes, base.edges, fn, fe))}`)
  }

  const toggleNode = (id: string) => {
    const next = new Set(failedNodes)
    const failing = !next.has(id)
    if (failing) next.add(id)
    else next.delete(id)
    setFailedNodes(next)
    announce(`Node ${id} ${failing ? 'failed' : 'restored'}`, next, failedEdges)
  }
  const toggleEdge = (id: string) => {
    const e = edgeById.get(id)!
    const next = new Set(failedEdges)
    const failing = !next.has(id)
    if (failing) next.add(id)
    else next.delete(id)
    setFailedEdges(next)
    announce(`Link ${e.source} to ${e.target} ${failing ? 'failed' : 'restored'}`, failedNodes, next)
  }
  const moveNode = (id: string, x: number, y: number) => {
    // Coalesce pointer moves to one state update per frame.
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => setMoved((m) => ({ ...m, [id]: { x, y } })))
  }
  const reset = (nextKind = kind) => {
    setKind(nextKind)
    setMoved({})
    setFailedNodes(new Set())
    setFailedEdges(new Set())
    const g = generatePreset(nextKind, 7)
    setAnnouncement(`${nextKind === kind ? 'Reset' : `${g.name} example loaded`}. ${summary(analyzeNetwork(g.nodes, g.edges))}`)
  }

  const nodeFailedOrIsolated = (id: string) => failedNodes.has(id)
  const edgeIsDown = (e: LayoutEdge) => failedEdges.has(e.id) || failedNodes.has(e.source) || failedNodes.has(e.target)
  const multi = analysis.components.length > 1

  return (
    <PanelWipe tone="silver" id="sandbox" chapter="sandbox" labelledBy="sandbox-title">
      <LContainer>
        <LGrid style={{ rowGap: 'var(--sp-8)' }}>
          <Cell d="1 / 6" t="1 / 8" m="1 / -1" className="ns-stack" data-align="start">
            <Eyebrow>02 / Live sandbox</Eyebrow>
            <ScriptCaps id="sandbox-title" accent="Try it" text="Break a network." emphasis="Break" />
            <SplitLines className="ns-lead">
              Tap a link or a node to fail it. Drag nodes to rearrange. Every change reruns the same analysis the simulator uses, so the
              counts are computed, not illustrated.
            </SplitLines>
            <dl style={{ marginBottom: 0, display: 'grid', gap: 'var(--sp-5)', ['--stack' as string]: 'var(--sp-8)' }}>
              <div className="ns-def">
                <dt>
                  <BridgeGlyph /> Bridge
                </dt>
                <dd className="ns-body">A link whose removal splits the network into more pieces.</dd>
              </div>
              <div className="ns-def">
                <dt>
                  <CutGlyph /> Articulation point
                </dt>
                <dd className="ns-body">A node whose failure disconnects nodes that remain in service.</dd>
              </div>
            </dl>
          </Cell>

          <Cell d="6 / 13" t="1 / -1" m="1 / -1">
            <div className="ns-panel ns-panel--ink" data-testid="sandbox">
              <div className="ns-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div className="ns-seg" role="radiogroup" aria-label="Example topology">
                    {PRESETS.map((p) => (
                      <button key={p.kind} type="button" role="radio" aria-checked={kind === p.kind} onClick={() => reset(p.kind)} data-cursor="Load">
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <ExampleTag />
                </div>
                <LButton size="sm" variant="outline" onClick={() => reset()} icon={<RotateCcw aria-hidden="true" />} iconPosition="start" cursor="Reset">
                  Reset
                </LButton>
              </div>

              <div style={{ padding: '8px 4px 0' }}>
                <GraphCanvas
                  nodes={nodes}
                  edges={base.edges}
                  tone="ink"
                  aspect="16 / 10"
                  className="ns-sandbox-canvas"
                  ariaLabel={`${base.name} example network. ${summary()}`}
                  onNodeActivate={toggleNode}
                  onEdgeActivate={toggleEdge}
                  onNodeMove={moveNode}
                  nodeCursor={(id) => (failedNodes.has(id) ? 'Restore' : 'Fail or drag')}
                  edgeCursor={(e) => (failedEdges.has(e.id) ? 'Restore' : 'Remove')}
                  nodeLabel={(id) => {
                    const state = failedNodes.has(id)
                      ? 'failed'
                      : `healthy, degree ${analysis.degrees[id] ?? 0}${analysis.articulationPoints.has(id) ? ', articulation point' : ''}${
                          multi ? `, component ${(analysis.componentOf.get(id) ?? 0) + 1}` : ''
                        }`
                    return `Node ${id}, ${state}`
                  }}
                  edgeLabel={(e) => `Link ${e.source} to ${e.target}, ${failedEdges.has(e.id) ? 'failed' : edgeIsDown(e) ? 'out of service' : analysis.bridgeEdgeIds.has(e.id) ? 'bridge' : 'healthy'}`}
                  nodeVisual={(id) => ({
                    failed: nodeFailedOrIsolated(id),
                    cut: analysis.articulationPoints.has(id),
                    fill: componentFill('ink', analysis.componentOf.get(id)),
                    badge: multi && !failedNodes.has(id) ? `C${(analysis.componentOf.get(id) ?? 0) + 1}` : null,
                  })}
                  edgeVisual={(e) => ({
                    failed: failedEdges.has(e.id),
                    bridge: analysis.bridgeEdgeIds.has(e.id),
                    emphasis: !failedEdges.has(e.id) && edgeIsDown(e) ? 'dim' : null,
                  })}
                />
              </div>

              <dl className="ns-readout" style={{ margin: 0 }} aria-label="Analysis results">
                <div>
                  <dt>Components</dt>
                  <dd>
                    <RollingCounter value={analysis.components.length} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Bridges</dt>
                  <dd style={analysis.bridgeEdgeIds.size ? { color: 'var(--r-400)' } : undefined}>
                    <RollingCounter value={analysis.bridgeEdgeIds.size} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Articulation pts</dt>
                  <dd style={analysis.articulationPoints.size ? { color: 'var(--r-400)' } : undefined}>
                    <RollingCounter value={analysis.articulationPoints.size} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd style={{ fontSize: '1rem', fontFamily: 'var(--font-s)', fontWeight: 600, alignItems: 'center', minHeight: '1.65rem', color: analysis.isConnected ? 'var(--s-50)' : 'var(--r-400)' }}>
                    {analysis.isConnected ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : <XIcon size={16} strokeWidth={1.5} aria-hidden="true" />}
                    {analysis.isConnected ? 'Connected' : analysis.activeNodeCount === 0 ? 'No nodes' : 'Disconnected'}
                  </dd>
                </div>
              </dl>
            </div>
            <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', justifyContent: 'space-between', alignItems: 'center' }}>
              <ul className="ns-legend" aria-label="Legend">
                <li>
                  <HealthyGlyph /> Healthy
                </li>
                <li>
                  <FailedEdgeGlyph /> Failed link
                </li>
                <li>
                  <FailedNodeGlyph /> Failed node
                </li>
                <li>
                  <BridgeGlyph /> Bridge
                </li>
                <li>
                  <CutGlyph /> Articulation point
                </li>
              </ul>
              <p className="ns-small" style={{ margin: 0 }}>
                Keyboard: Tab into the graph, arrows to move, Enter to fail or restore.
              </p>
            </div>
            <p className="sr-only" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {announcement}
            </p>
          </Cell>
        </LGrid>
      </LContainer>
    </PanelWipe>
  )
}
