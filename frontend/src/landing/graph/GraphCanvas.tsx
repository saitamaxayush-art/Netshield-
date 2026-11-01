import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LayoutEdge, LayoutNode } from '@/lib/seededGraphGenerator'

export interface NodeVisual {
  failed?: boolean
  /** Articulation point: red ring. */
  cut?: boolean
  /** Component silver step (CSS colour). */
  fill?: string
  /** Small square badge: BFS layer, DFS order, component number. */
  badge?: string | null
  emphasis?: 'source' | 'target' | 'visited' | 'frontier' | 'dim' | null
}

export interface EdgeVisual {
  failed?: boolean
  bridge?: boolean
  emphasis?: 'path' | 'tree' | 'dim' | 'pulse' | null
}

export interface GraphCanvasProps {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  tone: 'ink' | 'paper'
  aspect?: string
  ariaLabel: string
  nodeVisual?: (id: string) => NodeVisual
  edgeVisual?: (edge: LayoutEdge) => EdgeVisual
  nodeLabel?: (id: string) => string
  edgeLabel?: (edge: LayoutEdge) => string
  onNodeActivate?: (id: string) => void
  onEdgeActivate?: (id: string) => void
  /** Drag to reposition: unit coordinates, clamped to the frame. */
  onNodeMove?: (id: string, x: number, y: number) => void
  nodeCursor?: (id: string) => string
  edgeCursor?: (edge: LayoutEdge) => string
  /** Change to replay the draw-in animation. */
  drawKey?: string | number
  showLabels?: boolean
  padding?: number
  className?: string
  /** Extra SVG drawn above edges and below nodes, in pixel space. */
  overlay?: (project: (x: number, y: number) => [number, number]) => React.ReactNode
}

type Item = { kind: 'node'; id: string; x: number; y: number } | { kind: 'edge'; id: string; x: number; y: number }

const coarse = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/**
 * Lightweight SVG graph renderer used by every landing widget. Renders in
 * real pixels (the viewBox tracks the measured box) so hit targets are true
 * sizes: 40px node targets, 22px (28px touch) edge targets. Fully keyboard
 * operable with a roving tabindex: arrows move spatially, Enter or Space
 * activates. The box is reserved by aspect-ratio, so mounting never shifts.
 */
