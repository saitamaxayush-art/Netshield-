import React, { useState } from 'react'
import { useGraphStore } from '@/store/graphStore'
import { useComponentIndex, useDegree, useIsArticulationPoint, useIsBridge } from '@/store/selectors'
import type { EditResult } from '@/store/graphRules'
import { NODE_TYPES, type EditorEdge, type EditorNode, type NodeType } from '@/types/graph'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Sliders, AlertTriangle, CheckCircle2, Trash2, Layers, Activity } from 'lucide-react'

const TYPE_NAMES: Record<NodeType, string> = {
  router: 'Core Router',
  server: 'Compute Server',
  client: 'Workstation Client',
  firewall: 'Border Firewall',
}

const isNodeType = (value: string): value is NodeType => NODE_TYPES.some((t) => t === value)

/** Shows the reason when the store refuses an edit. */
function useEditError(): [string | null, (result: EditResult) => void] {
  const [error, setError] = useState<string | null>(null)
  return [error, (result) => setError(result.ok ? null : result.error)]
}

const EditError: React.FC<{ error: string | null }> = ({ error }) =>
  error ? (
    <p role="alert" data-testid="edit-error" className="text-[11px] text-state-failure">
      {error}
    </p>
  ) : null

const NotAnalyzed = <span className="text-text-muted">Not analyzed</span>

