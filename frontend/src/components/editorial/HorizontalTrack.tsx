import React, { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'
import { ArrowLeft, ArrowRight } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

export interface HorizontalSlide {
  id: string
  number: string
  title: string
  subtitle: string
  description: string
  badge: string
  visual: React.ReactNode
}

interface HorizontalTrackProps {
  slides: HorizontalSlide[]
  sectionHeading?: React.ReactNode
  className?: string
  id?: string
}

/**
 * HorizontalTrack: Pinned section where vertical scroll drives horizontal travel of slides.
 * Features subtle edge curvature (perspective & rotateY), slide parallax, and a live counter.
 * Automatically falls back to a clean accessible vertical stack under prefers-reduced-motion.
 */
export const HorizontalTrack: React.FC<HorizontalTrackProps> = ({
  slides,
  sectionHeading,
  className = '',
  id,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [currentSlide, setCurrentSlide] = useState(1)

  useEffect(() => {
    const container = containerRef.current
    const track = trackRef.current
    if (!container || !track || prefersReducedMotion || typeof window === 'undefined') return

    // Calculate total horizontal travel distance
    const totalSlides = slides.length
    const xMovement = (totalSlides - 1) * -100

    const ctx = gsap.context(() => {
      const pinTrigger = ScrollTrigger.create({
        trigger: container,
        pin: true,
        start: 'top top',
        end: `+=${totalSlides * 100}%`,
        scrub: 0.8,
        onUpdate: (self) => {
          const idx = Math.min(
            totalSlides,
            Math.max(1, Math.round(self.progress * (totalSlides - 1)) + 1)
          )
          setCurrentSlide(idx)
        },
      })

      gsap.to(track, {
        xPercent: xMovement,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: `+=${totalSlides * 100}%`,
          scrub: 0.8,
        },
      })

      // Slide edge curvature and parallax
      const slideElements = track.querySelectorAll('.horizontal-slide-card')
      slideElements.forEach((el) => {
        gsap.fromTo(
          el,
          { rotateY: 6, scale: 0.96 },
          {
            rotateY: -6,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              containerAnimation: pinTrigger.animation,
              start: 'left right',
              end: 'right left',
              scrub: 0.8,
            },
          }
        )
      })
    }, container)

    return () => ctx.revert()
  }, [slides.length, prefersReducedMotion])

  // Reduced motion: Clean vertical layout
  if (prefersReducedMotion) {
    return (
      <div id={id} className={`py-24 px-6 max-w-6xl mx-auto space-y-16 ${className}`}>
        {sectionHeading}
        <div className="space-y-12">
          {slides.map((s) => (
            <div
              key={s.id}
              className="p-8 bg-[#121520] border border-white/10 rounded-[3px] space-y-6"
            >
              <div className="flex justify-between items-center text-xs font-mono text-accent-teal">
                <span>{s.number}</span>
                <span>{s.badge}</span>
              </div>
              <h3 className="headline-chapter text-white">{s.title}</h3>
              <p className="text-text-secondary text-sm max-w-xl">{s.description}</p>
              <div className="pt-4">{s.visual}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      id={id}
      className={`relative w-full h-screen overflow-hidden bg-[#0A0B10] text-[#F8FAFC] flex flex-col justify-between ${className}`}
      style={{ perspective: '1200px' }}
    >
      {/* Top Header & Live Counter Bar */}
      <div className="pt-24 px-8 sm:px-16 flex items-end justify-between border-b border-white/10 pb-6 shrink-0 z-20">
        <div>{sectionHeading}</div>

        <div className="flex items-center gap-6 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-accent-teal font-semibold text-sm">
              0{currentSlide}
            </span>
            <span className="text-white/30">/</span>
            <span className="text-white/50">0{slides.length}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-white/40">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Scroll Down to Advance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Horizontal Sliding Track */}
      <div className="flex-1 relative flex items-center overflow-hidden">
        <div
          ref={trackRef}
          className="flex h-[75vh] w-[300vw] items-center will-change-transform"
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="w-[100vw] h-full flex items-center justify-center px-6 sm:px-16 shrink-0"
            >
              <div className="horizontal-slide-card w-full max-w-5xl h-[85%] bg-[#121520] border border-white/10 rounded-[3px] p-6 sm:p-10 flex flex-col lg:flex-row items-center gap-8 shadow-2xl relative overflow-hidden transition-transform">
                {/* Left Description Column */}
                <div className="w-full lg:w-5/12 flex flex-col justify-between h-full space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">
                        Topology {slide.number}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-white/5 border border-white/10 rounded-[2px] text-white/70">
                        {slide.badge}
                      </span>
                    </div>

                    <h3 className="headline-chapter text-white mb-3">
                      {slide.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      {slide.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
                    <span>Discrete Model</span>
                    <span>{slide.subtitle}</span>
                  </div>
                </div>

                {/* Right Interactive/SVG Visual Column */}
                <div className="w-full lg:w-7/12 h-full min-h-[260px] bg-[#0A0B10] border border-white/5 rounded-[2px] p-4 flex items-center justify-center relative overflow-hidden">
                  {slide.visual}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Horizontal Hairline Bar */}
      <div className="px-8 sm:px-16 py-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/40 shrink-0">
        <span>Deterministic Graph Topologies</span>
        <span>Curved Horizon Scroll</span>
      </div>
    </div>
  )
}
