/** Globals that the app or a test puts on window, typed once for every spec (no casts). */
export {}

declare global {
  interface Window {
    // Landing page motion engine (src/landing/motion/engine.ts)
    __NS_FORCE_MOTION_FAILURE?: boolean
    __nsEngine?: { lenis: boolean; refreshes: number; failed: boolean }
    __nsHeroFrames?: number
    // Recorded by e2e/helpers.ts
    __cls: number
    __shifts: unknown[]
    __longtasks: number[]
    // Recorded by individual specs
    __bgs: string[]
    __frameGaps?: number[]
    // Test only crash trigger read by the error boundary probe (src/components/layout/CrashProbe.tsx)
    __nsCrash?: 'app' | 'panel'
  }
}
