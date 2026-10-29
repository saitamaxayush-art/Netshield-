import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight } from 'lucide-react'
import { LContainer, LGrid, Cell, Eyebrow } from '../components/Layout'
import { ScriptCaps } from '../components/SplitLines'
import { LButtonLink, Magnetic } from '../components/Button'
import { SCRUB, motionEnabled } from '../motion/engine'
import { createMulberry32 } from '@/lib/seededGraphGenerator'

/**
 * Final call to action. A seeded network trace runs down the right side
 * and across to the button; scroll draws it, so the line arrives at the
 * button as the section settles.
 */
export function FinalCta() {
  const section = useRef<HTMLElement>(null)
  const button = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [geo, setGeo] = useState<{ w: number; h: number; d: string; joints: Array<[number, number, number]>; end: [number, number] } | null>(null)

  useLayoutEffect(() => {
    const el = section.current
    const btn = button.current
    if (!el || !btn) return
    const build = () => {
      const r = el.getBoundingClientRect()
      const b = btn.getBoundingClientRect()
      const end: [number, number] = [b.right - r.left + 12, b.top - r.top + b.height / 2]
      const rng = createMulberry32(31)
      const x0 = r.width * 0.86
      const pts: Array<[number, number]> = [[x0, 0]]
      // Orthogonal route with seeded jogs: down the right side, then left to the button.
      let x = x0
      let y = 0
      const steps = 4
      for (let i = 1; i <= steps; i++) {
        y = (end[1] - 40) * (i / steps)
        pts.push([x, y])
        if (i < steps) {
          x = x0 + (rng() - 0.5) * r.width * 0.12
          pts.push([x, y])
        }
      }
      pts.push([x, end[1]])
      pts.push(end)
      const d = `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}`
      // Fraction of total length at every corner, for the node fade in.
      const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
      const total = seg.reduce((a, b) => a + b, 0) || 1
      let acc = 0
      const joints: Array<[number, number, number]> = []
      pts.slice(1, -1).forEach((p, i) => {
        acc += seg[i]
        if (i % 2 === 0) joints.push([p[0], p[1], acc / total])
      })
      setGeo({ w: r.width, h: r.height, d, joints, end })
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useGSAP(
    () => {
      const path = pathRef.current
      if (!path || !geo || !motionEnabled()) return
      const len = path.getTotalLength()
      // Each trace node lights up when the drawn length passes it.
      const nodes = gsap.utils.toArray<SVGRectElement>('.ns-trace-node')
      const at = nodes.map((n) => Number(n.dataset.at))
      nodes.forEach((n) => (n.style.opacity = '0'))
      gsap.fromTo(
        path,
        { strokeDasharray: len, strokeDashoffset: len },
        {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: { trigger: section.current, start: 'top 75%', end: 'bottom bottom', scrub: SCRUB },
          onUpdate() {
            const drawn = this.progress()
            nodes.forEach((n, i) => (n.style.opacity = drawn >= at[i] ? '1' : '0'))
          },
        }
      )
    },
    { scope: section, dependencies: [geo], revertOnUpdate: true }
  )

  return (
    <section ref={section} id="start" data-chapter="start" data-tone="dark" aria-labelledby="cta-title" className="ns-section ns-surface-dark ns-cta">
      {geo && (
        <svg className="ns-trace" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
          <path ref={pathRef} d={geo.d} fill="none" stroke="var(--s-500)" strokeWidth={1} />
          {geo.joints.map(([x, y, at]) => (
            <rect key={`${x}-${y}`} className="ns-trace-node" data-at={at.toFixed(4)} x={x - 3.5} y={y - 3.5} width={7} height={7} fill="var(--c-900)" stroke="var(--s-300)" strokeWidth={1} />
          ))}
          <rect x={geo.end[0] - 4} y={geo.end[1] - 4} width={8} height={8} fill="var(--r-500)" />
        </svg>
      )}
      <LContainer>
        <LGrid>
          <Cell d="1 / 11" t="1 / -1" m="1 / -1" className="ns-stack" data-align="start">
            <Eyebrow>08 / Start</Eyebrow>
            <ScriptCaps id="cta-title" accent="Your turn" text="Find the weakest link." emphasis="weakest" size="mega" />
            <p className="ns-lead">Open the simulator to build your own topology, fail it piece by piece and measure what remains.</p>
            <div ref={button} style={{ display: 'inline-flex', ['--stack' as string]: 'var(--sp-7)' }}>
              <Magnetic>
                <LButtonLink to="/studio" variant="primary" size="lg" icon={<ArrowUpRight aria-hidden="true" />}>
                  Open Simulator
                </LButtonLink>
              </Magnetic>
            </div>
          </Cell>
        </LGrid>
      </LContainer>
    </section>
  )
}
