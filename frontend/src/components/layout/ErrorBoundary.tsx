/**
 * Error boundaries. The app boundary replaces the whole page with a styled fallback; a panel boundary
 * keeps the rest of the page working and offers "Try again". Neither invents a result.
 */
import React from 'react'

interface BoundaryProps {
  children: React.ReactNode
  fallback: (error: Error, reset: () => void) => React.ReactNode
  /** Changing this resets the boundary (for example the active tab). */
  resetKey?: string
}
interface BoundaryState {
  error: Error | null
  key: string | undefined
}

export class ErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  reset = () => this.setState({ error: null })

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children
  }
}

export const AppErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" data-testid="app-error" className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
    <div className="max-w-md w-full p-6 bg-bg-surface border border-state-failure/40 rounded-[4px] space-y-4">
      <h1 className="text-base font-semibold">Something went wrong</h1>
      <p className="text-xs text-text-secondary">NetShield hit an unexpected error and stopped this page. Your saved graph is not affected.</p>
      <p className="text-[11px] font-mono text-state-failure break-words">{error.message}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => window.location.reload()} className="min-h-10 px-4 bg-accent-teal text-bg-primary font-semibold rounded-[3px] text-xs cursor-pointer">
          Reload page
        </button>
        <a href="/" className="min-h-10 px-4 inline-flex items-center border border-border-strong rounded-[3px] text-xs">
          Go to home page
        </a>
      </div>
    </div>
  </div>
)

export const PanelErrorFallback: React.FC<{ error: Error; reset: () => void; name: string }> = ({ error, reset, name }) => (
  <div role="alert" data-testid="panel-error" className="m-5 p-3 bg-state-failure-dim border border-state-failure/40 rounded-[2px] text-state-failure space-y-2 text-xs">
    <div className="font-semibold">The {name} panel failed to display.</div>
    <p className="text-[11px] font-mono break-words">{error.message}</p>
    <p className="text-[11px]">The rest of the page still works. No result is shown from this panel.</p>
    <button type="button" onClick={reset} className="min-h-10 px-3 border border-state-failure/60 rounded-[2px] cursor-pointer">
      Try again
    </button>
  </div>
)
