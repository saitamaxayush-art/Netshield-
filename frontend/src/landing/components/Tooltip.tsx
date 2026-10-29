import React, { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/**
 * Tooltip for icon-only controls: shows on hover and keyboard focus,
 * links via aria-describedby, never required to operate the control.
 */
export function Tooltip({ label, children, side = 'top' }: { label: string; children: React.ReactElement<Record<string, unknown>>; side?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const child = React.cloneElement(children, {
    'aria-describedby': id,
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setOpen(true),
    onPointerLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  })
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {child}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            className="ns-tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{
              left: '50%',
              translateX: '-50%',
              ...(side === 'top' ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
            }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {!open && (
        <span id={id} hidden>
          {label}
        </span>
      )}
    </span>
  )
}
