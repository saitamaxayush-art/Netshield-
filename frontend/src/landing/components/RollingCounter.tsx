import React from 'react'

/**
 * Digits roll vertically to their new value. Each position is a strip of
 * 0 to 9 translated by whole em steps, so it rests on an exact offset.
 * The value is exposed to assistive tech as plain text.
 */
export function RollingCounter({
  value,
  pad = 1,
  decimals = 0,
  className = '',
  label,
}: {
  value: number
  pad?: number
  decimals?: number
  className?: string
  label?: string
}) {
  const text = value.toFixed(decimals).padStart(pad + (decimals ? decimals + 1 : 0), '0')
  return (
    <span className={`ns-roll ${className}`} data-value={text}>
      <span className="sr-only" style={srOnly}>
        {label ? `${label}: ${text}` : text}
      </span>
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        {text.split('').map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={`d${text.length - i}`} className="ns-roll__digit">
              <span className="ns-roll__strip" style={{ transform: `translate3d(0, -${Number(ch)}em, 0)` }}>
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={`s${text.length - i}`} style={{ display: 'inline-block', width: '1ch', textAlign: 'center' }}>
              {ch}
            </span>
          )
        )}
      </span>
    </span>
  )
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
