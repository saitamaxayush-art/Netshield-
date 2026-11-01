/**
 * Debounced trigger behind useAutoAnalyze, free of React so it can be tested with fake timers.
 * `notify(key, nonEmpty)` is called on every relevant change; the run fires once the key has been
 * quiet for `delayMs`. A change while a run is in flight starts a new one, which supersedes the old
 * (the analysis store cancels it). An empty graph cancels any pending or running analysis.
 */
export interface AutoAnalyzer {
  notify: (key: string, nonEmpty: boolean) => void
  dispose: () => void
}

export const AUTO_ANALYZE_DELAY_MS = 300

export function createAutoAnalyzer(run: () => void, clear: () => void, delayMs = AUTO_ANALYZE_DELAY_MS): AutoAnalyzer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastKey: string | null = null
  const stop = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  return {
    notify: (key, nonEmpty) => {
      if (key === lastKey) return
      lastKey = key
      stop()
      if (!nonEmpty) {
        clear()
        return
      }
      timer = setTimeout(() => {
        timer = null
        run()
      }, delayMs)
    },
    dispose: stop,
  }
}
