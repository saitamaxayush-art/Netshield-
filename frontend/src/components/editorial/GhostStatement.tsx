import React, { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

interface GhostStatementProps {
  lines: string[]
  scriptPrefix?: string
  eyebrow?: string
  className?: string
  interactiveSpotlight?: boolean
}

/**
 * GhostStatement: A massive uppercase statement on dark background that starts dim with
 * soft left and right edge masks, brightening line-by-line with scroll progress.
 * On desktop, includes an optional pointer-driven radial spotlight.
 */
export const GhostStatement: React.FC<GhostStatementProps> = ({
  lines,
  scriptPrefix,
  eyebrow,
  className = '',
  interactiveSpotlight = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container || prefersReducedMotion || typeof window === 'undefined') return

    const lineElements = container.querySelectorAll('.ghost-statement-line')

    gsap.set(lineElements, { opacity: 0.15, y: 15 })

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top 80%',
        end: 'bottom 40%',
        scrub: 0.8,
      },
    })

    tl.to(lineElements, {
      opacity: 1,
      y: 0,
      stagger: 0.15,
      ease: 'power2.out',
    })

    return () => {
      tl.kill()
      if (tl.scrollTrigger) tl.scrollTrigger.kill()
    }
  }, [lines, prefersReducedMotion])

  // Optional desktop pointer spotlight
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactiveSpotlight || prefersReducedMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleMouseLeave = () => {
    setMousePos(null)
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full py-32 px-6 sm:px-12 flex flex-col items-center justify-center text-center bg-[#0A0B10] text-[#F8FAFC] overflow-hidden select-none ${className}`}
      style={{
        maskImage:
          'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
      }}
    >
      {/* Restrained desktop pointer spotlight overlay */}
      {mousePos && (
        <div
          className="pointer-events-none absolute inset-0 opacity-25 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 350px at ${mousePos.x}px ${mousePos.y}px, rgba(229, 72, 77, 0.2), transparent 70%)`,
          }}
          aria-hidden="true"
        />
      )}

      {eyebrow && (
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5484D] mb-4 block">
          {eyebrow}
        </span>
      )}

      {scriptPrefix && (
        <span className="script-accent text-text-secondary text-2xl sm:text-4xl mb-2 sm:mb-3 block">
          {scriptPrefix}
        </span>
      )}

      <div className="space-y-2 sm:space-y-4 max-w-6xl mx-auto">
        {lines.map((line, idx) => (
          <h2
            key={idx}
            className={`ghost-statement-line headline-mega tracking-tight text-white transition-opacity ${
              prefersReducedMotion ? '!opacity-100 !transform-none' : ''
            }`}
          >
            {line}
          </h2>
        ))}
      </div>
    </div>
  )
}
