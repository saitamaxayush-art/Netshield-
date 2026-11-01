import React, { useState } from 'react'
import {
  Network,
  Server,
  Monitor,
  ShieldCheck,
  Trash2,
  RotateCcw,
  RefreshCw,
  FolderOpen,
  Undo2,
  Redo2,
} from 'lucide-react'
import { useGraphStore } from '@/store/graphStore'
import { PRESET_TITLES } from '@/store/presets'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import type { NodeType } from '@/types/graph'

export const StudioToolbar: React.FC = () => {
  const {
    addNode,
    removeSelected,
    selectedNodeId,
    selectedEdgeId,
    clearFailures,
    loadPreset,
    reset,
    undo,
    redo,
    example,
  } = useGraphStore()
  const canUndo = useGraphStore((s) => s.past.length > 0)
  const canRedo = useGraphStore((s) => s.future.length > 0)

  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const hasSelection = !!selectedNodeId || !!selectedEdgeId

  const handleAddNode = (type: NodeType) => {
    addNode({ nodeType: type })
  }

  return (
    <>
      <div className="bg-bg-surface border-b border-border-subtle p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Node Creation Palette */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider mr-1">
            Add Element:
          </span>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Network className="w-3.5 h-3.5 text-accent-teal" />}
            onClick={() => handleAddNode('router')}
            title="Add a core routing node"
          >
            Router
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Server className="w-3.5 h-3.5 text-accent-cyan" />}
            onClick={() => handleAddNode('server')}
            title="Add a compute or application server"
          >
            Server
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Monitor className="w-3.5 h-3.5 text-text-secondary" />}
            onClick={() => handleAddNode('client')}
            title="Add a workstation client"
          >
            Client
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-state-warning" />}
            onClick={() => handleAddNode('firewall')}
            title="Add a perimeter firewall gateway"
          >
            Firewall
          </Button>
        </div>

        {/* Templates and Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Example Topology Templates */}
          <div className="flex items-center gap-1 border-r border-border-subtle pr-2 mr-1">
            <span className="text-[11px] font-mono text-text-muted flex items-center gap-1 mr-1">
              <FolderOpen className="w-3 h-3" />
              <span>Examples:</span>
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadPreset('star')}
              title="Load Star Topology Example"
            >
              Star
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadPreset('ring')}
              title="Load Ring Topology Example"
            >
              Ring
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadPreset('mesh')}
              title="Load Redundant Mesh Topology Example"
            >
              Mesh
            </Button>
          </div>

          {example && (
            <span data-testid="example-label" className="text-[11px] font-mono text-state-warning border border-state-warning/40 px-1.5 py-0.5 rounded-[2px]">
              {PRESET_TITLES[example]}
            </span>
          )}

          <Button variant="ghost" size="sm" disabled={!canUndo} leftIcon={<Undo2 className="w-3.5 h-3.5" />} onClick={undo} title="Undo (Ctrl+Z)">
            Undo
          </Button>
          <Button variant="ghost" size="sm" disabled={!canRedo} leftIcon={<Redo2 className="w-3.5 h-3.5" />} onClick={redo} title="Redo (Ctrl+Shift+Z)">
            Redo
          </Button>

          {/* Delete Selection */}
          <Button
            variant="danger"
            size="sm"
            disabled={!hasSelection}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => removeSelected()}
            title="Delete selected vertex or edge (Del)"
          >
            Delete
          </Button>

          {/* Reset Failures */}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={clearFailures}
            title="Restore all failed nodes and edges to healthy status"
          >
            Restore All
          </Button>

          {/* Reset Graph Modal Trigger */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => setConfirmResetOpen(true)}
            title="Reset workspace canvas"
          >
            Clear Canvas
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog for Resetting Canvas */}
      <Dialog
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Clear Graph Canvas"
        description="Remove all nodes and links from the canvas? You can undo this."
        confirmLabel="Clear All"
        isDanger={true}
        onConfirm={reset}
      >
        <p className="text-xs text-text-muted">
          You can reload one of the standard example topologies (Star, Ring, or Mesh) at any time.
        </p>
      </Dialog>
    </>
  )
}
