import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Network, Server, Monitor, ShieldCheck, AlertCircle } from 'lucide-react'
import type { NetShieldNodeData } from '@/store/graphStore'
import { TOKENS } from '@/lib/tokens'

const nodeIcons = {
  router: Network,
  server: Server,
  client: Monitor,
  firewall: ShieldCheck,
}

export const NetShieldCustomNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NetShieldNodeData
  const Icon = nodeIcons[nodeData.nodeType] || Network
  const isFailed = nodeData.status === 'failed'

  // Component coloring if analysis has run
  const componentColor =
    nodeData.componentIndex !== undefined
      ? TOKENS.colors.components.palette[
          nodeData.componentIndex % TOKENS.colors.components.palette.length
        ]
      : undefined

  return (
    <div
      className={`relative px-3 py-2.5 rounded-[3px] transition-all select-none min-w-[130px] border ${
        isFailed
          ? 'bg-state-failure-dim border-state-failure text-state-failure shadow-sm'
          : selected
          ? 'bg-bg-surface-active border-accent-teal shadow-md ring-1 ring-accent-teal'
          : 'bg-bg-surface border-border-strong hover:border-border-focus text-text-primary'
      }`}
    >
      {/* Top and Bottom Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-accent-teal !border-bg-primary !rounded-none -top-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-accent-teal !border-bg-primary !rounded-none -bottom-1"
      />

      {/* Articulation point indicator banner */}
      {nodeData.isArticulationPoint && !isFailed && (
        <div className="absolute -top-2.5 right-2 px-1.5 py-0.2 bg-accent-teal text-bg-primary text-[9px] font-mono font-bold uppercase rounded-[1px] tracking-tight">
          Cut Vertex
        </div>
      )}

      {/* Node Header: Icon and Label */}
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-[2px] flex items-center justify-center border ${
            isFailed
              ? 'bg-state-failure/20 border-state-failure text-state-failure'
              : 'bg-bg-primary border-border-subtle text-accent-teal'
          }`}
        >
          {isFailed ? <AlertCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
        </div>

        <div className="flex flex-col overflow-hidden">
          <span
            className={`text-xs font-semibold truncate ${
              isFailed ? 'line-through text-state-failure' : 'text-text-primary'
            }`}
          >
            {nodeData.label}
          </span>
          <span className="text-[10px] uppercase font-mono text-text-muted tracking-tight">
            {nodeData.nodeType}
          </span>
        </div>
      </div>

      {/* Component Index and Status Footer */}
      <div className="mt-2 pt-1.5 border-t border-border-subtle flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          {componentColor && !isFailed && (
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: componentColor }}
              title={`Component ${nodeData.componentIndex}`}
            />
          )}
          <span className="text-text-muted">
            {componentColor && !isFailed ? `C${nodeData.componentIndex}` : ''}
          </span>
        </div>

        <span
          className={`font-medium ${
            isFailed ? 'text-state-failure' : 'text-state-success'
          }`}
        >
          {isFailed ? 'FAILED' : 'ACTIVE'}
        </span>
      </div>
    </div>
  )
})

NetShieldCustomNode.displayName = 'NetShieldCustomNode'
