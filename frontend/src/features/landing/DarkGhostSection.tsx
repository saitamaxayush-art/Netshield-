import React, { useRef, useEffect } from 'react'
import { PanelWipe } from '@/components/editorial/PanelWipe'
import { GhostStatement } from '@/components/editorial/GhostStatement'
import { MeshTopologyVisual } from './EditorialGraphVisuals'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

/**
 * DarkGhostSection:
 * Sections 6 & 7 of luxury reference choreography.
 * Dark statement with ghosted uppercase text sharpening with scroll, oversized italic script
 * word ("Resilient"), with an elevated graph card rising from the bottom center over the black.
 */
export const DarkGhostSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const risingCardRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    const card = risingCardRef.current
    if (!container || !card || prefersReducedMotion) return

    // Rising card animation from bottom center over the black
    gsap.set(card, { y: 120, opacity: 0.2, scale: 0.94 })

    const tween = gsap.to(card, {
      y: 0,
      opacity: 1,
      scale: 1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: container,
        start: 'top 75%',
        end: 'bottom 60%',
        scrub: 0.8,
      },
    })

    return () => {
      tween.kill()
      if (tween.scrollTrigger) tween.scrollTrigger.kill()
    }
  }, [prefersReducedMotion])

  return (
    <PanelWipe id="resilience" theme="dark" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(45, 212, 191, 0.25), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div ref={containerRef} className="max-w-6xl mx-auto px-6 sm:px-12 space-y-16 relative z-10">
        {/* Ghost Statement with Script Word "Resilient" */}
        <GhostStatement
          eyebrow="Stochastic Resilience Framework"
          scriptPrefix="Resilient"
          lines={['TOPOLOGIES DESIGNED TO ENDURE', 'CASCADING DEGRADATION']}
          interactiveSpotlight
        />

        {/* Elevated Lone Graph Card Rising from Bottom Center */}
        <div
          ref={risingCardRef}
          className="max-w-2xl mx-auto p-8 sm:p-10 bg-[#121520] border border-white/10 rounded-[3px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden text-center space-y-6"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4 text-xs font-mono">
            <span className="text-accent-teal uppercase tracking-widest">
              Bi-Connected Component Block
            </span>
            <span className="text-white/40">2-Vertex Connected</span>
          </div>

          <div className="py-4 flex items-center justify-center max-h-[220px]">
            <MeshTopologyVisual />
          </div>

          <p className="text-xs sm:text-sm text-text-secondary max-w-lg mx-auto leading-relaxed">
            By eliminating all cut vertices through cyclical augmentation, the network guarantees
            that no single element failure can divide the active fleet into disconnected partitions.
          </p>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-text-muted">
            <span>Minimum Degree &delta;(G) &ge; 2</span>
            <span className="text-accent-teal">Zero Articulation Points</span>
          </div>
        </div>
      </div>
    </PanelWipe>
  )
}
