import { useEffect, useMemo, useState } from 'react'
import gsap from 'gsap'
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { bfsLayers, buildActiveGraph, dfsTree, findShortestPath } from '@/lib/graphAlgorithms'
import { generateLatticeGraph } from '@/lib/seededGraphGenerator'
import { PanelWipe } from '../components/PanelWipe'
import { LContainer, LGrid, Cell, Eyebrow, ExampleTag } from '../components/Layout'
import { ScriptCaps, SplitLines } from '../components/SplitLines'
import { Tooltip } from '../components/Tooltip'
import { RollingCounter } from '../components/RollingCounter'
import { GraphCanvas, type NodeVisual } from '../graph/GraphCanvas'

type Mode = 'bfs' | 'dfs'
const SPEEDS = [0.5, 1, 2]

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Walk parent pointers from target back to source. */
function treePath(parent: Map<string, string>, source: string, target: string): string[] | null {
  const path = [target]
  let cur = target
  while (cur !== source) {
    const p = parent.get(cur)
    if (!p) return null
    path.unshift(p)
    cur = p
  }
  return path
}

export function Explorer() {
  const graph = useMemo(() => generateLatticeGraph(11, 5, 3, 0.84, 0.2), [])
  const active = useMemo(() => buildActiveGraph(graph.nodes, graph.edges, new Set(), new Set()), [graph])
  const ids = graph.nodes.map((n) => n.id)
  const [source, setSource] = useState(ids[0])
  const [target, setTarget] = useState(ids[ids.length - 1])
  const [mode, setMode] = useState<Mode>('bfs')
  const [frame, setFrame] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [nextPick, setNextPick] = useState<'source' | 'target'>('source')

  const run = useMemo(() => {
    if (mode === 'bfs') {
      const { order, layer, parent } = bfsLayers(active, source)
      const depth = Math.max(0, ...layer.values())
      const path = findShortestPath(active, source, target)
      return { order, layer, parent, frames: depth + 2, path, depth }
    }
    const { order, parent } = dfsTree(active, source)
    return { order, layer: new Map<string, number>(), parent, frames: order.length + 1, path: treePath(parent, source, target), depth: 0 }
  }, [mode, active, source, target])

  const lastFrame = run.frames - 1
  const done = frame >= lastFrame

  // Playback on the shared gsap ticker (no extra timers).
  useEffect(() => {
    if (!playing || frame >= lastFrame) return
    const call = gsap.delayedCall(0.7 / speed, () => {
      setFrame((f) => Math.min(lastFrame, f + 1))
      if (frame + 1 >= lastFrame) setPlaying(false)
    })
    return () => {
      call.kill()
    }
  }, [playing, frame, lastFrame, speed])

  const restart = () => {
    setFrame(-1)
    setPlaying(false)
  }
  const play = () => {
    if (done) setFrame(-1)
    setPlaying((p) => !p || done)
  }
  const pick = (id: string) => {
    if (nextPick === 'source') {
      if (id === target) setTarget(source)
      setSource(id)
      setNextPick('target')
    } else {
      if (id === source) setSource(target)
      setTarget(id)
      setNextPick('source')
    }
    restart()
  }

  // Visible state for the current frame.
  const visited = new Set<string>()
  const badge = new Map<string, string>()
  let frontier = new Set<string>()
  if (mode === 'bfs') {
    const upto = Math.min(frame, run.depth)
    for (const [id, l] of run.layer) {
      if (l <= upto) {
        visited.add(id)
        badge.set(id, String(l))
      }
    }
    frontier = new Set([...run.layer].filter(([, l]) => l === upto && frame <= run.depth).map(([id]) => id))
  } else {
    const upto = Math.min(frame, run.order.length - 1)
    run.order.slice(0, upto + 1).forEach((id, i) => {
      visited.add(id)
      badge.set(id, String(i + 1))
    })
    if (frame <= run.order.length - 1 && upto >= 0) frontier = new Set([run.order[upto]])
  }
  const treeEdges = new Set<string>()
  for (const id of visited) {
    const p = run.parent.get(id)
    if (p && visited.has(p)) treeEdges.add(edgeKey(p, id))
  }
  const pathEdges = new Set<string>()
  if (done && run.path) for (let i = 1; i < run.path.length; i++) pathEdges.add(edgeKey(run.path[i - 1], run.path[i]))

  const nodeVisual = (id: string): NodeVisual => ({
    emphasis: id === source ? 'source' : id === target ? 'target' : frontier.has(id) ? 'frontier' : visited.has(id) ? 'visited' : null,
    badge: badge.get(id) ?? null,
  })

  const hops = run.path ? run.path.length - 1 : null
  const statusText =
    frame < 0
      ? `Ready. ${mode === 'bfs' ? 'Breadth first' : 'Depth first'} search from ${source} to ${target}.`
      : done
        ? mode === 'bfs'
          ? `Shortest path ${source} to ${target}: ${hops} hops, ${run.path?.join(', ')}.`
          : `DFS tree path ${source} to ${target}: ${hops} hops, ${run.path?.join(', ')}.`
        : mode === 'bfs'
          ? `Layer ${Math.min(frame, run.depth)}: ${[...frontier].join(', ')}.`
          : `Visited ${frame + 1}: ${run.order[frame]}.`

  return (
    <PanelWipe tone="silver" id="paths" chapter="paths" labelledBy="paths-title">
      <LContainer>
        <LGrid style={{ rowGap: 'var(--sp-8)' }}>
          <Cell d="1 / 5" t="1 / -1" m="1 / -1" className="ns-stack" data-align="start">
            <Eyebrow>06 / Paths and traversal</Eyebrow>
            <ScriptCaps id="paths-title" accent="Search" text="Trace every route." />
            <SplitLines className="ns-lead">
              Breadth first search expands in layers and finds the shortest route. Depth first search dives along one branch first. Pick two
              nodes and compare them.
            </SplitLines>

            <div className="ns-panel" style={{ padding: 'var(--sp-5)', ['--stack' as string]: 'var(--sp-7)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="ns-micro" style={{ display: 'grid', gap: 6 }}>
                  Source
                  <select className="ns-select" value={source} onChange={(e) => pick2('source', e.target.value)}>
                    {ids.map((id) => (
                      <option key={id} value={id} disabled={id === target}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ns-micro" style={{ display: 'grid', gap: 6 }}>
                  Target
                  <select className="ns-select" value={target} onChange={(e) => pick2('target', e.target.value)}>
                    {ids.map((id) => (
                      <option key={id} value={id} disabled={id === source}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="ns-micro" id="mode-label" style={{ margin: 'var(--sp-5) 0 var(--sp-2)' }}>
                Algorithm
              </p>
              <div className="ns-seg" role="radiogroup" aria-labelledby="mode-label" style={{ width: '100%' }}>
                {(['bfs', 'dfs'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => {
                      setMode(m)
                      restart()
                    }}
                  >
                    {m === 'bfs' ? 'Breadth first' : 'Depth first'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Tooltip label={playing ? 'Pause' : done ? 'Replay' : 'Play'}>
                    <button type="button" className="ns-icon-btn" aria-label={playing ? 'Pause' : done ? 'Replay' : 'Play'} onClick={play} data-testid="play">
                      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    </button>
                  </Tooltip>
                  <Tooltip label="Step">
                    <button
                      type="button"
                      className="ns-icon-btn"
                      aria-label="Step"
                      disabled={done}
                      data-testid="step"
                      onClick={() => {
                        setPlaying(false)
                        setFrame((f) => Math.min(lastFrame, f + 1))
                      }}
                    >
                      <StepForward aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip label="Reset">
                    <button type="button" className="ns-icon-btn" aria-label="Reset" onClick={restart} disabled={frame < 0}>
                      <RotateCcw aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
                <div className="ns-seg" role="radiogroup" aria-label="Speed">
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)} style={{ minWidth: 48 }}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Cell>

          <Cell d="5 / 13" t="1 / -1" m="1 / -1">
            <div className="ns-panel" style={{ background: 'var(--s-50)' }} data-testid="explorer">
              <div className="ns-toolbar">
                <span className="ns-micro">
                  {nextPick === 'source' ? 'Tap a node to set the source' : 'Tap a node to set the target'}
                </span>
                <ExampleTag>Example, seed 11</ExampleTag>
              </div>
              <GraphCanvas
                nodes={graph.nodes}
                edges={graph.edges}
                tone="paper"
                aspect="16 / 9"
                ariaLabel={`Example network, ${graph.nodes.length} nodes. ${statusText}`}
                onNodeActivate={pick}
                nodeCursor={() => (nextPick === 'source' ? 'Source' : 'Target')}
                nodeLabel={(id) =>
                  `Node ${id}${id === source ? ', source' : id === target ? ', target' : ''}${badge.has(id) ? (mode === 'bfs' ? `, layer ${badge.get(id)}` : `, visit ${badge.get(id)}`) : ''}. Activate to set as ${nextPick}.`
                }
                nodeVisual={nodeVisual}
                edgeVisual={(e) => {
                  const k = edgeKey(e.source, e.target)
                  return { emphasis: pathEdges.has(k) ? 'path' : treeEdges.has(k) ? 'tree' : visited.size ? 'dim' : null }
                }}
              />
              <dl className="ns-readout" style={{ margin: 0 }}>
                <div>
                  <dt>{mode === 'bfs' ? 'Layer' : 'Step'}</dt>
                  <dd>
                    <RollingCounter value={Math.max(0, mode === 'bfs' ? Math.min(frame, run.depth) : Math.min(frame + 1, run.order.length))} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Visited</dt>
                  <dd>
                    <RollingCounter value={visited.size} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>{mode === 'bfs' ? 'Shortest' : 'Tree path'}</dt>
                  <dd>{done && hops !== null ? <RollingCounter value={hops} pad={2} /> : <span className="ns-small" style={{ fontFamily: 'var(--font-s)' }}>Pending</span>}</dd>
                </div>
                <div>
                  <dt>Reachable</dt>
                  <dd>
                    <RollingCounter value={run.order.length} pad={2} />
                  </dd>
                </div>
              </dl>
              <p className="ns-num ns-small" style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--hair)', margin: 0, color: 'var(--c-700)' }} data-testid="explorer-status">
                {statusText}
              </p>
            </div>
            <p aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {statusText}
            </p>
          </Cell>
        </LGrid>
      </LContainer>
    </PanelWipe>
  )

  function pick2(which: 'source' | 'target', id: string) {
    if (which === 'source') setSource(id)
    else setTarget(id)
    restart()
  }
}
