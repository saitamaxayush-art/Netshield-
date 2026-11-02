/** Bottom sheet for phones and tablets: scrim, title, close button, Escape and focus handling. */
import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export const Sheet: React.FC<{ isOpen: boolean; onClose: () => void; title: string; testId?: string; children: React.ReactNode }> = ({
  isOpen,
  onClose,
  title,
  testId,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-bg-primary/70" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        className="relative max-h-[80dvh] flex flex-col bg-bg-surface border-t border-border-strong rounded-t-[4px] outline-none"
      >
        <div className="h-12 shrink-0 flex items-center justify-between pl-4 pr-1 border-b border-border-subtle">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-primary cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
