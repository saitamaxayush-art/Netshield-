import React, { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SCRUB, motionEnabled } from '../motion/engine'

/**
 * Section whose surface is revealed as it scrolls: it opens from an inset card
 * to full bleed as the section enters, and closes again as it leaves, so
 * charcoal and silver never meet in a hard cut while moving. The section
 * carries its own colour (correct without JS and for contrast tools); four
 * edge strips in the neighbouring colour draw the inset and are animated with
 * transform: scale only. They sit inside the section padding, never behind
 * text. Two CSS variables (--wi enter, --wo exit) drive them; at rest both are
 * 0 and the strips have no size.
 */
export function PanelWipe({
  tone,
  id,
  className = '',
  children,
  labelledBy,
  chapter,
}: {
  tone: 'silver' | 'dark'
  id?: string
  className?: string
  children: React.ReactNode
  labelledBy?: string
  chapter?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const el = ref.current
      const f = frame.current
      if (!el || !f || !motionEnabled()) return
      gsap.set(f, { '--wi': 1, '--wo': 0 })
      gsap.to(f, {
        '--wi': 0,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 35%', scrub: SCRUB },
      })
      gsap.to(f, {
        '--wo': 1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'bottom 65%', end: 'bottom top', scrub: SCRUB },
      })
    },
    { scope: ref }
  )
  const color = tone === 'silver' ? 'var(--s-50)' : 'var(--c-900)'
  const edge = tone === 'silver' ? 'var(--c-900)' : 'var(--s-50)'
  const k = 'max(var(--wi, 0), var(--wo, 0))'
  const strip = (style: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', background: edge, willChange: 'transform', ...style })
  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={labelledBy}
      data-tone={tone === 'silver' ? 'light' : 'dark'}
      data-chapter={chapter}
      className={`ns-section ${tone === 'silver' ? 'ns-surface-silver' : 'ns-surface-dark'} ${className}`}
      style={{ background: color }}
    >
      <div ref={frame} aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
        <div style={strip({ left: 0, right: 0, top: 0, height: 56, transformOrigin: '50% 0', transform: 'scaleY(var(--wi, 0))' })} />
        <div style={strip({ left: 0, right: 0, bottom: 0, height: 56, transformOrigin: '50% 100%', transform: 'scaleY(var(--wo, 0))' })} />
        <div style={strip({ left: 0, top: 0, bottom: 0, width: 'min(4vw, 48px)', transformOrigin: '0 50%', transform: `scaleX(${k})` })} />
        <div style={strip({ right: 0, top: 0, bottom: 0, width: 'min(4vw, 48px)', transformOrigin: '100% 50%', transform: `scaleX(${k})` })} />
      </div>
      {children}
    </section>
  )
}
