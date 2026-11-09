import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Network, Menu, X, Terminal, Activity, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from './Container'
import { EditorialMenuOverlay } from '@/components/editorial/EditorialMenuOverlay'
import { TutorialSwitch } from '@/features/tour/TutorialSwitch'
import { useTourStore } from '@/store/tourStore'

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMethodologyActive, setIsMethodologyActive] = useState(false)
  const [editorialMenuOpen, setEditorialMenuOpen] = useState(false)
  const location = useLocation()
  const lastScrollY = useRef(0)

  const isLandingPage = location.pathname === '/'
  // The studio and dashboard carry the Tutorial switch: the header stays in view there, and sits above
  // the tour's dimmed overlay while the tour is on, so the switch can always turn it off.
  const hasTutorial = location.pathname === '/studio' || location.pathname === '/dashboard'
  const tourOn = useTourStore((s) => s.active)

  // Track scroll state: hide on scroll down, show on scroll up with smooth transition
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      setScrolled(currentY > 24)

      if (currentY > 160 && currentY > lastScrollY.current + 8) {
        setHidden(true)
      } else if (currentY < lastScrollY.current - 8 || currentY <= 160) {
        setHidden(false)
      }
      lastScrollY.current = currentY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Section highlight for #methodology on landing page
  useEffect(() => {
    if (!isLandingPage) return

    const methodologyEl = document.getElementById('methodology')
    if (!methodologyEl) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMethodologyActive(entry.isIntersecting)
      },
      { rootMargin: '-20% 0px -50% 0px' }
    )

    observer.observe(methodologyEl)
    return () => observer.disconnect()
  }, [isLandingPage])

  // Reset mobile menu upon route change
  const [prevPath, setPrevPath] = useState(location.pathname)
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname)
    setMobileMenuOpen(false)
    setEditorialMenuOpen(false)
  }

  const scrollToMethodology = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isLandingPage) {
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
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 ${hasTutorial && tourOn ? 'z-[90]' : 'z-40'} h-16 transition-all duration-300 ${
          hidden && !hasTutorial ? '-translate-y-full' : 'translate-y-0'
        } ${
          isLandingPage
            ? scrolled
              ? 'bg-[#17181B]/95 backdrop-blur-md border-b border-[#2A2C31]/80 shadow-xs'
              : 'bg-transparent border-b border-transparent'
            : scrolled
              ? 'bg-bg-primary/95 backdrop-blur-md border-b border-border-subtle shadow-xs'
              : 'bg-transparent border-b border-transparent'
        }`}
      >
        <Container size="wide" className="h-full flex items-center justify-between">
          {/* Landing Page Navigation */}
          {isLandingPage ? (
            <>
              {/* Left: Minimal Menu Trigger + Methodology Anchor */}
              <div className="flex-1 flex items-center justify-start gap-4">
                <button
                  type="button"
                  onClick={() => setEditorialMenuOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] border border-[#2A2C31] hover:border-[#E4E8EC] text-[#C3CAD2] hover:text-[#E4E8EC] transition-all text-xs font-mono uppercase tracking-wider cursor-pointer focus-visible:outline-none"
                  aria-label="Open full site navigation menu"
                >
                  <Menu className="w-3.5 h-3.5" />
                  <span>Menu</span>
                </button>

                <a
                  href="#methodology"
                  onClick={scrollToMethodology}
                  className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                    isMethodologyActive
                      ? 'text-[#E5484D] font-medium'
                      : 'text-[#8E97A2] hover:text-[#E4E8EC]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Methodology</span>
                </a>
              </div>

              {/* Center: Brand Wordmark */}
              <Link
                to="/"
                className="flex items-center gap-2.5 text-[#E4E8EC] hover:text-white transition-colors group select-none"
                aria-label="NetShield Home"
              >
                <div className="w-7 h-7 rounded-[2px] bg-[#1E2024] border border-[#2A2C31] flex items-center justify-center text-[#E4E8EC] group-hover:border-[#E5484D] group-hover:text-[#E5484D] transition-colors">
                  <Network className="w-3.5 h-3.5 stroke-[2]" />
                </div>
                <span className="font-semibold text-xs tracking-widest uppercase font-mono">
                  NetShield
                </span>
              </Link>

              {/* Right: Primary Signal Red CTA */}
              <div className="flex-1 flex items-center justify-end">
                <Link
                  to="/studio"
                  className="px-4 py-2 bg-[#E5484D] hover:bg-[#F0666A] active:bg-[#C93A3F] text-white font-mono text-xs uppercase tracking-wider font-semibold rounded-[2px] transition-colors flex items-center gap-2 shadow-xs"
                >
                  <span>Open Simulator</span>
                  <span className="text-white text-sm leading-none">&rarr;</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* App Shell Navigation (Dashboard, Studio, Privacy, Terms) */}
              <Link
                to="/"
                className="flex min-h-10 items-center gap-2.5 text-text-primary hover:text-accent-teal transition-colors group select-none"
              >
                <div className="w-8 h-8 rounded-[3px] bg-bg-surface border border-border-strong flex items-center justify-center text-accent-teal group-hover:border-accent-teal transition-colors">
                  <Network className="w-4 h-4 stroke-[1.75]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-xs tracking-wider uppercase leading-tight">
                    NetShield
                  </span>
                  <span className="text-[10px] text-text-muted font-mono tracking-tight">
                    Reliability Lab
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation Links */}
              <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-wider text-text-secondary">
                <Link
                  to="/dashboard"
                  className={`transition-colors hover:text-text-primary flex items-center gap-1.5 h-16 border-b-2 ${
                    location.pathname === '/dashboard'
                      ? 'border-accent-teal text-text-primary'
                      : 'border-transparent'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-accent-teal" />
                  <span>Dashboard</span>
                </Link>

                <Link
                  to="/studio"
                  className={`transition-colors hover:text-text-primary flex items-center gap-1.5 h-16 border-b-2 ${
                    location.pathname === '/studio'
                      ? 'border-accent-teal text-text-primary'
                      : 'border-transparent'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-accent-cyan" />
                  <span>Studio</span>
                </Link>

                <a
                  href="/#methodology"
                  onClick={scrollToMethodology}
                  className={`transition-colors hover:text-text-primary flex items-center gap-1.5 h-16 border-b-2 ${
                    isMethodologyActive && location.pathname === '/'
                      ? 'border-accent-teal text-text-primary'
                      : 'border-transparent'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-text-muted" />
                  <span>Methodology</span>
                </a>
              </nav>

              {/* Right: the Tutorial switch on the studio and dashboard, otherwise the way into the studio. */}
              {hasTutorial ? (
                <div className="ml-auto md:ml-0 flex items-center">
                  <TutorialSwitch />
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-3">
                  <Link to="/studio">
                    <Button variant="primary" size="sm">
                      Open Simulator
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile menu trigger */}
              <div className="flex md:hidden items-center ml-2">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary rounded-[3px] border border-border-subtle bg-bg-surface cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal"
                  aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </Container>

        {/* Mobile Drawer Menu for non-landing pages */}
        {!isLandingPage && mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-x-0 top-16 bg-bg-surface border-b border-border-strong p-6 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex flex-col gap-4 text-sm font-medium">
              <Link
                to="/dashboard"
                className="py-2.5 text-text-secondary hover:text-text-primary border-b border-border-subtle flex items-center gap-2.5"
              >
                <Activity className="w-4 h-4 text-accent-teal" />
                <span>Dashboard Overview</span>
              </Link>
              <Link
                to="/studio"
                className="py-2.5 text-text-secondary hover:text-text-primary border-b border-border-subtle flex items-center gap-2.5"
              >
                <Terminal className="w-4 h-4 text-accent-cyan" />
                <span>Network Studio</span>
              </Link>
              <a
                href="/#methodology"
                onClick={(e) => {
                  scrollToMethodology(e)
                  setMobileMenuOpen(false)
                }}
                className="py-2.5 text-text-secondary hover:text-text-primary border-b border-border-subtle flex items-center gap-2.5"
              >
                <BookOpen className="w-4 h-4 text-text-muted" />
                <span>Mathematical Methodology</span>
              </a>
              <div className="pt-2">
                <Link to="/studio" className="w-full block">
                  <Button variant="primary" size="md" className="w-full">
                    Open Simulator
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Editorial Menu Overlay for Landing Page */}
      <EditorialMenuOverlay
        isOpen={editorialMenuOpen}
        onClose={() => setEditorialMenuOpen(false)}
      />
    </>
  )
}
