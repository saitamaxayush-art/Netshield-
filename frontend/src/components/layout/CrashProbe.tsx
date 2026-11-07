/**
 * Test only: throws while rendering when window.__nsCrash names this probe, so the end to end suite can
 * prove the error boundaries catch a real render crash in the production build. Renders nothing otherwise.
 */
import React from 'react'

export const CrashProbe: React.FC<{ name: 'app' | 'panel' }> = ({ name }) => {
  if (typeof window !== 'undefined' && window.__nsCrash === name) throw new Error(`Test crash in the ${name} (window.__nsCrash)`)
  return null
}
