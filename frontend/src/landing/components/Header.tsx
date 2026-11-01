import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowUpRight, Menu } from 'lucide-react'
import { CHAPTERS, useActiveChapter } from '../chapters'
import { headerOffset, motionEnabled, scrollState, scrollToTarget } from '../motion/engine'
import { LContainer } from './Layout'
import { LButtonLink } from './Button'
import { Wordmark } from './Wordmark'
import { MenuOverlay } from './MenuOverlay'

/**
 * Fixed 64px header. Height never changes; it only translates. Hide on
 * scroll down and show on scroll up is driven from the shared ticker by
 * writing data attributes, so scrolling causes no React renders.
 */
export function Header() {
  const ref = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const active = useActiveChapter()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let travel = 0
    let lastY = scrollState.y
    const tick = () => {
      const y = scrollState.y
      const dy = y - lastY
      lastY = y
      const solid = y > 24 ? 'true' : 'false'
      if (el.dataset.solid !== solid) el.dataset.solid = solid
      if (!motionEnabled()) return
      if (el.contains(document.activeElement)) {
        el.dataset.hidden = 'false'
        return
      }
      // Hysteresis: accumulate directional travel with deadband, reset only on direction reversal
      if (Math.abs(dy) > 0.5) {
        if ((dy > 0 && travel < 0) || (dy < 0 && travel > 0)) {
          travel = dy
        } else {
          travel += dy
        }
      }
      if (y < 120) el.dataset.hidden = 'false'
      else if (travel > 48) el.dataset.hidden = 'true'
      else if (travel < -24) el.dataset.hidden = 'false'
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  const jump = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    scrollToTarget(`#${id}`, { offset: id === 'top' ? 0 : -headerOffset() + 1 })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <>
      <header ref={ref} className="ns-header" data-solid="false" data-hidden="false">
        <LContainer className="ns-header__row" data-align="header">
          <Wordmark
            onClick={(e) => {
              e.preventDefault()
              scrollToTarget(0)
            }}
          />
          <nav aria-label="Primary" className="ns-nav-wrap">
            <ul className="ns-navlinks">
              {CHAPTERS.filter((c) => c.inHeader).map((c) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="ns-navlink" aria-current={active === c.id ? 'true' : undefined} onClick={jump(c.id)} data-cursor="Jump">
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LButtonLink to="/studio" variant="primary" size="sm" icon={<ArrowUpRight aria-hidden="true" />}>
              Open Simulator
            </LButtonLink>
            <button
              ref={menuButton}
              type="button"
              className="ns-icon-btn ns-menu-btn"
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              data-cursor="Menu"
            >
              <Menu aria-hidden="true" />
            </button>
          </div>
        </LContainer>
      </header>
      <MenuOverlay
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false)
          // Restore focus to the trigger after the overlay unmounts.
          requestAnimationFrame(() => menuButton.current?.focus())
        }}
        onNavigate={(id) => {
          setMenuOpen(false)
          requestAnimationFrame(() => scrollToTarget(`#${id}`, { offset: id === 'top' ? 0 : -headerOffset() + 1, immediate: true }))
        }}
      />
    </>
  )
}
