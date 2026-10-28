import React, { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { RotatingLabel } from './RotatingLabel'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

export interface WordItem {
  id: string
  word: string
  subtitle: string
  metric: string
  description: string
  visual: React.ReactNode
}

interface BigWordListProps {
  items: WordItem[]
  className?: string
}

/**
 * BigWordList:
 * Section 5: Topologies in Moonlit Silver theme (#F3F5F7).
 * Large selectable words (STAR, RING, MESH) with a rolling counter,
 * swapping the displayed live graph with a crossfade and slight scale.
 */
export const BigWordList: React.FC<BigWordListProps> = ({
  items,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    const list = listRef.current
    if (!container || !list || prefersReducedMotion || typeof window === 'undefined') return

    const total = items.length
    const ctx = gsap.context(() => {
      // Pin container for vertical scrolling through words
      ScrollTrigger.create({
        trigger: container,
        pin: true,
        start: 'top top',
        end: `+=${total * 85}%`,
        scrub: 0.8,
        onUpdate: (self) => {
          const idx = Math.min(
            total - 1,
            Math.max(0, Math.floor(self.progress * total))
          )
          setActiveIndex(idx)
        },
      })

      // Vertical translation of the words list
      gsap.to(list, {
        yPercent: -((total - 1) * 33.33),
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: `+=${total * 85}%`,
          scrub: 0.8,
        },
      })
    }, container)

    return () => ctx.revert()
  }, [items.length, prefersReducedMotion])

  const activeItem = items[activeIndex] || items[0]

  // Reduced motion / mobile fallback
  if (prefersReducedMotion) {
    return (
      <div id="topologies" className={`py-24 px-5 sm:px-8 max-w-5xl mx-auto space-y-12 bg-[#F3F5F7] text-[#17181B] ${className}`}>
        <div className="flex items-center justify-between border-b border-[#2A2C31]/15 pb-4">
          <div>
            <span className="text-xs font-mono uppercase text-[#E5484D] font-medium tracking-wider">
              Topological Archetypes
            </span>
            <h2 className="headline-chapter text-[#17181B] mt-1">Fundamental Topologies</h2>
          </div>
          <RotatingLabel size={75} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((it, idx) => (
            <div key={it.id} className="p-6 bg-white border border-[#2A2C31]/15 rounded-[2px] space-y-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#E5484D] font-semibold">0{idx + 1}</span>
                <span className="text-[#5A626C]">{it.metric}</span>
              </div>
              <h3 className="headline-chapter text-[#17181B]">{it.word}</h3>
              <p className="text-xs text-[#5A626C] leading-relaxed">{it.description}</p>
              <div className="pt-2">{it.visual}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      id="topologies"
      ref={containerRef}
      className={`relative w-full h-[100dvh] overflow-hidden bg-[#F3F5F7] text-[#17181B] flex flex-col justify-between ${className}`}
    >
      {/* Top Header Row with Rolling Counter */}
      <div className="pt-20 px-5 sm:px-8 lg:px-12 flex items-center justify-between border-b border-[#17181B]/10 pb-4 z-20">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#E5484D] font-semibold">
              Discrete Topologies
            </span>
            {/* Rolling Counter */}
            <div className="h-5 overflow-hidden flex items-center font-mono text-xs text-[#E5484D] font-semibold">
              <div
                className="transition-transform duration-300 ease-out"
                style={{ transform: `translateY(-${activeIndex * 20}px)` }}
              >
                <div className="h-5 leading-5">01 / 03</div>
                <div className="h-5 leading-5">02 / 03</div>
                <div className="h-5 leading-5">03 / 03</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#5A626C] mt-0.5">
            Single point of failure vs distributed resilience
          </p>
        </div>

        <RotatingLabel size={85} />
      </div>

      {/* Main Split View: Big Selectable Words at Left, Changing Live Visual at Right */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-between px-5 sm:px-8 lg:px-12 py-6 gap-8 relative z-10 overflow-hidden">
        {/* Left Column: Stacked Big Words with Viewport Mask */}
        <div
          className="w-full lg:w-1/2 h-[380px] sm:h-[460px] flex items-center relative overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
          }}
        >
          <div ref={listRef} className="w-full space-y-10 sm:space-y-14 will-change-transform">
            {items.map((item, idx) => {
              const isFocal = idx === activeIndex
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`w-full text-left transition-all duration-500 transform cursor-pointer focus-visible:outline-none ${
                    isFocal
                      ? 'opacity-100 scale-100'
                      : 'opacity-40 hover:opacity-70 scale-95'
                  }`}
                >
                  <div className="flex items-baseline gap-4 mb-1">
                    <span className="text-xs font-mono text-[#E5484D] font-semibold">0{idx + 1}</span>
                    <span className="text-xs font-mono uppercase tracking-widest text-[#5A626C]">
                      {item.subtitle}
                    </span>
                  </div>

                  <h2 className="headline-mega text-[#17181B] select-none tracking-tight">
                    {item.word}
                  </h2>

                  <p
                    className={`text-xs sm:text-sm text-[#5A626C] max-w-md mt-2 transition-opacity duration-300 text-pretty ${
                      isFocal ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {item.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Column: Live Associated Visual Container */}
        <div className="w-full lg:w-1/2 h-[340px] sm:h-[420px] bg-white border border-[#17181B]/15 rounded-[3px] p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#17181B]/10 pb-3">
            <span className="text-[11px] font-mono text-[#17181B] font-semibold uppercase">
              Live Topology Simulation
            </span>
            <span className="text-xs font-mono text-[#E5484D] font-medium">
              {activeItem.metric}
            </span>
          </div>

          <div
            key={activeItem.id}
            className="flex-1 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300"
          >
            {activeItem.visual}
          </div>

          <div className="pt-3 border-t border-[#17181B]/10 flex items-center justify-between text-[11px] font-mono text-[#5A626C]">
            <span>Vertex Set V &bull; Edge Set E</span>
            <span className="text-[#17181B] font-medium">Archetype 0{activeIndex + 1}</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer Telemetry */}
      <div className="px-5 sm:px-8 lg:px-12 py-4 border-t border-[#17181B]/10 flex items-center justify-between text-[11px] font-mono text-[#5A626C] z-20">
        <span>Cycle C_n &bull; Complete Graph K_n &bull; Tree T_n</span>
        <span>Click or scroll to inspect graph resilience</span>
      </div>
    </div>
  )
}
