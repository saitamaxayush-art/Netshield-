import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface SegmentProgressHandle {
  /** Continuous progress in segments, 0 to count. Writes transforms directly. */
  set: (value: number) => void
}

/**
 * Thin segments that fill as a paginated or pinned block advances.
 * Controlled through `value`, or imperatively through the ref for scrubbed
 * progress (no React renders while scrolling).
 */
export const SegmentProgress = forwardRef<SegmentProgressHandle, { count: number; value?: number; label?: string; className?: string }>(
  function SegmentProgress({ count, value = 0, label = 'Progress', className = '' }, ref) {
    const fills = useRef<Array<HTMLElement | null>>([])
    useImperativeHandle(ref, () => ({
      set(v: number) {
        fills.current.forEach((el, i) => {
          if (!el) return
          el.style.transition = 'none'
          const f = Math.min(1, Math.max(0, v - i))
          el.style.transform = `scaleX(${f.toFixed(4)})`
        })
      },
    }))
    return (
      <div
        className={`ns-segments ${className}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={Math.min(count, Math.max(1, Math.ceil(value)))}
      >
        {Array.from({ length: count }, (_, i) => (
          <span key={i}>
            <i
              ref={(el) => {
                fills.current[i] = el
              }}
              style={{
                transform: `scaleX(${Math.min(1, Math.max(0, value - i))})`,
                transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </span>
        ))}
      </div>
    )
  }
)
