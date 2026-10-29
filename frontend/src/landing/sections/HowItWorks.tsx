import { useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { analyzeNetwork } from '@/lib/graphAlgorithms'
import { generateLatticeGraph } from '@/lib/seededGraphGenerator'
import { LContainer, LGrid, Cell, Eyebrow, ExampleTag } from '../components/Layout'
import { ScriptCaps } from '../components/SplitLines'
import { SegmentProgress, type SegmentProgressHandle } from '../components/SegmentProgress'
import { RollingCounter } from '../components/RollingCounter'
import { Tooltip } from '../components/Tooltip'
import { GraphCanvas } from '../graph/GraphCanvas'
import { componentFill } from '../graph/palette'
import { SCRUB, motionEnabled, scrollToTarget } from '../motion/engine'

const STEPS = [
  {
    title: 'Model the network',
    body: 'Routers, servers and links become vertices and edges. From here on the structure decides what survives, not the hardware.',
  },
  {
    title: 'Introduce failures',
    body: 'Take a node or a link out of service. A failed node removes every link attached to it, so one fault can cut several paths at once.',
  },
  {
    title: 'Measure connectivity',
    body: 'Count the pieces that remain, then find the bridges and articulation points whose loss would split them further.',
  },
]

/** Deterministic failure choice computed from the graph: the most damaging node, then the link that leaves the most bridges. */
function chooseFailures(nodes: { id: string; label: string }[], edges: { id: string; source: string; target: string }[]) {
  let bestNode = nodes[0].id
  let bestScore = -1
  const base = analyzeNetwork(nodes, edges)
  for (const n of nodes) {
    const a = analyzeNetwork(nodes, edges, new Set([n.id]))
    const score = a.components.length * 100 + (base.degrees[n.id] ?? 0)
    if (score > bestScore) {
      bestScore = score
      bestNode = n.id
    }
  }
  const fn = new Set([bestNode])
  const before = analyzeNetwork(nodes, edges, fn)
  let bestEdge = ''
  let bestBridges = -1
  for (const e of edges) {
    if (e.source === bestNode || e.target === bestNode || before.bridgeEdgeIds.has(e.id)) continue
    const a = analyzeNetwork(nodes, edges, fn, new Set([e.id]))
    if (a.components.length === before.components.length && a.bridgeEdgeIds.size > bestBridges) {
      bestBridges = a.bridgeEdgeIds.size
      bestEdge = e.id
    }
  }
  return { failedNodes: fn, failedEdges: new Set(bestEdge ? [bestEdge] : []) }
}

export function HowItWorks() {
  const graph = useMemo(() => generateLatticeGraph(5, 5, 3, 0.86, 0.28), [])
  const failures = useMemo(() => chooseFailures(graph.nodes, graph.edges), [graph])
  const [index, setIndex] = useState(0)
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const progress = useRef<SegmentProgressHandle>(null)
  const pinned = useRef<ScrollTrigger | null>(null)

  const state = useMemo(() => {
    const fn = index >= 1 ? failures.failedNodes : new Set<string>()
    const fe = index >= 1 ? failures.failedEdges : new Set<string>()
    return { fn, fe, a: analyzeNetwork(graph.nodes, graph.edges, fn, fe) }
  }, [index, failures, graph])

  const renderTrack = (pos: number, fromScroll: boolean) => {
    const el = track.current
    if (!el) return
    el.style.transition = fromScroll ? 'none' : ''
    el.style.transform = `translate3d(${(-pos * 100).toFixed(3)}%, 0, 0)`
    const slides = el.children
    for (let i = 0; i < slides.length; i++) {
      const d = i - pos
      const s = slides[i] as HTMLElement
      s.style.transition = fromScroll ? 'none' : ''
      s.style.opacity = String(Math.max(0, 1 - Math.abs(d) * 0.85).toFixed(3))
      const inner = s.firstElementChild as HTMLElement
      inner.style.transition = fromScroll ? 'none' : ''
      inner.style.transform = Math.abs(d) < 0.001 ? 'none' : `translate3d(${(d * 48).toFixed(2)}px, 0, 0) rotateY(${(Math.max(-1, Math.min(1, d)) * -10).toFixed(2)}deg)`
    }
    progress.current?.set(pos + 1)
  }

  useGSAP(
    () => {
      const el = section.current
      if (!el) return
      renderTrack(0, false)
      if (!motionEnabled()) return
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (min-height: 640px)', () => {
        const proxy = { pos: 0 }
        let last = 0
        const tween = gsap.to(proxy, {
          pos: STEPS.length - 1,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: () => `+=${Math.round((STEPS.length - 1) * window.innerHeight * 0.75)}`,
            pin: true,
            scrub: SCRUB,
            invalidateOnRefresh: true,
          },
          onUpdate: () => {
            renderTrack(proxy.pos, true)
            const i = Math.round(proxy.pos)
            if (i !== last) {
              last = i
              setIndex(i)
            }
          },
        })
        pinned.current = tween.scrollTrigger ?? null
        return () => {
          pinned.current = null
          renderTrack(0, false)
          setIndex(0)
        }
      })
      return () => mm.revert()
    },
    { scope: section }
  )

  const go = (i: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, i))
    const st = pinned.current
    if (st) {
      scrollToTarget(Math.round(st.start + (next / (STEPS.length - 1)) * (st.end - st.start)) + 1)
      return
    }
    setIndex(next)
    renderTrack(next, false)
  }

  const a = state.a
  return (
    <section ref={section} id="how" data-chapter="how" data-tone="dark" aria-labelledby="how-title" className="ns-section ns-surface-dark ns-how">
      <LContainer className="ns-how__inner">
        <LGrid>
          <Cell d="1 / -1" t="1 / -1" m="1 / -1" className="ns-stack" data-align="start" style={{ ['--stack' as string]: 'var(--sp-4)' }}>
            <Eyebrow>03 / How it works</Eyebrow>
            <ScriptCaps id="how-title" accent="Three steps" text="Model. Fail. Measure." emphasis="Fail." />
          </Cell>
        </LGrid>

        <LGrid style={{ rowGap: 'var(--sp-6)', marginTop: 'var(--sp-7)', alignItems: 'start' }} className="ns-how__body">
          <Cell d="1 / 8" t="1 / -1" m="1 / -1" className="ns-how__visual">
            <div className="ns-panel ns-panel--ink">
              <GraphCanvas
                nodes={graph.nodes}
                edges={graph.edges}
                tone="ink"
                aspect="16 / 9"
                drawKey={index === 0 ? 'model' : undefined}
                ariaLabel={`Example network, step ${index + 1}: ${STEPS[index].title}. ${a.activeNodeCount} nodes and ${a.activeEdgeCount} links in service, ${a.components.length} components${
                  index === 2 ? `, ${a.bridgeEdgeIds.size} bridges, ${a.articulationPoints.size} articulation points` : ''
                }.`}
                nodeVisual={(id) => ({
                  failed: state.fn.has(id),
                  cut: index === 2 && a.articulationPoints.has(id),
                  fill: index === 2 ? componentFill('ink', a.componentOf.get(id)) : undefined,
                  badge: index === 2 && a.components.length > 1 && !state.fn.has(id) ? `C${(a.componentOf.get(id) ?? 0) + 1}` : null,
                })}
                edgeVisual={(e) => ({
                  failed: state.fe.has(e.id),
                  bridge: index === 2 && a.bridgeEdgeIds.has(e.id),
                  emphasis: !state.fe.has(e.id) && (state.fn.has(e.source) || state.fn.has(e.target)) ? 'dim' : null,
                })}
              />
              <dl className="ns-readout" style={{ margin: 0 }}>
                <div>
                  <dt>Nodes up</dt>
                  <dd>
                    <RollingCounter value={a.activeNodeCount} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Links up</dt>
                  <dd>
                    <RollingCounter value={a.activeEdgeCount} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Components</dt>
                  <dd style={a.components.length > 1 ? { color: 'var(--r-400)' } : undefined}>
                    <RollingCounter value={a.components.length} pad={2} />
                  </dd>
                </div>
                <div>
                  <dt>Bridges</dt>
                  <dd style={index === 2 && a.bridgeEdgeIds.size ? { color: 'var(--r-400)' } : undefined}>
                    <RollingCounter value={a.bridgeEdgeIds.size} pad={2} />
                  </dd>
                </div>
              </dl>
            </div>
          </Cell>

          <Cell d="8 / 13" t="1 / -1" m="1 / -1" className="ns-how__steps">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
              <span className="ns-micro ns-num" aria-hidden="true">
                Step <RollingCounter value={index + 1} pad={2} /> / 03
              </span>
              <ExampleTag />
            </div>
            <SegmentProgress ref={progress} count={STEPS.length} value={index + 1} label="Story progress" />
            <div className="ns-track-mask" style={{ perspective: 900, marginTop: 'var(--sp-6)' }}>
              <div ref={track} className="ns-track" style={{ display: 'flex', transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
                {STEPS.map((s, i) => (
                  <div
                    key={s.title}
                    role="group"
                    aria-roledescription="step"
                    aria-label={`Step ${i + 1} of 3`}
                    aria-hidden={i !== index}
                    style={{ flex: '0 0 100%', minWidth: 0, transition: 'opacity 500ms ease' }}
                  >
                    <div style={{ transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1)', transformOrigin: '0 50%', paddingRight: 8 }}>
                      <p className="ns-num" style={{ fontSize: '3.5rem', lineHeight: 1, margin: 0, color: 'var(--s-50)' }}>
                        0{i + 1}
                      </p>
                      <h3 className="ns-h3" style={{ marginTop: 'var(--sp-4)' }}>
                        {s.title}
                      </h3>
                      <p className="ns-body" style={{ marginTop: 'var(--sp-3)' }}>
                        {s.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'var(--sp-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
              <ol className="ns-seg" aria-label="Steps" style={{ listStyle: 'none', margin: 0 }}>
                {STEPS.map((s, i) => (
                  <li key={s.title} style={{ display: 'contents' }}>
                    <button type="button" aria-pressed={i === index} aria-label={`0${i + 1}, ${s.title}`} onClick={() => go(i)} data-cursor="Step">
                      0{i + 1}
                    </button>
                  </li>
                ))}
              </ol>
              <div style={{ display: 'flex', gap: 8 }}>
                <Tooltip label="Previous step">
                  <button type="button" className="ns-icon-btn" aria-label="Previous step" disabled={index === 0} onClick={() => go(index - 1)}>
                    <ArrowLeft aria-hidden="true" />
                  </button>
                </Tooltip>
                <Tooltip label="Next step">
                  <button type="button" className="ns-icon-btn" aria-label="Next step" disabled={index === STEPS.length - 1} onClick={() => go(index + 1)}>
                    <ArrowRight aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            </div>
            <p aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {`Step ${index + 1} of 3: ${STEPS[index].title}.`}
            </p>
          </Cell>
        </LGrid>
      </LContainer>
    </section>
  )
}
