import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { analyzeNetwork, exactAllTerminalReliability } from '@/lib/graphAlgorithms'
import { generateReliabilityExample } from '@/lib/seededGraphGenerator'
import { LContainer, LGrid, Cell, Eyebrow, ExampleTag } from '../components/Layout'
import { ScriptCaps, SplitLines } from '../components/SplitLines'
import { LButton } from '../components/Button'
import { RollingCounter } from '../components/RollingCounter'
import { GraphCanvas } from '../graph/GraphCanvas'
import { ConvergenceChart, SweepChart, type ConvergencePoint, type SweepPoint } from './EstimatorCharts'
import type { WorkerRequest, WorkerResponse } from '../workers/reliability.worker'

const TRIAL_OPTIONS = [100, 500, 1000, 5000]
const P_MAX = 0.5
const SWEEP_PS = Array.from({ length: 11 }, (_, i) => Math.round(i * 5) / 100)
const SWEEP_TRIALS = 1000

const newWorker = () => new Worker(new URL('../workers/reliability.worker.ts', import.meta.url), { type: 'module' })

interface Result {
  p: number
  trials: number
  seed: number
  estimate: number
  se: number
  connected: number
  exact: number | null
  ms: number
}

export function Estimator() {
  const graph = useMemo(() => generateReliabilityExample(), [])
  const analysis = useMemo(() => analyzeNetwork(graph.nodes, graph.edges), [graph])
  const [p, setP] = useState(0.1)
  const [trials, setTrials] = useState(1000)
  const [running, setRunning] = useState(false)
  const [series, setSeries] = useState<ConvergencePoint[]>([])
  const [runTrials, setRunTrials] = useState(1000)
  const [result, setResult] = useState<Result | null>(null)
  const [sweep, setSweep] = useState<SweepPoint[]>([])
  const [status, setStatus] = useState('')
  const runWorker = useRef<Worker | null>(null)
  const sweepWorker = useRef<Worker | null>(null)
  const runId = useRef(0)
  const runParams = useRef({ p: 0.1, trials: 1000, seed: 0 })
  const root = useRef<HTMLElement>(null)

  const exactCurve = useMemo(() => {
    const pts: Array<[number, number]> = []
    for (let i = 0; i <= 25; i++) {
      const q = (i / 25) * P_MAX
      pts.push([q, exactAllTerminalReliability(graph.nodes, graph.edges, q) ?? 0])
    }
    return pts
  }, [graph])

  const run = (pp = p, n = trials) => {
    const w = runWorker.current
    if (!w) return
    const id = ++runId.current
    const seed = 2024 + id
    runParams.current = { p: pp, trials: n, seed }
    setRunning(true)
    setRunTrials(n)
    setSeries([])
    setStatus(`Running ${n} trials at p = ${pp.toFixed(2)}.`)
    // About 70 batches keeps progress smooth without flooding the main thread.
    w.postMessage({ type: 'run', id, nodes: graph.nodes, edges: graph.edges, p: pp, trials: n, seed, batches: 70 } satisfies WorkerRequest)
  }
  const cancel = () => {
    runWorker.current?.postMessage({ type: 'cancel', id: runId.current } satisfies WorkerRequest)
  }

  useEffect(() => {
    const w = newWorker()
    const sw = newWorker()
    runWorker.current = w
    sweepWorker.current = sw
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data
      if (m.id !== runId.current) return
      if (m.type === 'progress') {
        setSeries((s) => [...s, { done: m.done, estimate: m.estimate, se: m.standardError }])
      } else if (m.type === 'done') {
        const { p: rp, trials: rt, seed } = runParams.current
        setResult({ p: rp, trials: rt, seed, estimate: m.estimate, se: m.standardError, connected: m.connected, exact: m.exact, ms: m.ms })
        setRunning(false)
        setStatus(`Done. ${m.connected} of ${m.done} trials stayed connected. Estimate ${m.estimate.toFixed(3)}, standard error ${m.standardError.toFixed(3)}.`)
      } else if (m.type === 'cancelled') {
        setRunning(false)
        setStatus('Run cancelled.')
      }
    }
    sw.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data
      if (m.type === 'sweep-point') setSweep((s) => [...s, { p: m.p, estimate: m.estimate, se: m.standardError }])
    }
    return () => {
      w.terminate()
      sw.terminate()
      runWorker.current = null
      sweepWorker.current = null
    }
  }, [])

  // Run once (and the sweep) when the section first comes into view: real numbers, never placeholders.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        run(0.1, 1000)
        setSweep([])
        sweepWorker.current?.postMessage({ type: 'sweep', id: 1, nodes: graph.nodes, edges: graph.edges, ps: SWEEP_PS, trials: SWEEP_TRIALS, seed: 77 } satisfies WorkerRequest)
      },
      { rootMargin: '0px 0px -20% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  const last = series[series.length - 1]
  const live = running ? last : null
  const shown = live ? { estimate: live.estimate, se: live.se } : result ? { estimate: result.estimate, se: result.se } : null
  const stale = result && !running && (result.p !== p || result.trials !== trials)

  return (
    <section ref={root} id="reliability" data-chapter="reliability" data-tone="dark" aria-labelledby="rel-title" className="ns-section ns-surface-dark">
      <LContainer>
        <LGrid style={{ rowGap: 'var(--sp-8)' }}>
          <Cell d="1 / 8" t="1 / -1" m="1 / -1" className="ns-stack" data-align="start">
            <Eyebrow>05 / Reliability estimator</Eyebrow>
            <ScriptCaps id="rel-title" accent="Monte Carlo" text="Estimate reliability." emphasis="reliability." />
          </Cell>
          <Cell d="8 / 13" t="1 / -1" m="1 / -1" style={{ alignSelf: 'end' }}>
            <SplitLines className="ns-lead">
              Each trial fails every link independently with probability p, then checks whether the whole network is still connected. The
              share of connected trials is the estimate.
            </SplitLines>
          </Cell>

          <Cell d="1 / 5" t="1 / -1" m="1 / -1" className="ns-est-controls">
            <div className="ns-panel" style={{ padding: 'var(--sp-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <label htmlFor="pfail" className="ns-micro">
                  Link failure probability
                </label>
                <output htmlFor="pfail" className="ns-num" style={{ color: 'var(--s-50)', fontSize: '1.125rem', whiteSpace: 'nowrap' }}>
                  p = {p.toFixed(2)}
                </output>
              </div>
              <input
                id="pfail"
                className="ns-range"
                type="range"
                min={0}
                max={P_MAX}
                step={0.01}
                value={p}
                disabled={running}
                onChange={(e) => setP(Number(e.target.value))}
                aria-valuetext={`p equals ${p.toFixed(2)}`}
                style={{ ['--fill' as string]: `${(p / P_MAX) * 100}%`, marginTop: 4 }}
                data-cursor="Drag"
              />
              <div className="ns-num ns-small" style={{ display: 'flex', justifyContent: 'space-between', marginTop: -6 }} aria-hidden="true">
                <span>0.00</span>
                <span>0.50</span>
              </div>

              <p className="ns-micro" id="trials-label" style={{ margin: 'var(--sp-5) 0 var(--sp-2)' }}>
                Trials
              </p>
              <div className="ns-seg" role="radiogroup" aria-labelledby="trials-label" style={{ width: '100%' }}>
                {TRIAL_OPTIONS.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={trials === n} disabled={running} onClick={() => setTrials(n)}>
                    {n}
                  </button>
                ))}
              </div>

              <div className="ns-btn-pair" style={{ marginTop: 'var(--sp-5)' }}>
                <LButton variant="primary" onClick={() => run()} disabled={running} icon={<Play aria-hidden="true" />} iconPosition="start" cursor="Run" style={{ flex: 1 }}>
                  {running ? 'Running' : 'Run trials'}
                </LButton>
                <LButton variant="outline" onClick={cancel} disabled={!running} icon={<Square aria-hidden="true" />} iconPosition="start" cursor="Cancel">
                  Cancel
                </LButton>
              </div>

              <div className="ns-hair-top" style={{ marginTop: 'var(--sp-5)', paddingTop: 'var(--sp-4)' }}>
                <p className="ns-micro" style={{ margin: '0 0 var(--sp-2)' }}>
                  Assumptions
                </p>
                <ul className="ns-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                  <li>Links fail independently, each with probability p.</li>
                  <li>Nodes never fail in this estimator.</li>
                  <li>Success means all {graph.nodes.length} nodes stay connected.</li>
                  <li>N = {trials} trials, seeded and reproducible.</li>
                </ul>
              </div>
            </div>
          </Cell>

          <Cell d="5 / 13" t="1 / -1" m="1 / -1">
            <div className="ns-panel ns-panel--ink" data-testid="estimator">
              <div className="ns-est-top">
                <div className="ns-est-graph">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 12px 0' }}>
                    <span className="ns-micro">
                      {graph.nodes.length} nodes, {graph.edges.length} links
                    </span>
                    <ExampleTag />
                  </div>
                  <GraphCanvas
                    nodes={graph.nodes}
                    edges={graph.edges}
                    tone="ink"
                    aspect="4 / 3"
                    padding={28}
                    ariaLabel={`Example network with ${graph.nodes.length} nodes and ${graph.edges.length} links, two clusters joined by ${analysis.bridgeEdgeIds.size} bridge.`}
                    edgeVisual={(e) => ({ bridge: analysis.bridgeEdgeIds.has(e.id) })}
                    nodeVisual={(id) => ({ cut: analysis.articulationPoints.has(id) })}
                  />
                </div>
                <dl className="ns-est-stats" style={{ margin: 0 }} aria-live="off">
                  <div>
                    <dt className="ns-micro">Trials</dt>
                    <dd className="ns-num" style={{ fontSize: '1.5rem', color: 'var(--s-50)' }} data-testid="trial-count">
                      <RollingCounter value={last ? last.done : 0} pad={4} />
                      <span className="ns-small" style={{ marginLeft: 8 }}>
                        / {runTrials}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="ns-micro">Estimate R</dt>
                    <dd className="ns-num" style={{ fontSize: 'clamp(2.5rem, 2rem + 2vw, 3.5rem)', lineHeight: 1, color: 'var(--s-50)' }} data-testid="estimate">
                      {shown ? shown.estimate.toFixed(3) : '0.000'}
                    </dd>
                    <dd className="ns-num ns-small" style={{ marginTop: 6 }}>
                      {shown ? `SE ${shown.se.toFixed(4)}, 95% [${Math.max(0, shown.estimate - 1.96 * shown.se).toFixed(3)}, ${Math.min(1, shown.estimate + 1.96 * shown.se).toFixed(3)}]` : 'Not run yet'}
                    </dd>
                  </div>
                  <div>
                    <dt className="ns-micro">Exact, all 2^{graph.edges.length} states</dt>
                    <dd className="ns-num" style={{ fontSize: '1.125rem', color: 'var(--s-100)' }} data-testid="exact">
                      {result?.exact != null ? result.exact.toFixed(4) : (exactAllTerminalReliability(graph.nodes, graph.edges, p) ?? 0).toFixed(4)}
                    </dd>
                    <dd className="ns-small" style={{ marginTop: 4 }}>
                      {result ? `Seed ${result.seed}, ${result.ms.toFixed(0)} ms in a worker` : 'Exact enumeration for comparison'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="ns-hair-top" style={{ padding: '16px 12px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="ns-micro">Running estimate</span>
                  <span className="ns-micro" style={{ color: stale ? 'var(--r-400)' : undefined }}>
                    {stale ? 'Settings changed, run again' : 'Dashed: exact value. Band: 95% interval'}
                  </span>
                </div>
                <ConvergenceChart points={series} trials={runTrials} exact={result?.exact ?? (running ? exactAllTerminalReliability(graph.nodes, graph.edges, runParams.current.p) : null)} />
              </div>
              <div className="ns-hair-top" style={{ padding: '16px 12px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="ns-micro">Reliability against p</span>
                  <span className="ns-micro">
                    {sweep.length} of {SWEEP_PS.length} runs, {SWEEP_TRIALS} trials each. Line: exact
                  </span>
                </div>
                <SweepChart points={sweep} exactCurve={exactCurve} currentP={p} pMax={P_MAX} />
              </div>
            </div>
            <p aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {status}
            </p>
          </Cell>
        </LGrid>
      </LContainer>
    </section>
  )
}
