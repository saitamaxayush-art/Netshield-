import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { Plugin } from 'vite'

/**
 * Starts downloading the lazy landing chunk (and its stylesheet) while the
 * entry script is still loading, but only on the landing route, so the app
 * routes never fetch landing code.
 */
function preloadLandingChunk(): Plugin {
  return {
    name: 'preload-landing-chunk',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const chunk = Object.values(ctx.bundle ?? {}).find((c) => c.type === 'chunk' && c.facadeModuleId?.endsWith('/pages/LandingPage.tsx'))
        if (!chunk || chunk.type !== 'chunk') return html
        const css = [...(chunk.viteMetadata?.importedCss ?? [])]
        const modules = [chunk.fileName, ...chunk.imports]
        const links = [
          ...modules.map((f) => `['modulepreload','/${f}','']`),
          ...css.map((f) => `['preload','/${f}','style']`),
        ]
        // Style preloads carry crossorigin to match how Vite requests chunk CSS.
        // Injected right after the charset meta, before any stylesheet: an inline script placed after a stylesheet would wait for it.
        const script = `<script>if(location.pathname==='/'){[${links.join(',')}].forEach(function(l){var e=document.createElement('link');e.rel=l[0];e.href=l[1];if(l[2]){e.as=l[2];e.crossOrigin=''}document.head.appendChild(e)})}</script>`
        return html.replace(/<meta charset="UTF-8" \/>/i, (m) => `${m}\n    ${script}`)
      },
    },
  }
}

// https://vite.dev/config/
// Where the dev and preview servers forward /api (FastAPI started by `npm run dev:all`).
// NETSHIELD_API_PORT moves backend and proxy together when 8000 is taken.
const apiTarget = process.env.NETSHIELD_API_PROXY_TARGET ?? `http://127.0.0.1:${process.env.NETSHIELD_API_PORT ?? '8000'}`
const apiProxy = { '/api': { target: apiTarget, changeOrigin: true } }

export default defineConfig({
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [
    react(),
    tailwindcss(),
    preloadLandingChunk(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Vitest config
  // @ts-expect-error vitest config field
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Playwright specs in e2e/ run with `npx playwright test`, not Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
