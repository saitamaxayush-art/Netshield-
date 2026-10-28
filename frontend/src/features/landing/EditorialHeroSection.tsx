import React, { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { SplitLines } from '@/components/editorial/SplitLines'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'
import { Terminal, ArrowRight, ShieldCheck, ChevronDown } from 'lucide-react'

// Lazy-load React Three Fiber scene
const Network3DScene = lazy(() =>
  import('./Network3DScene').then((m) => ({ default: m.Network3DScene }))
)

/**
 * EditorialHeroSection:
 * Section 2 of precision layout pass.
 * Charcoal background with 3D ribbon network drift (silver nodes/lines, rare red failing edge).
 * Headline: "Understand how networks fail."
 * Primary CTA: "Open Simulator" (signal red, rectangular, h-11)
 * Secondary CTA: "Explore the Method" (silver outline, rectangular, h-11)
 * Subtle scroll indicator at bottom.
 */
export const EditorialHeroSection: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion()

  const scrollToMethod = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const el = document.getElementById('methodology')
    if (el) {
      const navHeight = 64
      const pos = el.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: pos - navHeight, behavior: 'smooth' })
    }
  }

  return (
    <section
      id="intro"
      className="relative w-full min-h-[100dvh] flex flex-col justify-between bg-[#17181B] text-[#E4E8EC] overflow-hidden select-none"
    >
      {/* 3D Network Ribbon Background with subtle charcoal vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-80">
        {!prefersReducedMotion ? (
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[#8E97A2]/30">
                Initializing 3D Network Topology...
              </div>
            }
          >
            <Network3DScene />
          </Suspense>
        ) : (
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(228,232,236,0.05)_0%,transparent_70%)]" />
        )}
      </div>

      {/* Subtle charcoal-950 vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(18,19,21,0.75)_100%)] z-1"
        aria-hidden="true"
      />

      {/* Top Hairline Spacer for fixed header */}
      <div className="h-20 sm:h-24 shrink-0" />

      {/* Center Cinematic Headline & CTAs */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 my-auto text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1E2024]/90 border border-[#2A2C31] rounded-[2px] mb-6 backdrop-blur-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#E5484D]" />
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#C3CAD2]">
            Discrete Mathematics Research Laboratory
          </span>
        </div>

        {/* Headline with SplitLines reveal */}
        <div className="space-y-3">
          <span className="script-accent text-[#C3CAD2] text-xl sm:text-3xl block">
            The mathematical foundation of resilience
          </span>
          <SplitLines
            tag="h1"
            className="headline-mega text-[#F3F5F7] tracking-tight uppercase"
            stagger={0.09}
          >
            Understand how networks fail.
          </SplitLines>
        </div>

        <p className="mt-6 sm:mt-8 text-sm sm:text-base text-[#C3CAD2] max-w-xl leading-relaxed text-pretty">
          Model routers and computational backbones as formal discrete graphs. Simulate independent
          node and link breakdowns, detect critical bridges, and calculate Monte Carlo reliability.
        </p>

        {/* Standardized Button Heights (h-11 = 44px) & Baseline Alignment */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link
            to="/studio"
            className="w-full sm:w-auto h-11 px-6 bg-[#E5484D] hover:bg-[#F0666A] active:bg-[#C93A3F] text-white font-mono text-xs uppercase tracking-wider font-semibold rounded-[2px] transition-colors flex items-center justify-center gap-2.5 group shadow-xs cursor-pointer"
          >
            <span>Open Simulator</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <a
            href="#methodology"
            onClick={scrollToMethod}
            className="w-full sm:w-auto h-11 px-6 bg-transparent border border-[#3A3D44] hover:border-[#E4E8EC] text-[#E4E8EC] hover:text-white font-mono text-xs uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center text-center cursor-pointer"
          >
            Explore the Method
          </a>
        </div>
      </div>

      {/* Bottom Row: Micro Telemetry Left, Framed Thumbnail Card Right, Subtle Scroll Indicator Center */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pb-6 pt-4 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 shrink-0">
        {/* Left Telemetry */}
        <div className="flex items-center gap-4 text-xs font-mono text-[#8E97A2]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D] animate-pulse" />
            <span>Tarjan DFS Engine</span>
          </div>
          <span>&bull;</span>
          <span>Seed 42 Deterministic</span>
        </div>

        {/* Subtle Scroll Indicator */}
        <div className="hidden md:flex flex-col items-center gap-1.5 text-center text-[#8E97A2] animate-bounce">
          <span className="text-[10px] font-mono uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#C3CAD2]" />
        </div>

        {/* Right Framed Thumbnail Card */}
        <Link
          to="/studio"
          className="group p-2.5 bg-[#1E2024]/90 border border-[#2A2C31] hover:border-[#E5484D] rounded-[2px] shadow-lg backdrop-blur-md transition-all flex items-center gap-3.5 max-w-xs"
          aria-label="Preview of Network Studio Editor"
        >
          {/* Framed Thumbnail Visual */}
          <div className="w-16 h-12 bg-[#121315] border border-[#2A2C31] rounded-[2px] overflow-hidden relative flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5 text-[#E4E8EC] group-hover:scale-110 transition-transform" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
          </div>

          <div className="flex flex-col text-left">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#E4E8EC] font-medium group-hover:text-[#F0666A] transition-colors">
              Interactive Studio
            </span>
            <span className="text-[10px] text-[#8E97A2] font-mono">
              Live Topology Canvas &rarr;
            </span>
          </div>
        </Link>
      </div>
    </section>
  )
}
