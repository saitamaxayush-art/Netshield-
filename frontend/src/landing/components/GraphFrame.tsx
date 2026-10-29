import React, { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SCRUB, motionEnabled } from '../motion/engine'

/**
 * Clip-path inset frame that opens as it scrolls into view while its inner
 * content settles from 1.2 to 1 scale with a small in-frame parallax.
 * The frame box is reserved by `aspect` so nothing shifts on mount.
 */
export function GraphFrame({
  aspect = '4 / 3',
  className = '',
  style,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { aspect?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const el = ref.current
      if (!el || !inner.current || !motionEnabled()) return
      gsap
        .timeline({
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 30%', scrub: SCRUB },
        })
        .fromTo(el, { clipPath: 'inset(10% 8% 10% 8%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none' }, 0)
        .fromTo(inner.current, { scale: 1.2 }, { scale: 1, ease: 'none' }, 0)
      gsap.fromTo(
        inner.current,
        { yPercent: -3 },
        { yPercent: 3, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: SCRUB } }
      )
    },
    { scope: ref }
  )
  return (
    <div ref={ref} className={`ns-frame ${className}`} style={{ position: 'relative', aspectRatio: aspect, overflow: 'clip', ...style }} {...rest}>
      <div ref={inner} style={{ position: 'absolute', inset: 0 }}>
        {children}
      </div>
    </div>
  )
}