export function GraphCanvas({
  nodes,
  edges,
  tone,
  aspect = '4 / 3',
  ariaLabel,
  nodeVisual = () => ({}),
  edgeVisual = () => ({}),
  nodeLabel = (id) => `Node ${id}`,
  edgeLabel = (e) => `Link ${e.source} to ${e.target}`,
  onNodeActivate,
  onEdgeActivate,
  onNodeMove,
  nodeCursor,
  edgeCursor,
  drawKey,
  showLabels = true,
  padding = 32,
  className = '',
  overlay,
}: GraphCanvasProps) {
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [kbd, setKbd] = useState(false)
  const drag = useRef<{ id: string; pointer: number; sx: number; sy: number; moved: boolean } | null>(null)
  const interactive = Boolean(onNodeActivate || onEdgeActivate || onNodeMove)
  const hitEdge = coarse() ? 28 : 22

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setSize((s) => (s && Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const w = size?.w ?? 0
  const h = size?.h ?? 0
  const pad = Math.min(padding, w * 0.08 + 12)
  const project = useCallback((x: number, y: number): [number, number] => [pad + x * (w - 2 * pad), pad + y * (h - 2 * pad)], [pad, w, h])
  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, project(n.x, n.y)])), [nodes, project])

  const items = useMemo<Item[]>(() => {
    const list: Item[] = []
    if (onNodeActivate || onNodeMove) for (const n of nodes) list.push({ kind: 'node', id: n.id, x: n.x, y: n.y })
    if (onEdgeActivate) {
      const byId = new Map(nodes.map((n) => [n.id, n]))
      for (const e of edges) {
        const a = byId.get(e.source)!
        const b = byId.get(e.target)!
        list.push({ kind: 'edge', id: e.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      }
    }
    return list
  }, [nodes, edges, onNodeActivate, onEdgeActivate, onNodeMove])

  const safeIndex = Math.min(focusIndex, Math.max(0, items.length - 1))
  const itemRefs = useRef(new Map<string, SVGGElement | null>())

  const focusItem = (i: number) => {
    setFocusIndex(i)
    const it = items[i]
    if (it) itemRefs.current.get(`${it.kind}:${it.id}`)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = items[safeIndex]
    if (!cur) return
    const dirs: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }
    if (dirs[e.key]) {
      e.preventDefault()
      setKbd(true)
      const [dx, dy] = dirs[e.key]
      let best = -1
      let bestScore = Infinity
      items.forEach((it, i) => {
        if (i === safeIndex) return
        const vx = (it.x - cur.x) * w
        const vy = (it.y - cur.y) * h
        const along = vx * dx + vy * dy
        if (along <= 1) return
        const across = Math.abs(vx * dy - vy * dx)
        const score = along + across * 2.2
        if (score < bestScore) {
          bestScore = score
          best = i
        }
      })
      if (best >= 0) focusItem(best)
      return
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      focusItem(e.key === 'Home' ? 0 : items.length - 1)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (cur.kind === 'node') onNodeActivate?.(cur.id)
      else onEdgeActivate?.(cur.id)
    }
  }

  // Pointer: tap or click activates; moving more than 5px drags (when enabled).
  const onNodePointerDown = (id: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    setKbd(false)
    drag.current = { id, pointer: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const idx = items.findIndex((it) => it.kind === 'node' && it.id === id)
    if (idx >= 0) setFocusIndex(idx)
  }
  const onNodePointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId || !onNodeMove || !svg.current) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return
    d.moved = true
    const r = svg.current.getBoundingClientRect()
    const ux = (e.clientX - r.left - pad) / (w - 2 * pad)
    const uy = (e.clientY - r.top - pad) / (h - 2 * pad)
    onNodeMove(d.id, Math.min(1, Math.max(0, ux)), Math.min(1, Math.max(0, uy)))
  }
  const onNodePointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || d.pointer !== e.pointerId) return
    if (!d.moved) onNodeActivate?.(d.id)
  }

  useEffect(() => {
    const el = svg.current
    if (!el) return
    // Prevent the page (and Lenis) from scrolling while a node is dragged on touch.
    const block = (e: TouchEvent) => drag.current?.moved && e.preventDefault()
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [size])

  const toneVars =
    tone === 'ink'
      ? { '--g-edge': 'var(--s-500)', '--g-node': 'var(--s-100)', '--g-node-stroke': 'var(--c-950)', '--g-label': 'var(--s-500)', '--g-strong': 'var(--s-50)', '--g-bg': 'var(--c-950)', '--g-dim': 'var(--c-600)' }
      : { '--g-edge': 'var(--s-700)', '--g-node': 'var(--s-50)', '--g-node-stroke': 'var(--c-700)', '--g-label': 'var(--s-700)', '--g-strong': 'var(--c-900)', '--g-bg': 'var(--s-50)', '--g-dim': 'var(--s-300)' }

  const r = tone === 'ink' ? 7 : 8

  return (
    <div
      ref={box}
      className={`ns-graph-box ${className}`}
      style={{ position: 'relative', width: '100%', aspectRatio: aspect, ...(toneVars as React.CSSProperties) }}
      data-lenis-prevent={onNodeMove ? '' : undefined}
    >
      {size && (
        <svg
          ref={svg}
          className={`ns-graph${drawKey !== undefined ? ' ns-graph--draw' : ''}`}
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          role={interactive ? 'group' : 'img'}
          aria-label={ariaLabel}
          aria-roledescription={interactive ? 'interactive graph' : undefined}
          onKeyDown={interactive ? onKeyDown : undefined}
          style={{ touchAction: onNodeMove ? 'pan-y' : 'manipulation' }}
        >
          {/* Edges */}
          <g>
            {edges.map((e) => {
              const a = pos.get(e.source)
              const b = pos.get(e.target)
              if (!a || !b) return null
              const v = edgeVisual(e)
              const idx = items.findIndex((it) => it.kind === 'edge' && it.id === e.id)
              const mx = (a[0] + b[0]) / 2
              const my = (a[1] + b[1]) / 2
              const strokeColor = v.failed ? 'var(--r-500)' : v.bridge ? 'var(--r-500)' : v.emphasis === 'path' || v.emphasis === 'tree' || v.emphasis === 'pulse' ? 'var(--g-strong)' : v.emphasis === 'dim' ? 'var(--g-dim)' : 'var(--g-edge)'
              const width = v.emphasis === 'path' ? 3 : v.emphasis === 'pulse' ? 2.25 : v.bridge && !v.failed ? 1.75 : 1.25
              const line = (
                <>
                  <line
                    className="ns-e"
                    x1={a[0]}
                    y1={a[1]}
                    x2={b[0]}
                    y2={b[1]}
                    pathLength={1}
                    stroke={strokeColor}
                    strokeWidth={width}
                    style={{ opacity: v.failed ? 0 : 1, transition: 'opacity 420ms ease, stroke 240ms ease, stroke-width 240ms ease' }}
                  />
                  {v.failed && (
                    <line className="ns-e-failed" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--r-500)" strokeWidth={1.5} strokeDasharray="5 6" />
                  )}
                  {v.emphasis === 'path' && (
                    <line className="ns-e-path" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} pathLength={1} stroke="var(--g-strong)" strokeWidth={3} strokeLinecap="square" />
                  )}
                  {v.bridge && !v.failed && (
                    <g transform={`translate(${mx} ${my}) rotate(45)`}>
                      <rect x={-4} y={-4} width={8} height={8} fill="var(--r-500)" stroke="var(--g-bg)" strokeWidth={1.5} className="ns-pop" />
                    </g>
                  )}
                  {v.failed && (
                    <g transform={`translate(${mx} ${my})`}>
                      <g className="ns-pop">
                        <rect x={-7} y={-7} width={14} height={14} fill="var(--g-bg)" stroke="var(--r-500)" strokeWidth={1.25} />
                        <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" stroke="var(--r-500)" strokeWidth={1.5} />
                      </g>
                    </g>
                  )}
                </>
              )
              if (idx < 0) return <g key={e.id}>{line}</g>
              return (
                <g
                  key={e.id}
                  ref={(el) => {
                    itemRefs.current.set(`edge:${e.id}`, el)
                  }}
                  data-hit="edge"
                  data-id={e.id}
                  role="button"
                  tabIndex={idx === safeIndex ? 0 : -1}
                  aria-pressed={v.failed ? 'true' : 'false'}
                  aria-label={edgeLabel(e)}
                  data-cursor={edgeCursor?.(e)}
                  data-kbd-focus={kbd && idx === safeIndex ? 'true' : undefined}
                  onFocus={() => setFocusIndex(idx)}
                  onClick={() => {
                    setKbd(false)
                    onEdgeActivate?.(e.id)
                  }}
                >
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent" strokeWidth={hitEdge} pointerEvents="stroke" />
                  {line}
                  <circle className="ns-focus-ring" cx={mx} cy={my} r={12} />
                </g>
              )
            })}
          </g>

          {overlay?.(project)}

          {/* Nodes */}
          <g>
            {nodes.map((n) => {
              const p = pos.get(n.id)!
              const v = nodeVisual(n.id)
              const idx = items.findIndex((it) => it.kind === 'node' && it.id === n.id)
              const emphasised = v.emphasis === 'visited' || v.emphasis === 'frontier' || v.emphasis === 'source' || v.emphasis === 'target'
              const fill = v.failed ? 'var(--g-bg)' : v.fill ?? (emphasised && tone === 'paper' ? 'var(--c-900)' : 'var(--g-node)')
              const stroke = v.failed ? 'var(--r-500)' : emphasised ? 'var(--g-strong)' : 'var(--g-node-stroke)'
              const body = (
                <g transform={`translate(${p[0]} ${p[1]})`}>
                  {v.cut && !v.failed && <circle r={r + 5} fill="none" stroke="var(--r-500)" strokeWidth={1.5} className="ns-pop" />}
                  {(v.emphasis === 'source' || v.emphasis === 'target') && (
                    <rect x={-r - 5} y={-r - 5} width={(r + 5) * 2} height={(r + 5) * 2} fill="none" stroke="var(--g-strong)" strokeWidth={1.25} strokeDasharray={v.emphasis === 'target' ? '3 3' : undefined} />
                  )}
                  {v.emphasis === 'frontier' && <circle r={r + 6} fill="none" stroke="var(--g-strong)" strokeWidth={1} className="ns-ring-pulse" />}
                  <circle
                    r={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                    style={{ transition: 'fill 320ms ease, stroke 240ms ease', opacity: v.emphasis === 'dim' ? 0.45 : 1 }}
                  />
                  {v.failed && (
                    <path d={`M${-r * 0.55} ${-r * 0.55} L${r * 0.55} ${r * 0.55} M${r * 0.55} ${-r * 0.55} L${-r * 0.55} ${r * 0.55}`} pathLength={1} stroke="var(--r-500)" strokeWidth={1.75} className="ns-cross" />
                  )}
                  {showLabels && (
                    <text x={r + 5} y={-r - 3} className="ns-g-label" fill="var(--g-label)" fontSize={11}>
                      {n.label}
                    </text>
                  )}
                  {v.badge && (
                    <g transform={`translate(${r + 3} ${r - 2})`}>
                      <g className="ns-pop">
                      <rect x={0} y={0} width={v.badge.length > 1 ? 22 : 16} height={16} fill="var(--g-strong)" />
                      <text x={v.badge.length > 1 ? 11 : 8} y={11.5} textAnchor="middle" fill="var(--g-bg)" fontSize={10} className="ns-g-badge">
                        {v.badge}
                      </text>
                      </g>
                    </g>
                  )}
                  {idx >= 0 && <circle r={20} fill="transparent" />}
                  {idx >= 0 && <circle className="ns-focus-ring" r={r + 9} />}
                </g>
              )
              if (idx < 0) return <g key={n.id}>{body}</g>
              return (
                <g
                  key={n.id}
                  ref={(el) => {
                    itemRefs.current.set(`node:${n.id}`, el)
                  }}
                  data-hit="node"
                  data-id={n.id}
                  role="button"
                  tabIndex={idx === safeIndex ? 0 : -1}
                  aria-pressed={onNodeActivate && v.failed !== undefined ? (v.failed ? 'true' : 'false') : undefined}
                  aria-label={nodeLabel(n.id)}
                  data-cursor={nodeCursor?.(n.id)}
                  data-kbd-focus={kbd && idx === safeIndex ? 'true' : undefined}
                  onFocus={() => setFocusIndex(idx)}
                  onPointerDown={onNodePointerDown(n.id)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  onPointerCancel={() => (drag.current = null)}
                  style={{ touchAction: onNodeMove ? 'none' : 'manipulation' }}
                >
                  {body}
                </g>
              )
            })}
          </g>
        </svg>
      )}
    </div>
  )
}
