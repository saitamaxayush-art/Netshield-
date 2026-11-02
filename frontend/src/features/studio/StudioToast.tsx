import React from 'react'
import { X } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'

/** Inline message over the canvas, explaining a refused edit. */
export const StudioToast: React.FC = () => {
  const message = useToastStore((s) => s.message)
  if (!message) return null
  return (
    <div
      role="alert"
      data-testid="studio-toast"
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[min(26rem,calc(100%-1.5rem))] pl-3 pr-1 py-1 flex items-center justify-between gap-2 bg-bg-surface border border-state-failure/60 text-state-failure text-[11px] font-mono rounded-[2px]"
    >
      <span>{message}</span>
      <button type="button" aria-label="Dismiss message" onClick={() => useToastStore.getState().dismiss()} className="w-8 h-8 shrink-0 flex items-center justify-center cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
