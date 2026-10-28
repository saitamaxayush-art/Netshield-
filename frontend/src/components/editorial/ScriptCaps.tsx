import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

interface ScriptCapsProps {
  script: string
  caps: string
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'div'
  layout?: 'stacked' | 'inline'
  className?: string
  scriptClassName?: string
  capsClassName?: string
  delay?: number
  triggerHook?: string
}

/**
 * ScriptCaps: Italic script word over or beside an uppercase high-contrast serif line.
 * Animates in sequence: script first (delicate fade and slide), uppercase caps second (line mask reveal).
 */
export const ScriptCaps: React.FC<ScriptCapsProps> = ({
  script,
  caps,
  tag: Tag = 'h2',
  layout = 'stacked',
  className = '',
  scriptClassName = '',
  capsClassName = '',
  delay = 0,
  triggerHook = 'top 85%',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptRef = useRef<HTMLSpanElement>(null)
  const capsInnerRef = useRef<HTMLSpanElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    const scriptEl = scriptRef.current
    const capsEl = capsInnerRef.current

    if (!container || !scriptEl || !capsEl || prefersReducedMotion) return

    gsap.set(scriptEl, { opacity: 0, y: 15 })
    gsap.set(capsEl, { yPercent: 110, opacity: 0.1 })

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: triggerHook,
        toggleActions: 'play none none none',
      },
      delay,
    })

    // Script animates first
    tl.to(scriptEl, {
      opacity: 1,
      y: 0,
      duration: 0.85,
      ease: 'power3.out',
    })
      // Caps line follows tightly
      .to(
        capsEl,
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.15,
          ease: 'power4.out',
        },
        '-=0.45'
      )

    const failsafeTimer = setTimeout(() => {
      const rect = container.getBoundingClientRect()
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        gsap.to(scriptEl, { opacity: 1, y: 0, duration: 0.4, overwrite: 'auto' })
        gsap.to(capsEl, { yPercent: 0, opacity: 1, duration: 0.5, overwrite: 'auto' })
      }
    }, 1500 + delay * 1000)

    return () => {
      clearTimeout(failsafeTimer)
      tl.kill()
      if (tl.scrollTrigger) tl.scrollTrigger.kill()
    }
  }, [prefersReducedMotion, delay, triggerHook])

  const CustomTag = Tag as 'div'

  return (
    <CustomTag
      ref={containerRef}
      className={`relative select-none ${className} ${
        layout === 'inline' ? 'flex flex-wrap items-baseline gap-x-3 gap-y-1' : 'flex flex-col'
      }`}
      aria-label={`${script} ${caps}`}
    >
      <span
        ref={scriptRef}
        aria-hidden="true"
        className={`script-accent block text-text-secondary ${
          layout === 'stacked' ? 'mb-1 sm:mb-2' : ''
        } ${prefersReducedMotion ? '!opacity-100 !transform-none' : ''} ${scriptClassName}`}
      >
        {script}
      </span>

      <span aria-hidden="true" className="line-mask block">
        <span
          ref={capsInnerRef}
          className={`line-mask-inner block headline-chapter ${
            prefersReducedMotion ? '!translate-y-0 !opacity-100' : ''
          } ${capsClassName}`}
        >
          {caps}
        </span>
      </span>
    </CustomTag>
  )
}
