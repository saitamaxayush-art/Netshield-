import { Link } from 'react-router-dom'

/** NetShield mark: three nodes, two healthy links and one failed (dashed red) link. */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5 L15 5 M5 5 L10 15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 5 L10 15" stroke="var(--r-500)" strokeWidth="1.5" strokeDasharray="2 2" />
      <rect x="2.75" y="2.75" width="4.5" height="4.5" fill="var(--c-900)" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12.75" y="2.75" width="4.5" height="4.5" fill="var(--c-900)" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7.75" y="12.75" width="4.5" height="4.5" fill="var(--c-900)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function Wordmark({ onClick }: { onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <Link to="/" className="ns-wordmark" aria-label="NetShield, back to top" onClick={onClick} data-cursor="Top">
      <Mark />
      <span>NetShield</span>
    </Link>
  )
}
