import { useEffect, useMemo } from 'react'
import { useBoxSize } from '../graph/useBoxSize'
import { poseFor, projectNode, type HeroModel } from './heroModel'

/**
 * SVG rendering of the same seeded hero graph and camera pose as the WebGL
 * scene. Used for reduced motion, missing or lost WebGL, low power devices
 * and as the first paint. Shows the first scheduled failure with its
 * computed detour, so the static frame tells the same story.
 */
export function HeroSvg({
  model,
  hovered,
  onLayout,
}: {
  model: HeroModel
  hovered: string | null
  onLayout: (positions: Map<string, [number, number]>) => void
}) {
  const [ref, size] = useBoxSize<HTMLDivElement>()
  const failed = model.failureOrder[0]
  const detour = useMemo(() => (failed ? model.detour(failed) : null), [model, failed])

  const projected = useMemo(() => {
    if (!size) return null
    const pose = poseFor(size.w)
    const map = new Map<string, [number, number, number]>()
    for (const n of model.graph.nodes) map.set(n.id, projectNode(n, pose, size.w, size.h))
    return map
  }, [size, model])

  useEffect(() => {
    if (projected) onLayout(new Map([...projected].map(([id, p]) => [id, [p[0], p[1]]])))
  }, [projected, onLayout])

  const detourEdges = new Set<string>()
  if (detour) for (let i = 1; i < detour.length; i++) detourEdges.add([detour[i - 1], detour[i]].sort().join('|'))
  const near = hovered ? model.neighbours.get(hovered) : null
  const depthOpacity = (z: number) => Math.max(0.18, Math.min(1, 1.35 - (z - 9) / 9))

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }} aria-hidden="true" data-hero-renderer="svg">
      {size && projected && (
        <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} style={{ display: 'block' }}>
          {model.graph.edges.map((e) => {
            const a = projected.get(e.source)!
            const b = projected.get(e.target)!
            const key = [e.source, e.target].sort().join('|')
            const isFailed = e.id === failed
            const lit = hovered && (e.source === hovered || e.target === hovered)
            const onDetour = detourEdges.has(key)
            return (
              <line
                key={e.id}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke={isFailed ? 'var(--r-500)' : lit || onDetour ? 'var(--s-50)' : 'var(--s-500)'}
                strokeWidth={isFailed || onDetour || lit ? 1.25 : 0.75}
                strokeDasharray={isFailed ? '4 4' : undefined}
                opacity={isFailed || lit ? 1 : onDetour ? 0.9 : depthOpacity((a[2] + b[2]) / 2) * 0.6}
              />
            )
          })}
          {model.graph.nodes.map((n) => {
            const p = projected.get(n.id)!
            const lit = n.id === hovered || near?.has(n.id)
            return (
              <rect
                key={n.id}
                x={p[0] - (lit ? 3 : 2)}
                y={p[1] - (lit ? 3 : 2)}
                width={lit ? 6 : 4}
                height={lit ? 6 : 4}
                fill={lit ? 'var(--s-50)' : 'var(--s-300)'}
                opacity={lit ? 1 : depthOpacity(p[2])}
              />
            )
          })}
        </svg>
      )}
    </div>
  )
}
