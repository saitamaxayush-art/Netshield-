/** 16px legend glyphs that match the canvas marks (shape plus colour). */
const S = { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true } as const

export const HealthyGlyph = () => (
  <svg {...S}>
    <line x1="1" y1="8" x2="15" y2="8" stroke="var(--fg-muted)" strokeWidth="1.25" />
    <circle cx="8" cy="8" r="4" fill="var(--s-100)" stroke="var(--fg-strong)" strokeWidth="1.25" />
  </svg>
)
export const FailedEdgeGlyph = () => (
  <svg {...S}>
    <line x1="1" y1="8" x2="15" y2="8" stroke="var(--r-500)" strokeWidth="1.5" strokeDasharray="3 2.5" />
  </svg>
)
export const FailedNodeGlyph = () => (
  <svg {...S}>
    <circle cx="8" cy="8" r="5.5" fill="none" stroke="var(--r-500)" strokeWidth="1.5" />
    <path d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5" stroke="var(--r-500)" strokeWidth="1.5" />
  </svg>
)
export const BridgeGlyph = () => (
  <svg {...S}>
    <line x1="1" y1="8" x2="15" y2="8" stroke="var(--r-500)" strokeWidth="1.5" />
    <rect x="5" y="5" width="6" height="6" transform="rotate(45 8 8)" fill="var(--r-500)" />
  </svg>
)
export const CutGlyph = () => (
  <svg {...S}>
    <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--r-500)" strokeWidth="1.5" />
    <circle cx="8" cy="8" r="3" fill="var(--fg-strong)" />
  </svg>
)
