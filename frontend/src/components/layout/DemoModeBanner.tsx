/**
 * Shown on every page while the demo adapter is active. Demo mode starts only from
 * VITE_USE_DEMO_ADAPTER=true or the explicit "Switch to demo mode" action, never automatically.
 */
import React from 'react'
import { useSettingsStore } from '@/store/settingsStore'

export const DemoModeBanner: React.FC = () => {
  const adapterMode = useSettingsStore((s) => s.adapterMode)
  const exitDemoMode = useSettingsStore((s) => s.exitDemoMode)
  if (adapterMode !== 'demo') return null
  return (
    <div
      role="status"
      data-testid="demo-mode-banner"
      className="fixed bottom-0 inset-x-0 z-[60] px-4 py-2 border-t border-state-warning/40 bg-state-warning-dim text-state-warning text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 backdrop-blur-sm"
    >
      <span>
        Demo mode is on: results are computed in your browser by the demo adapter, not by the NetShield backend, and every
        one is labelled Demo result.
      </span>
      <button
        type="button"
        onClick={exitDemoMode}
        className="px-2 py-1 border border-state-warning/60 rounded-[2px] hover:bg-state-warning/10 cursor-pointer"
      >
        Exit demo mode
      </button>
    </div>
  )
}

export default DemoModeBanner
