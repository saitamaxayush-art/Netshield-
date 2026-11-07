/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_DEMO_ADAPTER?: string
}

interface Window {
  /** Test only crash trigger, see src/components/layout/CrashProbe.tsx. */
  __nsCrash?: 'app' | 'panel'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
