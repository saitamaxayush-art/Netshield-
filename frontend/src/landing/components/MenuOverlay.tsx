import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, X } from 'lucide-react'
import { CHAPTERS, useActiveChapter } from '../chapters'
import { lockScroll } from '../motion/engine'
import { LContainer } from './Layout'
import { Mark } from './Wordmark'

const wipe = [0.76, 0, 0.24, 1] as const
const reveal = [0.16, 1, 0.3, 1] as const

/**
 * Full screen menu: panel wipe in, items revealed line by line, focus trap,
 * Escape closes, scroll locked without layout shift (scrollbar gap is
 * compensated), focus restored to the trigger by the caller.
 */
export function MenuOverlay({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (id: string) => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const active = useActiveChapter()

  useEffect(() => {
    if (!open) return
    lockScroll(true)
    const el = panel.current
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []).filter((n) => n.offsetParent !== null)
    requestAnimationFrame(() => focusables()[0]?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      lockScroll(false)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panel}
          className="ns-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          data-lenis-prevent=""
          initial={{ clipPath: 'inset(0% 0% 100% 0%)' }}
          animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
          exit={{ clipPath: 'inset(0% 0% 100% 0%)' }}
          transition={{ duration: 0.9, ease: wipe }}
        >
          <LContainer className="ns-header__row" style={{ flex: 'none', paddingTop: 'env(safe-area-inset-top)' }}>
            <span className="ns-wordmark" style={{ color: 'var(--c-900)' }}>
              <Mark />
              <span>NetShield</span>
            </span>
            <button type="button" className="ns-icon-btn" aria-label="Close menu" onClick={onClose} style={{ color: 'var(--c-900)', borderColor: 'var(--s-300)' }}>
              <X aria-hidden="true" />
            </button>
          </LContainer>
          <LContainer style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBlock: 32 }}>
            <nav aria-label="Menu">
              <ul className="ns-menu__list">
                {CHAPTERS.map((c, i) => (
                  <li key={c.id} style={{ overflow: 'clip' }}>
                    <motion.a
                      href={`#${c.id}`}
                      className="ns-menu__item"
                      aria-current={active === c.id ? 'true' : undefined}
                      onClick={(e) => {
                        e.preventDefault()
                        onNavigate(c.id)
                      }}
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.9, ease: reveal, delay: 0.25 + i * 0.05 }}
                    >
                      <span className="ns-micro ns-num">{c.number}</span>
                      <span className="ns-menu__label" style={active === c.id ? { color: 'var(--r-600)' } : undefined}>
                        {c.label}
                      </span>
                    </motion.a>
                  </li>
                ))}
              </ul>
            </nav>
            <motion.div
              style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 32, alignItems: 'center' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.7 }}
            >
              <Link to="/studio" className="ns-btn ns-btn--primary">
                <span className="ns-btn__inner">
                  <span>Open Simulator</span>
                  <ArrowUpRight aria-hidden="true" />
                </span>
              </Link>
              <Link to="/privacy" className="ns-small" style={{ color: 'var(--c-700)' }}>
                Privacy Policy
              </Link>
              <Link to="/terms" className="ns-small" style={{ color: 'var(--c-700)' }}>
                Terms and Conditions
              </Link>
            </motion.div>
          </LContainer>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