const NodeProperties: React.FC<{ node: EditorNode }> = ({ node }) => {
  const { updateNode, toggleNodeFailure, removeNode } = useGraphStore()
  const degree = useDegree(node.id)
  const componentIndex = useComponentIndex(node.id)
  const isArticulationPoint = useIsArticulationPoint(node.id)
  const [error, report] = useEditError()
  const isFailed = node.data.failed

  return (
    <div className="p-5 space-y-5 text-xs text-text-primary">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent-teal" />
          <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">Vertex Properties</span>
        </div>
        <Badge variant={isFailed ? 'failure' : 'success'}>{isFailed ? 'FAILED' : 'ACTIVE'}</Badge>
      </div>

      <div className="font-mono text-[10px] text-text-muted">id: {node.id}</div>

      <div>
        <label htmlFor="node-label" className="block text-[11px] font-mono text-text-muted uppercase mb-1.5">
          Label
        </label>
        {/* Commits on blur or Enter, so one rename is one undo step. Keyed by value to follow undo. */}
        <input
          key={node.data.label}
          id="node-label"
          type="text"
          defaultValue={node.data.label}
          aria-invalid={error !== null}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          onBlur={(e) => {
            if (e.target.value !== node.data.label) report(updateNode(node.id, { label: e.target.value }))
          }}
          className="w-full px-3 py-1.5 bg-bg-primary border border-border-strong rounded-[2px] text-text-primary focus:border-accent-teal focus:outline-none font-sans text-xs"
        />
      </div>

      <div>
        <label htmlFor="node-type" className="block text-[11px] font-mono text-text-muted uppercase mb-1.5">
          Node Archetype
        </label>
        <select
          id="node-type"
          value={node.data.nodeType}
          onChange={(e) => {
            if (isNodeType(e.target.value)) report(updateNode(node.id, { nodeType: e.target.value }))
          }}
          className="w-full px-3 py-1.5 bg-bg-primary border border-border-strong rounded-[2px] text-text-primary focus:border-accent-teal focus:outline-none font-sans text-xs cursor-pointer"
        >
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_NAMES[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Every value here is from the backend's latest analysis of this exact graph. */}
      <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-2 font-mono text-[11px]" data-testid="node-analysis">
        <div className="flex justify-between">
          <span className="text-text-muted">Stored status:</span>
          <span data-testid="stored-status">{isFailed ? 'Marked failed' : 'Healthy'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Operational status:</span>
          <span data-testid="operational-status">{isFailed ? 'Down' : 'Up'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Degree deg(v), operational:</span>
          <span className="font-semibold text-text-primary" data-testid="node-degree">
            {degree ? degree.operational : NotAnalyzed}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Links stored:</span>
          <span className="text-text-primary">{degree ? degree.stored : NotAnalyzed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Component:</span>
          <span className="text-accent-teal">{componentIndex !== null ? `C${componentIndex}` : degree ? 'None (failed)' : NotAnalyzed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Cut Vertex (AP):</span>
          <span className={isArticulationPoint ? 'text-accent-teal' : 'text-text-muted'}>
            {degree ? (isArticulationPoint ? 'Yes' : 'No') : NotAnalyzed}
          </span>
        </div>
      </div>

      <EditError error={error} />

      <div className="pt-2 flex flex-col gap-2">
        <Button
          variant={isFailed ? 'secondary' : 'danger'}
          size="sm"
          className="w-full"
          leftIcon={isFailed ? <CheckCircle2 className="w-3.5 h-3.5 text-state-success" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          onClick={() => report(toggleNodeFailure(node.id))}
        >
          {isFailed ? 'Restore Node Online' : 'Fail Selected Node'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-text-muted hover:text-state-failure"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => report(removeNode(node.id))}
        >
          Delete Vertex
        </Button>
      </div>
    </div>
  )
}

/** A number field that keeps the typed text and sends a value (or null when emptied) to the store. */
const OptionalNumber: React.FC<{
  id: string
  label: string
  value: number | undefined
  placeholder: string
  step: string
  min?: number
  max?: number
  invalid: boolean
  onCommit: (value: number | null) => void
}> = ({ id, label, value, placeholder, step, min, max, invalid, onCommit }) => {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-mono text-text-muted uppercase mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="number"
        step={step}
        min={min}
        max={max}
        value={text}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        onBlur={() => onCommit(text.trim() === '' ? null : Number(text))}
        className="w-full px-3 py-1.5 bg-bg-primary border border-border-strong rounded-[2px] text-text-primary focus:border-accent-teal focus:outline-none font-mono text-xs"
      />
    </div>
  )
}

const EdgeProperties: React.FC<{ edge: EditorEdge }> = ({ edge }) => {
  const { nodes, updateEdge, toggleEdgeFailure, removeEdge } = useGraphStore()
  const isBridge = useIsBridge(edge.id)
  const [error, report] = useEditError()
  const isFailed = edge.data?.failed ?? false
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id
  const endpointFailed = nodes.some((n) => (n.id === edge.source || n.id === edge.target) && n.data.failed)

  return (
    <div className="p-5 space-y-5 text-xs text-text-primary">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-cyan" />
          <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">Edge Properties</span>
        </div>
        <Badge variant={isFailed ? 'failure' : 'success'}>{isFailed ? 'SEVERED' : 'ACTIVE'}</Badge>
      </div>

      <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-2 font-mono text-[11px]">
        <div className="flex justify-between">
          <span className="text-text-muted">Source Vertex:</span>
          <span className="text-text-primary truncate max-w-[130px]">{labelOf(edge.source)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Target Vertex:</span>
          <span className="text-text-primary truncate max-w-[130px]">{labelOf(edge.target)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Stored status:</span>
          <span data-testid="stored-status">{isFailed ? 'Marked failed' : 'Healthy'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Operational status:</span>
          <span data-testid="operational-status">{isFailed ? 'Down' : endpointFailed ? 'Unavailable (endpoint failed)' : 'Up'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Bridge (Cut Edge):</span>
          <span className={isBridge ? 'text-accent-teal font-semibold' : 'text-text-muted'}>{isBridge ? 'Bridge' : 'Not a bridge, or not analyzed'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OptionalNumber
          key={`w-${edge.id}-${edge.data?.weight}`}
          invalid={error !== null}
          id="edge-weight"
          label="Weight"
          step="any"
          placeholder="none"
          value={edge.data?.weight}
          onCommit={(weight) => report(updateEdge(edge.id, { weight }))}
        />
        <OptionalNumber
          key={`p-${edge.id}-${edge.data?.failureProbability}`}
          invalid={error !== null}
          min={0}
          max={1}
          id="edge-failure-probability"
          label="Own failure p"
          step="0.01"
          placeholder="use global"
          value={edge.data?.failureProbability}
          onCommit={(failureProbability) => report(updateEdge(edge.id, { failureProbability }))}
        />
      </div>

      <EditError error={error} />

      <div className="pt-2 flex flex-col gap-2">
        <Button
          variant={isFailed ? 'secondary' : 'danger'}
          size="sm"
          className="w-full"
          leftIcon={isFailed ? <CheckCircle2 className="w-3.5 h-3.5 text-state-success" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          onClick={() => report(toggleEdgeFailure(edge.id))}
        >
          {isFailed ? 'Restore Connection' : 'Sever Connection Link'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-text-muted hover:text-state-failure"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => report(removeEdge(edge.id))}
        >
          Delete Edge
        </Button>
      </div>
    </div>
  )
}

export const PropertiesPanel: React.FC = () => {
  const selectedNode = useGraphStore((s) => (s.selectedNodeId ? s.nodes.find((n) => n.id === s.selectedNodeId) : undefined))
  const selectedEdge = useGraphStore((s) => (s.selectedEdgeId ? s.edges.find((e) => e.id === s.selectedEdgeId) : undefined))

  if (selectedNode) return <NodeProperties key={selectedNode.id} node={selectedNode} />
  if (selectedEdge) return <EdgeProperties key={selectedEdge.id} edge={selectedEdge} />
  return (
    <div className="p-6 text-center text-text-muted flex flex-col items-center justify-center h-full min-h-[220px]">
      <Sliders className="w-8 h-8 stroke-1 text-border-strong mb-3" />
      <div className="text-xs font-semibold text-text-secondary mb-1">No Selection</div>
      <p className="text-[11px] text-text-muted max-w-[200px] leading-relaxed">
        Select any node or connection on the canvas to edit it, see its analysis, or toggle its failure state.
      </p>
    </div>
  )
}
