import React, { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { X, ArrowRight, Terminal } from 'lucide-react'

const CURRENT_YEAR = new Date().getFullYear()

interface EditorialMenuOverlayProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * EditorialMenuOverlay: Full-screen menu overlay in charcoal grey, moonlit silver, and signal red
 * with panel wipe open/close and line-by-line masked item reveals.
 */
export const EditorialMenuOverlay: React.FC<EditorialMenuOverlayProps> = ({
  isOpen,
  onClose,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const menuLinesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = overlayRef.current
    const lines = menuLinesRef.current
    if (!el || !lines) return

    if (isOpen) {
      document.body.style.overflow = 'hidden'

      gsap.set(el, { display: 'flex', clipPath: 'inset(0% 0% 100% 0%)' })
      const lineElements = lines.querySelectorAll('.menu-item-inner')
      gsap.set(lineElements, { yPercent: 120, opacity: 0 })

      const tl = gsap.timeline()
      tl.to(el, {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.75,
        ease: 'power3.inOut',
      }).to(
        lineElements,
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.85,
          ease: 'power4.out',
          stagger: 0.08,
        },
        '-=0.25'
      )
    } else {
      document.body.style.overflow = ''
      gsap.to(el, {
        clipPath: 'inset(100% 0% 0% 0%)',
        duration: 0.6,
        ease: 'power3.inOut',
        onComplete: () => {
          gsap.set(el, { display: 'none' })
        },
      })
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const menuItems = [
    { label: 'Network Studio', path: '/studio', subtitle: 'Interactive Graph Editor & Simulator' },
    { label: 'Metrics Dashboard', path: '/dashboard', subtitle: 'Topological Reliability Overview' },
    { label: 'Methodology', path: '/#methodology', subtitle: 'Tarjan Cut Algorithm & Monte Carlo' },
    { label: 'Topologies', path: '/#topologies', subtitle: 'Star, Ring, and Redundant Mesh Models' },
    { label: 'Privacy Policy', path: '/privacy', subtitle: 'Local Storage & Data Disclosure' },
    { label: 'Terms of Use', path: '/terms', subtitle: 'Academic Coursework Guidelines' },
  ]

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-[#121315] text-[#E4E8EC] hidden flex-col justify-between p-8 sm:p-16 select-none"
      style={{ willChange: 'clip-path' }}
      role="dialog"
      aria-modal="true"
      aria-label="Site Navigation Menu"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between border-b border-[#2A2C31] pb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#1E2024] border border-[#2A2C31] rounded-[2px] flex items-center justify-center text-[#E5484D]">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#C3CAD2]">
            NetShield Navigation
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#8E97A2] hover:text-[#E4E8EC] transition-colors p-2 cursor-pointer focus-visible:outline-none"
          aria-label="Close menu"
        >
          <span>Close</span>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Menu Links with Line-Mask Reveals */}
      <div
        ref={menuLinesRef}
        className="my-auto py-8 max-w-4xl w-full mx-auto space-y-4 sm:space-y-6"
      >
        {menuItems.map((item, idx) => (
          <div key={item.path} className="line-mask overflow-hidden py-1 -my-1">
            <Link
              to={item.path}
              onClick={onClose}
              className="menu-item-inner flex items-baseline justify-between group text-left cursor-pointer transition-transform duration-300 hover:translate-x-3"
            >
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-[#8E97A2] mr-4">
                  0{idx + 1}
                </span>
                <span className="headline-chapter text-[#E4E8EC] group-hover:text-[#E5484D] transition-colors">
                  {item.label}
                </span>
                <p className="text-xs text-[#8E97A2] font-mono pl-8">
                  {item.subtitle}
                </p>
              </div>

              <ArrowRight className="w-6 h-6 text-[#8E97A2] opacity-0 group-hover:opacity-100 group-hover:text-[#E5484D] transition-all -translate-x-4 group-hover:translate-x-0" />
            </Link>
          </div>
        ))}
      </div>

      {/* Bottom Footer Row */}
      <div className="pt-6 border-t border-[#2A2C31] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#8E97A2] shrink-0">
        <div className="flex items-center gap-2">
          <span>&copy; {CURRENT_YEAR} NetShield Project</span>
          <span>&bull;</span>
          <span>Discrete Mathematics Research</span>
        </div>

        <div className="flex items-center gap-6">
          <Link
            to="/studio"
            onClick={onClose}
            className="text-[#E5484D] hover:underline flex items-center gap-1.5 font-medium"
          >
            <span>Open Simulator</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
