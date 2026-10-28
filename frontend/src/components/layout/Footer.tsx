import React from 'react'
import { Link } from 'react-router-dom'
import { Network, ArrowUp } from 'lucide-react'
import { Container } from './Container'

const CURRENT_YEAR = new Date().getFullYear()

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="w-full border-t border-[#2A2C31] bg-[#121315] text-[#E4E8EC] pt-16 pb-12 mt-auto">
      <Container size="wide" className="space-y-12">
        {/* Main 12-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand Column: 6 cols */}
          <div className="md:col-span-6 space-y-3">
            <Link to="/" className="flex items-center gap-2.5 text-[#E4E8EC] hover:text-white transition-colors group select-none">
              <div className="w-7 h-7 rounded-[2px] bg-[#1E2024] border border-[#2A2C31] flex items-center justify-center text-[#E4E8EC] group-hover:border-[#E5484D] group-hover:text-[#E5484D] transition-colors">
                <Network className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <span className="font-semibold text-xs tracking-wider uppercase font-mono">NetShield</span>
            </Link>
            <p className="text-xs text-[#8E97A2] max-w-sm leading-relaxed text-pretty">
              Graph-Theoretic Network Reliability and Failure Simulation System.
              An educational discrete mathematics laboratory exploring connectivity, percolation,
              and component breakdowns.
            </p>
          </div>

          {/* Navigation Links Column: 3 cols */}
          <div className="md:col-span-3 space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#8E97A2]">
              Platform
            </div>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <Link to="/studio" className="text-[#C3CAD2] hover:text-[#E4E8EC] transition-colors">
                  Network Studio
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-[#C3CAD2] hover:text-[#E4E8EC] transition-colors">
                  Metrics Dashboard
                </Link>
              </li>
              <li>
                <a href="/#methodology" className="text-[#C3CAD2] hover:text-[#E4E8EC] transition-colors">
                  Formal Methodology
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links Column: 3 cols */}
          <div className="md:col-span-3 space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#8E97A2]">
              Disclosure
            </div>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <Link to="/privacy" className="text-[#C3CAD2] hover:text-[#E4E8EC] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-[#C3CAD2] hover:text-[#E4E8EC] transition-colors">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link to="/studio" className="text-[#E5484D] hover:underline transition-colors flex items-center gap-1">
                  <span>Open Simulator</span>
                  <span>&rarr;</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Aligned Copyright Row & Back to Top */}
        <div className="pt-8 border-t border-[#2A2C31] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#8E97A2]">
          <div>
            &copy; {CURRENT_YEAR} NetShield Project. Academic coursework release.
          </div>

          <div className="flex items-center gap-6">
            <span>FastAPI NetworkX Core &bull; ReactFlow Canvas</span>
            <button
              type="button"
              onClick={scrollToTop}
              className="text-[#C3CAD2] hover:text-[#E4E8EC] flex items-center gap-1.5 transition-colors cursor-pointer"
              aria-label="Back to top of page"
            >
              <span>Back to top</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Container>
    </footer>
  )
}
