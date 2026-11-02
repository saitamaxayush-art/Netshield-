import { memo } from 'react'
import { BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react'
import type { EditorEdge } from '@/types/graph'
import { useIsBridge } from '@/store/selectors'
import { floatingEnds } from './floatingEdge'

export interface EdgeViewProps {
  id: string
  path: string
  midX: number
  midY: number
  failed: boolean
  selected: boolean
  bridge: boolean
}

/** Drawing only. Colour and width change at once; opacity and dash offset animate (index.css). */
export const EdgeView = memo(({ id, path, midX, midY, failed, selected, bridge }: EdgeViewProps) => {
  const isBridge = bridge && !failed
  const stroke = failed ? '#F43F5E' : selected ? '#38BDF8' : isBridge ? '#2DD4BF' : '#3D4663'
  const state = failed ? 'failed' : isBridge ? 'bridge' : 'normal'
  return (
    <g data-testid={`edge-${id}`} data-state={state} data-selected={selected}>
      <BaseEdge
        id={id}
        path={path}
        className="ns-edge-line"
        style={{
          stroke,
          strokeWidth: selected ? 2.5 : isBridge ? 2 : 1.5,
          strokeDasharray: failed ? '6 5' : isBridge ? '8 3' : undefined,
          strokeDashoffset: failed ? 0 : 11,
          opacity: failed ? 0.65 : 1,
        }}
      />
      {failed && (
        <g transform={`translate(${midX} ${midY})`} data-testid={`edge-cross-${id}`} aria-hidden="true">
          <circle r="8" fill="#13151F" stroke="#F43F5E" />
          <path d="M-3.5 -3.5L3.5 3.5M-3.5 3.5L3.5 -3.5" stroke="#F43F5E" strokeWidth="1.75" strokeLinecap="square" />
        </g>
      )}
      {isBridge && (
        <g transform={`translate(${midX} ${midY})`} data-testid={`edge-bridge-${id}`} aria-hidden="true">
          <rect x="-20" y="-8" width="40" height="16" rx="2" fill="#181B28" stroke="#2DD4BF" strokeOpacity="0.5" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="#2DD4BF">
            BRIDGE
          </text>
        </g>
      )}
    </g>
  )
})
EdgeView.displayName = 'EdgeView'

export const NetShieldCustomEdge = memo(({ id, source, target, data, selected }: EdgeProps<EditorEdge>) => {
  // Each edge follows only its own two nodes, so a drag redraws only the links it moves.
  const a = useInternalNode(source)
  const b = useInternalNode(target)
  const bridge = useIsBridge(id)
  if (!a?.measured.width || !a.measured.height || !b?.measured.width || !b.measured.height) return null
  const { source: s, target: t } = floatingEnds(
    { ...a.internals.positionAbsolute, width: a.measured.width, height: a.measured.height },
    { ...b.internals.positionAbsolute, width: b.measured.width, height: b.measured.height }
  )
  return (
    <EdgeView
      id={id}
      path={`M${s.x} ${s.y}L${t.x} ${t.y}`}
      midX={(s.x + t.x) / 2}
      midY={(s.y + t.y) / 2}
      failed={data?.failed ?? false}
      selected={selected ?? false}
      bridge={bridge}
    />
  )
})
NetShieldCustomEdge.displayName = 'NetShieldCustomEdge'
