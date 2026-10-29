import { useMemo, useState } from 'react'
import { analyzeNetwork } from '@/lib/graphAlgorithms'
import { generatePreset, type PresetKind } from '@/lib/seededGraphGenerator'
import { PanelWipe } from '../components/PanelWipe'
import { LContainer, LGrid, Cell, Eyebrow, ExampleTag } from '../components/Layout'
import { ScriptCaps } from '../components/SplitLines'
import { BigWordList } from '../components/BigWordList'
import { RollingCounter } from '../components/RollingCounter'
import { GraphFrame } from '../components/GraphFrame'
import { GraphCanvas } from '../graph/GraphCanvas'

const KINDS: PresetKind[] = ['star', 'ring', 'mesh']
const NOTES: Record<PresetKind, string> = {
  star: 'Every link reaches the hub, so every link is a bridge and the hub is the single articulation point.',
  ring: 'Each node has two independent routes. One failure leaves a path; two failures split the ring.',
  mesh: 'Redundant links absorb single failures. Only the pendant link and its anchor remain critical.',
}

export function Topologies() {
  const [i, setI] = useState(0)
  const data = useMemo(
    () =>
      KINDS.map((k) => {
        const g = generatePreset(k, 7)
        return { g, a: analyzeNetwork(g.nodes, g.edges) }
      }),
    []
  )
  const { g, a } = data[i]
  return (
    <PanelWipe tone="silver" id="topologies" chapter="topologies" labelledBy="topologies-title">
      <LContainer>
        <LGrid style={{ rowGap: 'var(--sp-8)' }}>
          <Cell d="1 / 7" t="1 / -1" m="1 / -1" className="ns-stack" data-align="start">
            <Eyebrow>04 / Topologies</Eyebrow>
            <ScriptCaps id="topologies-title" accent="Shape decides" text="Three classic layouts." />
            <BigWordList words={data.map((d) => d.g.name)} selected={i} onSelect={setI} controls="topology-panel" label="Topology" />
          </Cell>
          <Cell d="7 / 13" t="1 / -1" m="1 / -1">
            <div id="topology-panel" role="tabpanel" aria-labelledby={`topology-panel-tab-${i}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
                <span className="ns-micro ns-num" aria-hidden="true">
                  <RollingCounter value={i + 1} pad={2} /> / 03
                </span>
                <ExampleTag>Example, seed 7</ExampleTag>
              </div>
              <GraphFrame aspect="4 / 3" style={{ borderTop: '1px solid var(--hair)', borderBottom: '1px solid var(--hair)' }}>
                {data.map((d, k) => (
                  <div
                    key={d.g.name}
                    aria-hidden={k !== i}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: k === i ? 1 : 0,
                      transform: k === i ? 'none' : 'scale(0.96)',
                      transition: 'opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <GraphCanvas
                      nodes={d.g.nodes}
                      edges={d.g.edges}
                      tone="paper"
                      aspect="4 / 3"
                      ariaLabel={`${d.g.name} example: ${d.g.nodes.length} nodes, ${d.g.edges.length} links, ${d.a.bridgeEdgeIds.size} bridges.`}
                      nodeVisual={(id) => ({ cut: d.a.articulationPoints.has(id) })}
                      edgeVisual={(e) => ({ bridge: d.a.bridgeEdgeIds.has(e.id) })}
                    />
                  </div>
                ))}
              </GraphFrame>
              <dl className="ns-readout" style={{ margin: 0, borderTop: 0 }}>
                <div>
                  <dt>Nodes</dt>
                  <dd>
                    <RollingCounter value={g.nodes.length} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Edges</dt>
                  <dd>
                    <RollingCounter value={g.edges.length} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Density</dt>
                  <dd>
                    <RollingCounter value={a.density} decimals={2} pad={1} />
                  </dd>
                </div>
                <div>
                  <dt>Bridges</dt>
                  <dd style={a.bridgeEdgeIds.size ? { color: 'var(--r-600)' } : undefined}>
                    <RollingCounter value={a.bridgeEdgeIds.size} pad={2} />
                  </dd>
                </div>
              </dl>
              <p className="ns-body" style={{ marginTop: 'var(--sp-5)' }}>
                {NOTES[KINDS[i]]}
              </p>
              <p className="ns-small" style={{ marginTop: 'var(--sp-2)' }}>
                Computed: {a.articulationPoints.size} articulation {a.articulationPoints.size === 1 ? 'point' : 'points'}, density = 2|E| / (|V|(|V| - 1)).
              </p>
            </div>
          </Cell>
        </LGrid>
      </LContainer>
    </PanelWipe>
  )
}
