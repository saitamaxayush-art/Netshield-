/**
 * Read only picture of the current graph at its studio positions. Colours come from the component map
 * of the analysis result it is given; without one, nodes are neutral. Failed elements are also dashed.
 */
import React from 'react'
import { TOKENS } from '@/lib/tokens'
import type { EditorGraph } from '@/types/graph'

export const GraphMiniMap: React.FC<{ graph: EditorGraph; componentOf: Record<string, number | null> | null }> = ({ graph, componentOf }) => {
  if (graph.nodes.length === 0) return null
  const xs = graph.nodes.map((n) => n.position.x)
  const ys = graph.nodes.map((n) => n.position.y)
  const pad = 60
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const width = Math.max(...xs) - minX + pad + 176
  const height = Math.max(...ys) - minY + pad + 84
  const centre = new Map(graph.nodes.map((n) => [n.id, { x: n.position.x + 88, y: n.position.y + 42, failed: n.data.failed }]))
  const palette = TOKENS.colors.components.palette
  const radius = Math.max(width, height) / 40
  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      role="img"
      aria-label={`Map of the current graph: ${graph.nodes.length} nodes, ${graph.edges.length} links`}
      data-testid="graph-minimap"
      className="w-full h-56 bg-bg-primary rounded-[2px] border border-border-subtle"
    >
      {graph.edges.map((e) => {
        const a = centre.get(e.source)
        const b = centre.get(e.target)
        if (!a || !b) return null
        const down = (e.data?.failed ?? false) || a.failed || b.failed
        return (
          <line
            key={e.id}
            data-edge-id={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={down ? '#64748B' : '#3D4663'}
            strokeWidth={radius / 3}
            strokeDasharray={down ? `${radius / 1.5} ${radius / 1.5}` : undefined}
          />
        )
      })}
      {graph.nodes.map((n) => {
        const index = componentOf?.[n.id] ?? null
        const c = centre.get(n.id)
        if (!c) return null
        return (
          <circle
            key={n.id}
            data-node-id={n.id}
            data-component={index ?? undefined}
            cx={c.x}
            cy={c.y}
            r={radius}
            fill={n.data.failed ? 'transparent' : index !== null ? palette[index % palette.length] : '#64748B'}
            stroke={n.data.failed ? '#F43F5E' : 'none'}
            strokeWidth={radius / 3}
            strokeDasharray={n.data.failed ? `${radius / 2} ${radius / 2}` : undefined}
          />
        )
      })}
    </svg>
  )
}
