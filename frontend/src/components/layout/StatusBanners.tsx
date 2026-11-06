/**
 * Banners shown on every app page (not the landing page), stacked at the bottom of the viewport:
 * - "Cannot reach the analysis server", with Retry, an explicit "Use demo mode", and Dismiss (a chip
 *   stays so it can be reopened).
 * - The persistent demo mode banner while the demo adapter is active.
 * Their height is published as --ns-banner-h so pages can leave room for them.
 */
import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { useHealthStore, FOCUS_CHECK_INTERVAL_MS } from '@/store/healthStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAnalysisStore } from '@/store/analysisStore'

const button = 'min-h-10 px-3 border rounded-[2px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2'

export const StatusBanners: React.FC = () => {
  const adapterMode = useSettingsStore((s) => s.adapterMode)
  const { exitDemoMode, switchToDemoMode } = useSettingsStore.getState()
  const status = useHealthStore((s) => s.status)
  const error = useHealthStore((s) => s.error)
  const dismissed = useHealthStore((s) => s.dismissed)
  const { check, dismiss, reopen } = useHealthStore.getState()
  const ref = useRef<HTMLDivElement>(null)

  // Health check on load and whenever the window comes back into focus.
  useEffect(() => {
    void check()
    const onFocus = () => {
      const last = useHealthStore.getState().checkedAt
      if (last === null || Date.now() - last > FOCUS_CHECK_INTERVAL_MS) void check()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const publish = () => document.documentElement.style.setProperty('--ns-banner-h', `${el.offsetHeight}px`)
    publish()
    // Without ResizeObserver (older browsers), the height is published when the banners change.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(publish) : null
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      document.documentElement.style.setProperty('--ns-banner-h', '0px')
    }
  }, [status, dismissed, adapterMode])

  const retry = async () => {
    await check()
    // Back online: bring the failed results back without waiting for the next edit.
    if (useHealthStore.getState().status === 'online') {
      const analysis = useAnalysisStore.getState()
      if (analysis.analyze.error) void analysis.run('analyze')
    }
  }

  const offline = status === 'offline' && adapterMode === 'backend'
  return (
    <div ref={ref} className="fixed bottom-0 inset-x-0 z-[60] flex flex-col">
      {offline && !dismissed && (
        <div
          role="alert"
          data-testid="offline-banner"
          className="px-4 py-2 border-t border-state-failure/50 bg-[#2A1520] text-state-failure text-[11px] font-mono flex flex-wrap items-center justify-between gap-2"
        >
          <span>
            <strong className="font-semibold">Cannot reach the analysis server.</strong> {error?.message ?? ''} No results are shown until it is back, unless you choose demo mode.
          </span>
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void retry()} className={`${button} border-state-failure/60 hover:bg-state-failure/10`}>
              Retry
            </button>
            <button type="button" onClick={switchToDemoMode} className={`${button} border-state-warning/60 text-state-warning hover:bg-state-warning/10`}>
              Use demo mode
            </button>
            <button type="button" onClick={dismiss} className={`${button} border-border-strong text-text-secondary hover:text-text-primary`}>
              Dismiss
            </button>
          </span>
        </div>
      )}
      {offline && dismissed && (
        <div className="flex justify-end px-3 pb-2">
          <button
            type="button"
            data-testid="offline-chip"
            onClick={reopen}
            className={`${button} bg-[#2A1520] border-state-failure/60 text-state-failure text-[11px] font-mono`}
            aria-label="Analysis server offline. Show details"
          >
            Server offline
          </button>
        </div>
      )}
      {adapterMode === 'demo' && (
        <div
          role="status"
          data-testid="demo-mode-banner"
          className="px-4 py-2 border-t border-state-warning/40 bg-[#2A2210] text-state-warning text-[11px] font-mono flex flex-wrap items-center justify-between gap-2"
        >
          <span>
            Demo mode is on: results are computed in your browser by the demo adapter, not by the NetShield backend, and every one is labelled Demo result.
          </span>
          <button type="button" onClick={exitDemoMode} className={`${button} border-state-warning/60 hover:bg-state-warning/10`}>
            Exit demo mode
          </button>
        </div>
      )}
    </div>
  )
}

export default StatusBanners
