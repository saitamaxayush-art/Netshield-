import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

export interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  isDanger?: boolean
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  isDanger = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md bg-bg-surface border border-border-strong rounded-[4px] shadow-2xl p-6 text-left animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h2 id="dialog-title" className="text-base font-semibold text-text-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded-[2px] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {description && (
          <p className="mt-2 text-xs text-text-secondary leading-relaxed">
            {description}
          </p>
        )}

        <div className="py-4 text-sm text-text-primary">{children}</div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button
              variant={isDanger ? 'danger' : 'primary'}
              size="sm"
              onClick={() => {
                onConfirm()
                onClose()
              }}
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
