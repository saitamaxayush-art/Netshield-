import React, { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Terminal, ArrowRight } from 'lucide-react'
import { SplitLines } from '@/components/editorial/SplitLines'
import { Container } from '@/components/layout/Container'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

/**
 * ClosingSection:
 * Section 8 of precision layout pass (Final CTA).
 * Charcoal theme (#17181B background, #1E2024 surfaces, #2A2C31 hairlines).
 * Large statement, Signal Red (#E5484D) "Open Simulator" CTA button,
 * and a subtle scroll-driven network trace path that draws down to the button.
 */
export const ClosingSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const el = sectionRef.current
    const path = pathRef.current
    if (!el || !path || prefersReducedMotion || typeof window === 'undefined') return

    const length = path.getTotalLength()
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })

    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top 80%',
        end: 'center center',
        scrub: 0.8,
      },
    })

    return () => {
      tween.kill()
      if (tween.scrollTrigger) tween.scrollTrigger.kill()
    }
  }, [prefersReducedMotion])

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-28 sm:py-36 bg-[#17181B] text-[#E4E8EC] border-t border-[#2A2C31] overflow-hidden select-none"
    >
      {/* Background Subtle Network Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, #3A3D44 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />

      {/* Subtle Scroll-driven Network Trace SVG Line */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
        <svg
          viewBox="0 0 400 600"
          className="w-full max-w-lg h-full opacity-40 overflow-visible"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            ref={pathRef}
            d="M 200 0 L 200 120 L 160 180 L 240 260 L 200 340 L 200 480"
            fill="none"
            stroke="#E5484D"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
        </svg>
      </div>

      <Container size="content" className="relative z-10 text-center space-y-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1E2024] border border-[#2A2C31] rounded-[2px] mx-auto">
          <Terminal className="w-3.5 h-3.5 text-[#E5484D]" />
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#C3CAD2]">
            Begin Network Analysis
          </span>
        </div>

        {/* Large Final Statement with SplitLines reveal */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <SplitLines
            tag="h2"
            className="headline-mega text-[#F3F5F7] tracking-tight uppercase"
            stagger={0.09}
          >
            EVERY NETWORK HAS A WEAK POINT. FIND IT BEFORE IT FAILS.
          </SplitLines>

          <p className="text-sm sm:text-base text-[#C3CAD2] max-w-xl mx-auto leading-relaxed pt-2 text-pretty">
            Build custom graph topologies, trigger simulated component outages, and evaluate
            stochastic reliability in a live educational laboratory.
          </p>
        </div>

        {/* Rectangular CTA Buttons with Fixed 48px Height */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/studio"
            className="w-full sm:w-auto h-12 px-8 bg-[#E5484D] hover:bg-[#F0666A] active:bg-[#C93A3F] text-white font-mono text-xs uppercase tracking-wider font-semibold rounded-[2px] transition-colors flex items-center justify-center gap-2.5 shadow-md cursor-pointer group"
          >
            <span>Open Simulator</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/dashboard"
            className="w-full sm:w-auto h-12 px-6 bg-transparent border border-[#3A3D44] hover:border-[#E4E8EC] text-[#E4E8EC] hover:text-white font-mono text-xs uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center cursor-pointer"
          >
            View Dashboard
          </Link>
        </div>

        {/* Educational Note */}
        <p className="text-[11px] font-mono text-[#8E97A2] max-w-md mx-auto pt-6">
          Runs locally with NetworkX algorithms and ReactFlow canvas. Zero external telemetry.
        </p>
      </Container>
    </section>
  )
}
