import React, { useRef, useEffect } from 'react'
import { ScriptCaps } from '@/components/editorial/ScriptCaps'
import { PanelWipe } from '@/components/editorial/PanelWipe'
import { TarjanBridgesVisual, MeshTopologyVisual, RingTopologyVisual } from './EditorialGraphVisuals'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

/**
 * MethodChapterSection:
 * Sections 10 & 11 of luxury reference choreography.
 * - Focal white box with huge word "METHOD" centered on top of full-bleed graph visual.
 * - Followed by pinned sequence with alternating light and dark panels, ScriptCaps headings,
 *   changing graph visual states, and column parallax at different speeds.
 */
export const MethodChapterSection: React.FC = () => {
  const chapterHeroRef = useRef<HTMLDivElement>(null)
  const bgScaleRef = useRef<HTMLDivElement>(null)
  const parallaxCol1Ref = useRef<HTMLDivElement>(null)
  const parallaxCol2Ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const hero = chapterHeroRef.current
    const bg = bgScaleRef.current
    if (!hero || !bg || prefersReducedMotion) return

    // Slow background scale settle as white box pins into focus
    gsap.set(bg, { scale: 1.2 })
    const tween = gsap.to(bg, {
      scale: 1.0,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.8,
      },
    })

    return () => {
      tween.kill()
      if (tween.scrollTrigger) tween.scrollTrigger.kill()
    }
  }, [prefersReducedMotion])

  // Column parallax in pinned method sequence
  useEffect(() => {
    const col1 = parallaxCol1Ref.current
    const col2 = parallaxCol2Ref.current
    if (!col1 || !col2 || prefersReducedMotion) return

    gsap.to(col1, {
      y: -60,
      ease: 'none',
      scrollTrigger: {
        trigger: col1,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
      },
    })

    gsap.to(col2, {
      y: -120,
      ease: 'none',
      scrollTrigger: {
        trigger: col2,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.9,
      },
    })
  }, [prefersReducedMotion])

  return (
    <div id="methodology" className="w-full">
      {/* Chapter Title: Focal White Box Centred Over Full-Bleed Visual */}
      <div
        ref={chapterHeroRef}
        className="relative w-full h-screen bg-[#0A0B10] flex items-center justify-center overflow-hidden"
      >
        {/* Full-bleed background graph with slow scale */}
        <div
          ref={bgScaleRef}
          className="absolute inset-0 opacity-40 pointer-events-none will-change-transform flex items-center justify-center scale-110"
        >
          <div className="w-[140vw] h-[140vh] bg-[radial-gradient(ellipse_at_center,#182538_0%,#0A0B10_70%)] flex items-center justify-center">
            <MeshTopologyVisual className="opacity-30 scale-150" />
          </div>
        </div>

        {/* Focal Crisp White Box */}
        <div className="relative z-10 p-10 sm:p-20 bg-white text-[#0A0B10] border border-white/20 rounded-[3px] shadow-2xl text-center max-w-xl mx-6">
          <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#64748B] mb-2 block">
            Algorithmic Framework
          </span>
          <h2 className="headline-mega text-[#0A0B10] tracking-tight">
            METHOD
          </h2>
          <div className="w-12 h-[2px] bg-accent-teal mx-auto my-4" />
          <p className="text-xs sm:text-sm text-[#475569] font-serif leading-relaxed">
            The rigorous mathematical pipeline that powers NetShield failure simulation.
          </p>
        </div>
      </div>

      {/* Pinned Method Sequence Part 1: Light Panel */}
      <PanelWipe theme="light" className="py-24 sm:py-32 border-b border-[#0A0B10]/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <ScriptCaps
              script="Phase 01 &bull; Topology Modeling"
              caps="CONSTRUCT THE DISCRETE GRAPH"
              tag="h3"
              scriptClassName="text-[#64748B] text-lg sm:text-2xl"
              capsClassName="headline-chapter text-[#0A0B10]"
            />
            <p className="text-sm text-[#475569] leading-relaxed">
              Every server, router, client, and perimeter firewall is mapped to an undirected vertex
              set V. Physical cabling and microwave uplinks are modeled as an edge set E. We calculate
              degrees d(v), adjacency matrices A(G), and verify baseline connected component k = 1.
            </p>
            <div className="font-mono text-xs text-[#64748B] flex items-center gap-6 pt-2">
              <div>|V| Vertices</div>
              <div>&bull;</div>
              <div>|E| Undirected Edges</div>
              <div>&bull;</div>
              <div className="text-accent-teal font-semibold">k = 1 Connected</div>
            </div>
          </div>

          <div className="lg:col-span-6 h-[320px] bg-[#0A0B10] rounded-[3px] p-6 border border-[#0A0B10]/15 shadow-xl flex items-center justify-center">
            <RingTopologyVisual className="scale-95" />
          </div>
        </div>
      </PanelWipe>

      {/* Pinned Method Sequence Part 2: Dark Panel with Column Parallax */}
      <PanelWipe theme="dark" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <ScriptCaps
              script="Phase 02 &bull; Stochastic Perturbation"
              caps="INDEPENDENT BERNOULLI FAILURES"
              tag="h3"
              scriptClassName="text-accent-teal/90 text-lg sm:text-2xl"
              capsClassName="headline-chapter text-white"
            />
            <p className="text-sm text-text-secondary leading-relaxed">
              Components fail independently with specified failure rate p &in; [0, 1]. When a vertex
              fails, all its incident edges are automatically deactivated, isolating incident routes
              and testing graph redundancy under adverse operating states.
            </p>
            <div className="font-mono text-xs text-white/50 flex items-center gap-6 pt-2">
              <div>p &isin; [0, 1] Failure Prob</div>
              <div>&bull;</div>
              <div className="text-state-coral font-semibold">Incident Link Deactivation</div>
            </div>
          </div>

          {/* Right Parallax Columns at different speeds */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-4 h-[360px] overflow-hidden">
            <div
              ref={parallaxCol1Ref}
              className="bg-[#121520] border border-white/10 rounded-[3px] p-4 flex flex-col justify-between shadow-lg will-change-transform"
            >
              <span className="text-[10px] font-mono text-accent-cyan uppercase">Column Parallax A</span>
              <div className="flex-1 flex items-center justify-center">
                <TarjanBridgesVisual className="scale-75" />
              </div>
              <span className="text-[10px] font-mono text-white/40">Tarjan DFS</span>
            </div>

            <div
              ref={parallaxCol2Ref}
              className="bg-[#121520] border border-white/10 rounded-[3px] p-4 flex flex-col justify-between shadow-lg will-change-transform translate-y-8"
            >
              <span className="text-[10px] font-mono text-accent-teal uppercase">Column Parallax B</span>
              <div className="flex-1 flex items-center justify-center">
                <MeshTopologyVisual className="scale-75" />
              </div>
              <span className="text-[10px] font-mono text-white/40">Component Recovery</span>
            </div>
          </div>
        </div>
      </PanelWipe>
    </div>
  )
}
