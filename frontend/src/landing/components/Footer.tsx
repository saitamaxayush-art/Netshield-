import { Link } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import { LContainer, LGrid, Cell } from './Layout'
import { Wordmark } from './Wordmark'
import { scrollToTarget } from '../motion/engine'

/** Evaluated when the bundle runs in the browser, so it is always the visitor's current year. */
const YEAR = new Date().getFullYear()

const linkStyle: React.CSSProperties = { color: 'var(--s-100)', textDecoration: 'none' }

export function Footer() {
  return (
    <footer className="ns-surface-dark" style={{ background: 'var(--c-950)', borderTop: '1px solid var(--c-700)' }}>
      <LContainer style={{ paddingBlock: 'var(--sp-10) var(--sp-7)' }} data-align="footer">
        <LGrid style={{ rowGap: 'var(--sp-7)' }}>
          <Cell d="1 / 7" t="1 / 5" m="1 / -1">
            <Wordmark
              onClick={(e) => {
                e.preventDefault()
                scrollToTarget(0)
              }}
            />
            <p className="ns-small" style={{ marginTop: 'var(--sp-3)', maxWidth: '40ch' }}>
              A graph theoretic network reliability and failure simulation system. Discrete Mathematics semester project.
            </p>
          </Cell>
          <Cell d="7 / 10" t="5 / 7" m="1 / 3">
            <p className="ns-micro ns-foothead">
              Product
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
              <li>
                <Link to="/studio" className="ns-footlink" style={linkStyle}>
                  Simulator
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="ns-footlink" style={linkStyle}>
                  Dashboard
                </Link>
              </li>
              <li>
                <a href="#method" className="ns-footlink" style={linkStyle} onClick={(e) => { e.preventDefault(); scrollToTarget('#method', { offset: -63 }) }}>
                  Method
                </a>
              </li>
            </ul>
          </Cell>
          <Cell d="10 / 13" t="7 / 9" m="3 / 5">
            <p className="ns-micro ns-foothead">
              Legal
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
              <li>
                <Link to="/privacy" className="ns-footlink" style={linkStyle}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="ns-footlink" style={linkStyle}>
                  Terms and Conditions
                </Link>
              </li>
            </ul>
          </Cell>
        </LGrid>
        <div
          style={{
            marginTop: 'var(--sp-9)',
            paddingTop: 'var(--sp-5)',
            borderTop: '1px solid var(--c-700)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-4)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p className="ns-small ns-num" style={{ margin: 0 }}>
            &copy; {YEAR} NetShield
          </p>
          <button type="button" className="ns-btn ns-btn--quiet ns-btn--sm" onClick={() => scrollToTarget(0)} data-cursor="Top" style={{ marginRight: -12 }}>
            <span className="ns-btn__inner">
              <span>Back to top</span>
              <ArrowUp aria-hidden="true" />
            </span>
          </button>
        </div>
      </LContainer>
    </footer>
  )
}
