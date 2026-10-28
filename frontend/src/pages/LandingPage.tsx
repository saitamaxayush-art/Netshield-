import React from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ScrollProgressBar } from '@/components/layout/ScrollProgressBar'
import { ChapterNav } from '@/components/editorial/ChapterNav'
import { useLenisScroll } from '@/lib/useLenisScroll'

// Exactly the 9 Specified Landing Sections in Alternating Charcoal & Silver Rhythm
import { EditorialHeroSection } from '@/features/landing/EditorialHeroSection'
import { StatementCollageSection } from '@/features/landing/StatementCollageSection'
import { HowItWorksSection } from '@/features/landing/HowItWorksSection'
import { BigWordListSection } from '@/features/landing/BigWordListSection'
import { MathematicalInsightsSection } from '@/features/landing/MathematicalInsightsSection'
import { MethodStatementSection } from '@/features/landing/MethodStatementSection'
import { ClosingSection } from '@/features/landing/ClosingSection'

const chapters = [
  { id: 'intro', number: '01', label: 'Intro' },
  { id: 'statement', number: '02', label: 'Thesis' },
  { id: 'how-it-works', number: '03', label: 'Flow' },
  { id: 'topologies', number: '04', label: 'Topologies' },
  { id: 'analysis', number: '05', label: 'Insights' },
  { id: 'methodology', number: '06', label: 'Method' },
]

export const LandingPage: React.FC = () => {
  // Drive unified Lenis + GSAP ScrollTrigger requestAnimationFrame loop
  useLenisScroll(true)

  return (
    <div
      data-theme="landing"
      className="min-h-screen flex flex-col bg-[#17181B] text-[#E4E8EC] selection:bg-[#E5484D]/25 selection:text-[#F3F5F7] overflow-x-hidden font-sans"
    >
      {/* 2px Signal Red Scroll Progress Bar */}
      <ScrollProgressBar />

      {/* 1. Navigation: Minimal tripartite layout with accessible overlay */}
      <Navbar />

      {/* Floating Chapter Table of Contents */}
      <ChapterNav chapters={chapters} />

      {/* Main Choreographed 9-Section Sequence */}
      <main className="flex-1 w-full overflow-hidden">
        {/* 2. Hero (Charcoal): 3D network, silver nodes/lines, rare red failing edge, primary/secondary CTAs */}
        <EditorialHeroSection />

        {/* 3. Statement (Silver): Line-masked thesis with expanding topology frames on silver-50 */}
        <StatementCollageSection />

        {/* 4. How it works (Charcoal): 3-stage pinned story (Model, Introduce failures, Measure connectivity) */}
        <HowItWorksSection />

        {/* 5. Topologies (Silver): Star, Ring, Mesh as selectable words with rolling counter & live graph swap */}
        <BigWordListSection />

        {/* 6. Mathematical insights (Charcoal): Interactive bridges, cut vertices demo, silver component steps */}
        <MathematicalInsightsSection />

        {/* 7. Reliability method (Silver): Plain honest estimation explanation, 1-3 pagination, segment progress */}
        <MethodStatementSection />

        {/* 8. Final CTA (Charcoal): Large statement, Signal Red button, scroll-driven network trace path */}
        <ClosingSection />
      </main>

      {/* 9. Footer (Charcoal-950): Aligned to container grid, legal links, runtime year, back to top */}
      <Footer />
    </div>
  )
}

export default LandingPage
