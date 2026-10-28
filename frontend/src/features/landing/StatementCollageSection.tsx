import React, { useRef, useEffect } from 'react'
import { PanelWipe } from '@/components/editorial/PanelWipe'
import { SplitLines } from '@/components/editorial/SplitLines'
import { ImageFrame } from '@/components/editorial/ImageFrame'
import { StarTopologyVisual, RingTopologyVisual, MeshTopologyVisual } from './EditorialGraphVisuals'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

/**
 * StatementCollageSection:
 * Section 3 of precision polish pass.
 * Moonlit silver (#F3F5F7) background with charcoal typography and hairlines.
 * Large line-masked statement: "MODEL THE NETWORK. BREAK CRITICAL LINKS. MEASURE WHAT SURVIVES."
 * Three graph frames with charcoal strokes, silver nodes, and one failed edge in Signal Red (#E5484D).
 * Expanding center frame with inward sliding side cards.
 */
export const StatementCollageSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const leftCardRef = useRef<HTMLDivElement>(null)
  const rightCardRef = useRef<HTMLDivElement>(null)
  const centerCardRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    const left = leftCardRef.current
    const right = rightCardRef.current
    const center = centerCardRef.current

    if (!container || !left || !right || !center || prefersReducedMotion) return

    // Inward collage slide as scroll progresses
    gsap.set(left, { xPercent: -35, opacity: 0.65 })
    gsap.set(right, { xPercent: 35, opacity: 0.65 })

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top 85%',
        end: 'top 20%',
        scrub: 0.8,
      },
    })

    tl.to(left, { xPercent: 0, opacity: 1, ease: 'none' })
      .to(right, { xPercent: 0, opacity: 1, ease: 'none' }, 0)

    return () => {
      tl.kill()
      if (tl.scrollTrigger) tl.scrollTrigger.kill()
    }
  }, [prefersReducedMotion])

  return (
    <PanelWipe id="statement" theme="light" className="py-24 sm:py-32 overflow-hidden bg-[#F3F5F7] text-[#17181B]">
      <div ref={containerRef} className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 space-y-14">
        {/* Eyebrow and Statement */}
        <div className="max-w-4xl space-y-4">
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#5A626C] block">
            Topological Degradation Thesis
          </span>

          <SplitLines
            tag="h2"
            className="headline-mega text-[#17181B] tracking-tight uppercase"
            stagger={0.09}
          >
            MODEL THE NETWORK. BREAK CRITICAL LINKS. MEASURE WHAT SURVIVES.
          </SplitLines>

          <p className="text-sm sm:text-base text-[#5A626C] max-w-xl leading-relaxed pt-2 text-pretty">
            In discrete mathematics, reliability is not a marketing promise. It is the quantifiable
            probability that a graph remains connected under stochastic vertex and edge removal.
          </p>
        </div>

        {/* Collage of Topologies with Expanding Center Frame */}
        <div className="relative w-full flex items-center justify-center gap-4 sm:gap-8 overflow-hidden py-4">
          {/* Left Crop Card: Star Topology */}
          <div
            ref={leftCardRef}
            className="w-1/4 sm:w-1/3 max-w-xs h-[260px] sm:h-[340px] bg-white border border-[#2A2C31]/15 rounded-[2px] p-4 flex flex-col justify-between shrink-0 shadow-sm overflow-hidden"
          >
            <div className="flex justify-between items-center text-[10px] font-mono text-[#5A626C]">
              <span>01 &bull; STAR HUB</span>
              <span className="text-[#E5484D] font-semibold">Cut Vertex</span>
            </div>
            <div className="flex-1 flex items-center justify-center scale-90">
              <StarTopologyVisual failed theme="light" />
            </div>
            <div className="text-[10px] font-mono text-[#8E97A2] border-t border-[#17181B]/10 pt-2">
              Hub Failure Partitions Graph
            </div>
          </div>

          {/* Center Expanding Card: High-density Mesh Topology */}
          <div
            ref={centerCardRef}
            className="w-1/2 sm:w-5/12 max-w-lg shrink-0 z-10"
          >
            <ImageFrame
              aspectRatio="aspect-[4/3] sm:aspect-[16/11]"
              initialInset="inset(8% 10% 8% 10%)"
              expandOnScroll
              parallaxOffset={20}
              className="bg-white border border-[#17181B]/20 rounded-[3px] shadow-xl"
            >
              <div className="w-full h-full p-6 flex flex-col justify-between text-[#17181B] relative">
                <div className="flex justify-between items-center text-[10px] font-mono text-[#5A626C]">
                  <span className="text-[#17181B] font-semibold">02 &bull; EXPANDED MESH</span>
                  <span>k-Connected Redundancy</span>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <MeshTopologyVisual theme="light" />
                </div>

                <div className="flex justify-between items-center text-[10px] font-mono text-[#5A626C] border-t border-[#17181B]/10 pt-2">
                  <span>Multiple Node-Disjoint Paths</span>
                  <span className="text-[#E5484D] font-medium">Bridges: 0</span>
                </div>
              </div>
            </ImageFrame>
          </div>

          {/* Right Crop Card: Ring Topology */}
          <div
            ref={rightCardRef}
            className="w-1/4 sm:w-1/3 max-w-xs h-[260px] sm:h-[340px] bg-white border border-[#2A2C31]/15 rounded-[2px] p-4 flex flex-col justify-between shrink-0 shadow-sm overflow-hidden"
          >
            <div className="flex justify-between items-center text-[10px] font-mono text-[#5A626C]">
              <span>03 &bull; RING CYCLE</span>
              <span className="text-[#17181B] font-medium">2-Edge Connected</span>
            </div>
            <div className="flex-1 flex items-center justify-center scale-90">
              <RingTopologyVisual severedEdge theme="light" />
            </div>
            <div className="text-[10px] font-mono text-[#8E97A2] border-t border-[#17181B]/10 pt-2">
              Alternate Loop Survives Cut
            </div>
          </div>
        </div>
      </div>
    </PanelWipe>
  )
}
