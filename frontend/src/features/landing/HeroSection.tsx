import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { motion, useScroll, useTransform } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/layout/Container'
import { Hero3DContainer } from './Hero3DContainer'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

export const HeroSection: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion()
  const { scrollY } = useScroll()

  // Gentle scroll-linked hero fade & translation (disabled when reduced motion active)
  const contentOpacity = useTransform(scrollY, [0, 400], [1, 0.15])
  const contentY = useTransform(scrollY, [0, 400], [0, -32])
  const sceneScale = useTransform(scrollY, [0, 600], [1, 0.94])

  const scrollToMethodology = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const element = document.getElementById('methodology')
    if (element) {
      const navHeight = 64
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: elementPosition - navHeight,
        behavior: 'smooth',
      })
    }
  }

  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-20 pb-16 border-b border-border-subtle bg-bg-primary">
      {/* 3D Network Canvas with subtle scroll-linked scale */}
      <motion.div
        style={prefersReducedMotion ? undefined : { scale: sceneScale }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <Hero3DContainer />
      </motion.div>

      {/* Architectural gradient scrim to protect headline readability against 3D nodes */}
      <div
        className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-bg-primary via-bg-primary/85 to-transparent w-full md:w-3/4 lg:w-3/5"
        aria-hidden="true"
      />

      {/* Hero Content Grid snapped to layout Container */}
      <Container size="wide" className="relative z-20 w-full py-12">
        <motion.div
          style={prefersReducedMotion ? undefined : { opacity: contentOpacity, y: contentY }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          {/* Main 8-column hero text block */}
          <div className="lg:col-span-8 space-y-6 text-left">
            {/* Eyebrow label */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-bg-surface/80 border border-border-strong rounded-[2px] backdrop-blur-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-teal" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
                Discrete Mathematics &bull; Reliability Lab
              </span>
            </div>

            {/* Headline */}
            <h1 className="headline-editorial text-text-primary max-w-3xl text-balance">
              Understand how networks fail.
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-text-secondary max-w-2xl leading-relaxed text-pretty font-normal">
              Build a network, simulate component failures, and discover which connections keep it together.
              NetShield turns graph theory into an interactive reliability lab.
            </p>

            {/* Action CTA pair: matched fixed heights, identical baseline alignment */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-4">
              <Link to="/studio" className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto min-w-[170px]"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Open Simulator
                </Button>
              </Link>

              <a href="#methodology" onClick={scrollToMethodology} className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto min-w-[170px]"
                >
                  Explore the Method
                </Button>
              </a>
            </div>

            {/* Technical Specs footnote */}
            <div className="flex flex-wrap items-center gap-6 pt-6 text-xs text-text-muted font-mono border-t border-border-subtle/40 max-w-xl">
              <div className="flex items-center gap-1.5">
                <span className="text-accent-teal font-semibold">Tarjan</span>
                <span>Bridges &amp; Cut Vertices</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-accent-cyan font-semibold">Monte Carlo</span>
                <span>Bernoulli Trials</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary font-semibold">NetworkX</span>
                <span>Algorithmic Core</span>
              </div>
            </div>
          </div>

          {/* Reserved 4-column space for 3D focal area */}
          <div className="hidden lg:block lg:col-span-4 pointer-events-none" aria-hidden="true" />
        </motion.div>
      </Container>

      {/* Subtle scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none opacity-60">
        <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">Scroll</span>
        <ChevronDown className="w-4 h-4 text-accent-teal animate-bounce" />
      </div>
    </section>
  )
}
