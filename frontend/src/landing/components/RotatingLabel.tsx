import { useEffect, useId, useRef } from 'react'
import gsap from 'gsap'
import { motionEnabled, scrollState } from '../motion/engine'

/**
 * Circular text on a path. Rotates slowly on the shared ticker and speeds up
 * slightly with scroll velocity. Paused offscreen; static under reduced motion.
 */
export function RotatingLabel({ text, className = '', children }: { text: string; className?: string; children?: React.ReactNode }) {
  const id = useId().replace(/:/g, '')
  const ref = useRef<SVGGElement>(null)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const g = ref.current
    const el = wrap.current
    if (!g || !el || !motionEnabled()) return
    let visible = false
    let angle = 0
    let boost = 0
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(el)
    const tick = (_t: number, dt: number) => {
      if (!visible) return
      boost += (Math.min(4, Math.abs(scrollState.velocity) * 0.08) - boost) * 0.08
      angle = (angle + dt * 0.006 * (1 + boost)) % 360
      g.setAttribute('transform', `rotate(${angle.toFixed(2)} 56 56)`)
    }
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      io.disconnect()
    }
  }, [])

  return (
    <div ref={wrap} className={className} style={{ position: 'relative', width: 112, height: 112 }} aria-hidden="true">
      <svg className="ns-rotlabel" viewBox="0 0 112 112">
        <defs>
          <path id={`rl-${id}`} d="M56,56 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <g ref={ref}>
          <text>
            <textPath href={`#rl-${id}`} textLength="276" lengthAdjust="spacing">
              {text}
            </textPath>
          </text>
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  )
}
