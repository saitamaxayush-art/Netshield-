import React from 'react'
import {
  useGraphStore,
  NetShieldNodeData,
  NetShieldEdgeData,
} from '@/store/graphStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Layers,
  Activity,
} from 'lucide-react'

export const PropertiesPanel: React.FC = () => {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNodeData,
    toggleNodeFailure,
    toggleEdgeFailure,
    deleteNode,
    deleteEdge,
  } = useGraphStore()

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null

  const selectedEdge = selectedEdgeId
    ? edges.find((e) => e.id === selectedEdgeId)
    : null

  // Calculate incident degree for selected node
  const nodeDegree = selectedNode
    ? edges.filter(
        (e) => e.source === selectedNode.id || e.target === selectedNode.id
      ).length
    : 0

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="p-6 text-center text-text-muted flex flex-col items-center justify-center h-full min-h-[220px]">
        <Sliders className="w-8 h-8 stroke-1 text-border-strong mb-3" />
        <div className="text-xs font-semibold text-text-secondary mb-1">
          No Selection
        </div>
        <p className="text-[11px] text-text-muted max-w-[200px] leading-relaxed">
          Select any node or connection on the canvas to configure properties, inspect
          incident degree, or toggle failure states.
        </p>
      </div>
    )
  }

  // Node Properties Inspector
  if (selectedNode) {
    const data = selectedNode.data as unknown as NetShieldNodeData
    const isFailed = data.status === 'failed'

    return (
      <div className="p-5 space-y-5 text-xs text-text-primary">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent-teal" />
            <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">
              Vertex Properties
            </span>
          </div>
          <Badge variant={isFailed ? 'failure' : 'success'}>
            {isFailed ? 'FAILED' : 'ACTIVE'}
          </Badge>
        </div>

        {/* Label Field */}
        <div>
          <label className="block text-[11px] font-mono text-text-muted uppercase mb-1.5">
            Vertex Identifier / Label
          </label>
          <input
            type="text"
            value={data.label}
            onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            className="w-full px-3 py-1.5 bg-bg-primary border border-border-strong rounded-[2px] text-text-primary focus:border-accent-teal focus:outline-none font-sans text-xs"
          />
        </div>

        {/* Type Field */}
        <div>
          <label className="block text-[11px] font-mono text-text-muted uppercase mb-1.5">
            Node Archetype
          </label>
          <select
            value={data.nodeType}
            onChange={(e) =>
              updateNodeData(selectedNode.id, {
                nodeType: e.target.value as NetShieldNodeData['nodeType'],
              })
            }
            className="w-full px-3 py-1.5 bg-bg-primary border border-border-strong rounded-[2px] text-text-primary focus:border-accent-teal focus:outline-none font-sans text-xs cursor-pointer"
          >
            <option value="router">Core Router</option>
            <option value="server">Compute Server</option>
            <option value="client">Workstation Client</option>
            <option value="firewall">Border Firewall</option>
          </select>
        </div>

        {/* Mathematical Topology Specs */}
        <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-2 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-text-muted">Degree deg(v):</span>
            <span className="font-semibold text-text-primary">{nodeDegree}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Component:</span>
            <span className="text-accent-teal">
              {data.componentIndex !== undefined ? `C${data.componentIndex}` : 'Unanalyzed'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Cut Vertex (AP):</span>
            <span className={data.isArticulationPoint ? 'text-accent-teal' : 'text-text-muted'}>
              {data.isArticulationPoint ? 'Identified' : 'None'}
            </span>
          </div>
        </div>

        {/* Failure Toggle Button */}
        <div className="pt-2 flex flex-col gap-2">
          <Button
            variant={isFailed ? 'secondary' : 'danger'}
            size="sm"
            className="w-full"
            leftIcon={
              isFailed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-state-success" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )
            }
            onClick={() => toggleNodeFailure(selectedNode.id)}
          >
            {isFailed ? 'Restore Node Online' : 'Fail Selected Node'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-text-muted hover:text-state-failure"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => deleteNode(selectedNode.id)}
          >
            Delete Vertex
          </Button>
        </div>
      </div>
    )
  }

  // Edge Properties Inspector
  if (selectedEdge) {
    const data = selectedEdge.data as unknown as NetShieldEdgeData
    const isFailed = data?.status === 'failed'
    const sourceNode = nodes.find((n) => n.id === selectedEdge.source)
    const targetNode = nodes.find((n) => n.id === selectedEdge.target)

    return (
      <div className="p-5 space-y-5 text-xs text-text-primary">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-cyan" />
            <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">
              Edge Properties
            </span>
          </div>
          <Badge variant={isFailed ? 'failure' : 'success'}>
            {isFailed ? 'SEVERED' : 'ACTIVE'}
          </Badge>
        </div>

        <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-2 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-text-muted">Source Vertex:</span>
            <span className="text-text-primary truncate max-w-[130px]">
              {sourceNode?.data.label || selectedEdge.source}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Target Vertex:</span>
            <span className="text-text-primary truncate max-w-[130px]">
              {targetNode?.data.label || selectedEdge.target}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Bridge (Cut Edge):</span>
            <span className={data?.isBridge ? 'text-accent-teal font-semibold' : 'text-text-muted'}>
              {data?.isBridge ? 'Bridge Identified' : 'Standard Edge'}
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Button
            variant={isFailed ? 'secondary' : 'danger'}
            size="sm"
            className="w-full"
            leftIcon={
              isFailed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-state-success" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )
            }
            onClick={() => toggleEdgeFailure(selectedEdge.id)}
          >
            {isFailed ? 'Restore Connection' : 'Sever Connection Link'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-text-muted hover:text-state-failure"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => deleteEdge(selectedEdge.id)}
          >
            Delete Edge
          </Button>
        </div>
      </div>
    )
  }

  return null
}
