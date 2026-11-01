import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { LContainer, LGrid, Cell, Eyebrow } from '../components/Layout'
import { ScriptCaps } from '../components/SplitLines'
import { SegmentProgress } from '../components/SegmentProgress'
import { Tooltip } from '../components/Tooltip'
import { DUR, motionEnabled } from '../motion/engine'

const PAGES = [
  {
    title: 'The graph model',
    body: [
      'A network is an undirected graph G = (V, E). Vertices are devices and edges are links. A failed vertex takes every edge attached to it out of service.',
      'Connectivity is checked with breadth first search in O(|V| + |E|). Bridges and articulation points come from depth first search with low link values (Tarjan), in the same time bound.',
    ],
    formula: 'G = (V, E)',
  },
  {
    title: 'Failures and trials',
    body: [
      'Each link fails independently with probability p. One trial samples every link, removes the failed ones and records whether all vertices are still in one component.',
      'The trial is repeated N times with a seeded random generator, so a run can be reproduced exactly. The studio caps a run at 5000 trials.',
    ],
    formula: 'P(link down) = p',
  },
  {
    title: 'Estimate and uncertainty',
    body: [
      'If k of N trials stay connected, the estimate is R = k / N with standard error SE = sqrt(R(1 - R) / N). The 95% interval is R plus or minus 1.96 SE.',
      'More trials narrow the interval, but they never remove the assumptions. On graphs this small the page also enumerates all 2^|E| link states to show the exact value beside the estimate.',
    ],
    formula: 'R = k / N',
  },
]

export function Method() {
  const [page, setPage] = useState(0)
  const stage = useRef<HTMLDivElement>(null)

  const wipe = useRef<gsap.core.Timeline | null>(null)
  useEffect(() => () => void wipe.current?.kill(), [])

  const go = (next: number) => {
    if (next === page || next < 0 || next >= PAGES.length) return
    const el = stage.current
    if (!el || !motionEnabled()) {
      setPage(next)
      return
    }
    // Wipe the page out toward the direction of travel, swap, wipe in.
    const dir = next > page ? 1 : -1
    wipe.current?.progress(1).kill()
    wipe.current = gsap
      .timeline({
        onStart: () => {
          el.style.willChange = 'clip-path'
        },
        onComplete: () => {
          el.style.willChange = 'auto'
        },
      })
      .to(el, { clipPath: dir > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)', duration: DUR.wipe / 2.4, ease: 'nsWipe' })
      .add(() => setPage(next))
      .fromTo(
        el,
        { clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: DUR.wipe / 1.8, ease: 'nsWipe', clearProps: 'clipPath' }
      )
  }

  const p = PAGES[page]
  return (
    <section id="method" data-chapter="method" data-tone="dark" aria-labelledby="method-title" className="ns-section ns-surface-dark" style={{ borderTop: '1px solid var(--c-700)' }}>
      <LContainer>
        <LGrid style={{ rowGap: 'var(--sp-8)' }}>
          <Cell d="1 / 6" t="1 / -1" m="1 / -1" className="ns-stack" data-align="start">
            <Eyebrow>07 / Method</Eyebrow>
            <ScriptCaps id="method-title" accent="How the numbers are made" text="No magic, just counting." />
            <p className="ns-body">
              This is the procedure behind every reliability figure in NetShield. In the studio, the FastAPI service computes it with
              NetworkX; this page runs the same definitions in the browser.
            </p>
          </Cell>
          <Cell d="6 / 13" t="1 / -1" m="1 / -1">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 'var(--sp-4)' }}>
              <div role="tablist" aria-label="Method pages" className="ns-seg">
                {PAGES.map((pg, i) => (
                  <button
                    key={pg.title}
                    type="button"
                    role="tab"
                    id={`method-tab-${i}`}
                    aria-selected={i === page}
                    aria-controls="method-page"
                    tabIndex={i === page ? 0 : -1}
                    onClick={() => go(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault()
                        const n = (page + (e.key === 'ArrowRight' ? 1 : -1) + PAGES.length) % PAGES.length
                        go(n)
                        document.getElementById(`method-tab-${n}`)?.focus()
                      }
                    }}
                  >
                    0{i + 1}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Tooltip label="Previous page">
                  <button type="button" className="ns-icon-btn" aria-label="Previous page" disabled={page === 0} onClick={() => go(page - 1)}>
                    <ArrowLeft aria-hidden="true" />
                  </button>
                </Tooltip>
                <Tooltip label="Next page">
                  <button type="button" className="ns-icon-btn" aria-label="Next page" disabled={page === PAGES.length - 1} onClick={() => go(page + 1)}>
                    <ArrowRight aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            </div>
            <SegmentProgress count={PAGES.length} value={page + 1} label="Method page" />

            <div ref={stage} id="method-page" role="tabpanel" aria-labelledby={`method-tab-${page}`} style={{ marginTop: 'var(--sp-7)' }}>
              <div className="ns-method-page">
                <p className="ns-num" style={{ margin: 0, color: 'var(--s-500)', fontSize: '0.875rem' }} aria-hidden="true">
                  {String(page + 1).padStart(2, '0')} / {String(PAGES.length).padStart(2, '0')}
                </p>
                <h3 className="ns-h3" style={{ marginTop: 'var(--sp-3)' }}>
                  {p.title}
                </h3>
                <div className="ns-stack" style={{ marginTop: 'var(--sp-4)', ['--stack' as string]: 'var(--sp-4)' }}>
                  {p.body.map((t) => (
                    <p key={t} className="ns-body">
                      {t}
                    </p>
                  ))}
                </div>
                <p className="ns-num" style={{ marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--c-700)', color: 'var(--s-50)', fontSize: '1.25rem' }}>
                  {p.formula}
                </p>
              </div>
            </div>
          </Cell>
        </LGrid>
      </LContainer>
    </section>
  )
}
