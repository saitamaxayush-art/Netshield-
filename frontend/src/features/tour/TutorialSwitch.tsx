/**
 * The one control for the guided tour: a labelled switch that shows or hides Netbot and the walkthrough.
 * It is the only way the tour starts, and it starts off on every page load.
 */
import React from 'react'
import { useTourStore } from '@/store/tourStore'

export const TutorialSwitch: React.FC = () => {
  const on = useTourStore((s) => s.active)
  const toggle = useTourStore((s) => s.toggle)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      data-testid="tutorial-switch"
      data-tour="tutorial-switch"
      className="group inline-flex min-h-10 items-center gap-2.5 px-2 rounded-[3px] text-xs font-mono text-text-secondary hover:text-text-primary cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-teal"
    >
      <span>Tutorial</span>
      {/* Square-cornered track and thumb (the app has no pill shapes); the state is also written out. */}
      <span
        aria-hidden="true"
        className={`relative inline-block w-9 h-5 rounded-[3px] border transition-colors motion-reduce:transition-none ${
          on ? 'bg-accent-teal border-accent-teal' : 'bg-bg-surface border-border-strong group-hover:border-text-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 w-3.5 h-3.5 rounded-[2px] transition-[left] motion-reduce:transition-none ${on ? 'left-[18px] bg-bg-primary' : 'left-0.5 bg-text-secondary'}`}
        />
      </span>
      <span aria-hidden="true" className={`w-6 text-left ${on ? 'text-accent-teal font-semibold' : ''}`}>
        {on ? 'On' : 'Off'}
      </span>
    </button>
  )
}
