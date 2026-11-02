import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Network, Server, Monitor, ShieldCheck, AlertCircle } from 'lucide-react'
import type { EditorNode, NodeType } from '@/types/graph'
import { useComponentIndex, useIsArticulationPoint } from '@/store/selectors'
import { TOKENS } from '@/lib/tokens'

const ICONS = { router: Network, server: Server, client: Monitor, firewall: ShieldCheck }

/** Each type has its own icon and tile shape, so types differ without relying on colour. */
const TILE_SHAPE: Record<NodeType, { className: string; clipPath?: string }> = {
  router: { className: 'rounded-full' },
  server: { className: 'rounded-none' },
  client: { className: 'rounded-[6px_6px_0_0]' },
  firewall: { className: '', clipPath: 'polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)' },
}

export interface NodeBodyProps {
  label: string
  nodeType: NodeType
  failed: boolean
  selected: boolean
  componentIndex: number | null
  isArticulationPoint: boolean
}

/** Drawing only. Failed is shown by icon, label and dashed outline, not by colour alone. */
export const NodeBody = memo(({ label, nodeType, failed, selected, componentIndex, isArticulationPoint }: NodeBodyProps) => {
  const Icon = failed ? AlertCircle : ICONS[nodeType]
  const palette = TOKENS.colors.components.palette
  const color = componentIndex !== null && !failed ? palette[componentIndex % palette.length] : undefined
  const tile = TILE_SHAPE[nodeType]
  return (
    <div
      data-testid="node-body"
      data-node-type={nodeType}
      data-failed={failed}
      data-selected={selected}
      data-component={componentIndex ?? undefined}
      style={color ? { borderLeftColor: color, borderLeftWidth: 4, borderLeftStyle: 'solid' } : undefined}
      className={`relative px-3 py-2.5 rounded-[3px] select-none w-[176px] border ${
        failed
          ? 'bg-state-failure-dim border-2 border-dashed border-state-failure text-state-failure'
          : 'bg-bg-surface border-border-strong text-text-primary'
      } ${selected ? 'ring-2 ring-accent-cyan ring-offset-2 ring-offset-bg-primary' : ''}`}
    >
      {isArticulationPoint && !failed && (
        <div className="absolute -top-2.5 right-2 px-1.5 bg-accent-teal text-bg-primary text-[9px] font-mono font-bold uppercase rounded-[1px] tracking-tight">
          Cut Vertex
        </div>
      )}
      <div className="flex items-center gap-2">
        <div
          className={`w-7 h-7 shrink-0 flex items-center justify-center ${tile.className} ${
            failed ? 'bg-state-failure/20 text-state-failure' : 'bg-bg-surface-active text-accent-teal'
          }`}
          style={tile.clipPath ? { clipPath: tile.clipPath } : undefined}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className={`text-xs font-semibold truncate ${failed ? 'line-through text-state-failure' : 'text-text-primary'}`}>{label}</span>
          <span className="text-[10px] uppercase font-mono text-text-muted tracking-tight">{nodeType}</span>
        </div>
      </div>
      <div className="mt-2 pt-1.5 border-t border-border-subtle flex items-center justify-between text-[10px] font-mono">
        <span className="text-text-muted">{color ? `C${componentIndex}` : ''}</span>
        <span className={`font-medium ${failed ? 'text-state-failure' : 'text-state-success'}`}>{failed ? 'FAILED' : 'ACTIVE'}</span>
      </div>
    </div>
  )
})
NodeBody.displayName = 'NodeBody'

const SIDES = [
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
] as const

export const NetShieldCustomNode = memo(({ id, data, selected }: NodeProps<EditorNode>) => {
  // Colours come from the latest up to date analysis (analysisStore), never computed here.
  const componentIndex = useComponentIndex(id)
  const isArticulationPoint = useIsArticulationPoint(id)
  return (
    <>
      <NodeBody
        label={data.label}
        nodeType={data.nodeType}
        failed={data.failed}
        selected={selected}
        componentIndex={componentIndex}
        isArticulationPoint={isArticulationPoint}
      />
      {/* After the body, so handles paint and receive pointer events above it. */}
      {SIDES.map(([side, position]) => (
        <Handle key={side} id={side} type="source" position={position} className="ns-handle" aria-label={`Connect from ${data.label}, ${side} side`} />
      ))}
    </>
  )
})
NetShieldCustomNode.displayName = 'NetShieldCustomNode'
