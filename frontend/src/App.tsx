import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

// Lazy-load routes for optimized bundle splitting
const LandingPage = lazy(() => import('./pages/LandingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const StudioPage = lazy(() => import('./pages/StudioPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
// Its own chunk, loaded after first paint, so the landing page bundle stays free of the API layer.
const DemoModeBanner = lazy(() => import('./components/layout/DemoModeBanner'))

// Minimalist loading skeleton matching tokens
const PageLoader: React.FC = () => {
  // The landing page has its own charcoal theme: show a blank charcoal frame
  // while its chunk loads instead of the navy app loader.
  const { pathname } = useLocation()
  if (pathname === '/') return <div className="min-h-screen" style={{ background: '#17181B' }} />
  return <AppLoader />
}

const AppLoader: React.FC = () => (
  <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6 text-text-muted font-mono text-xs">
    <div className="w-6 h-6 border-2 border-border-strong border-t-accent-teal rounded-full animate-spin mb-3" />
    <span>Loading NetShield Environment...</span>
  </div>
)

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}>
        <DemoModeBanner />
      </Suspense>
    </BrowserRouter>
  )
}

export default App
