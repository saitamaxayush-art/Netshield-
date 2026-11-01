/** Tells the user, in the studio, when saved data could not be loaded or changes cannot be saved. */
import React from 'react'
import { usePersistenceStatus } from '@/store/persistence'

export const PersistenceNotice: React.FC = () => {
  const { saveError, loadProblem } = usePersistenceStatus()
  if (!saveError && !loadProblem) return null
  return (
    <div
      role="status"
      data-testid="persistence-notice"
      className="shrink-0 px-4 py-2 border-b border-state-warning/40 bg-state-warning-dim text-state-warning text-[11px] font-mono flex items-center justify-between gap-3"
    >
      <span>{saveError ?? `Saved data was not loaded, so the example network is shown. ${loadProblem}`}</span>
      {!saveError && (
        <button
          type="button"
          className="px-2 py-0.5 border border-state-warning/60 rounded-[2px] hover:bg-state-warning/10 cursor-pointer"
          onClick={() => usePersistenceStatus.setState({ loadProblem: null })}
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
