import React, { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { NetworkSvgFallback } from './NetworkSvgFallback'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

// Lazy load Three.js 3D scene to protect initial render time
const Network3DScene = lazy(() => import('./Network3DScene'))

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

export const Hero3DContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasWebGL] = useState<boolean>(() => isWebGLAvailable())
  const [isIntersecting, setIsIntersecting] = useState<boolean>(true)
  const [isLowPowerDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const cores = navigator.hardwareConcurrency || 4
    const isMobile = window.innerWidth < 768
    return cores <= 2 && isMobile
  })
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    // IntersectionObserver to pause Three.js render loop when offscreen
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      { threshold: 0.05 }
    )
    observer.observe(containerRef.current)

    // Visibility change listener for background tab throttling
    const handleVisibility = () => {
      if (document.hidden) {
        setIsIntersecting(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // If WebGL is unavailable or low-power device detected, render SVG fallback
  if (!hasWebGL || isLowPowerDevice) {
    return (
      <div ref={containerRef} className="w-full h-full">
        <NetworkSvgFallback />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Suspense fallback={<NetworkSvgFallback />}>
        <Network3DScene
          reducedMotion={reducedMotion}
          isIntersecting={isIntersecting}
        />
      </Suspense>
    </div>
  )
}
