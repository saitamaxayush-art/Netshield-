import { useLayoutEffect, useRef } from 'react'
import '@/landing/landing.css'
import { startEngine } from '@/landing/motion/engine'
import { observeChapters } from '@/landing/chapters'
import { Header } from '@/landing/components/Header'
import { Footer } from '@/landing/components/Footer'
import { ScrollProgress } from '@/landing/components/ScrollProgress'
import { ChapterNav } from '@/landing/components/ChapterNav'
import { Cursor } from '@/landing/components/Cursor'
import { ToastProvider } from '@/landing/components/Toast'
import { Hero } from '@/landing/hero/Hero'
import { Sandbox } from '@/landing/sections/Sandbox'
import { HowItWorks } from '@/landing/sections/HowItWorks'
import { Topologies } from '@/landing/sections/Topologies'
import { Estimator } from '@/landing/sections/Estimator'
import { Explorer } from '@/landing/sections/Explorer'
import { Method } from '@/landing/sections/Method'
import { FinalCta } from '@/landing/sections/FinalCta'

/**
 * Landing route. Theme, Lenis and pinning are scoped to this page and torn
 * down on unmount, so the studio and dashboard never see them.
 */
export function LandingPage() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const html = document.documentElement
    html.dataset.route = 'landing'
    const stopEngine = startEngine()
    const stopChapters = root.current ? observeChapters(root.current) : () => {}
    return () => {
      stopChapters()
      stopEngine()
      delete html.dataset.route
    }
  }, [])

  return (
    <div ref={root} className="ns-landing">
      <a className="ns-skip ns-btn ns-btn--primary ns-btn--sm" href="#main">
        <span className="ns-btn__inner">Skip to content</span>
      </a>
      <ScrollProgress />
      <Header />
      <ChapterNav />
      <Cursor />
      <ToastProvider>
        <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
          <Hero />
          <Sandbox />
          <HowItWorks />
          <Topologies />
          <Estimator />
          <Explorer />
          <Method />
          <FinalCta />
        </main>
        <Footer />
      </ToastProvider>
    </div>
  )
}

export default LandingPage
