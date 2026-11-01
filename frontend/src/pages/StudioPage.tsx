import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ReactFlow, Controls, Background, BackgroundVariant, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react'
import { Navbar } from '@/components/layout/Navbar'
import { StudioToolbar } from '@/features/studio/StudioToolbar'
import { NetShieldCustomNode } from '@/features/studio/NetShieldCustomNode'
import { NetShieldCustomEdge } from '@/features/studio/NetShieldCustomEdge'
import { PropertiesPanel } from '@/features/studio/PropertiesPanel'
import { AnalysisPanel } from '@/features/studio/AnalysisPanel'
import { SimulationPanel } from '@/features/studio/SimulationPanel'
import { PersistenceNotice } from '@/features/studio/PersistenceNotice'
import { useGraphStore } from '@/store/graphStore'
import { useAutoAnalyze } from '@/hooks/useAutoAnalyze'
import type { EditorEdge, EditorNode } from '@/types/graph'
import { Sliders, Network, Activity } from 'lucide-react'
import '@/store/bootstrap'

const isTyping = () => {
  const tag = document.activeElement?.tagName
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
}

export const StudioPage: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId)
  const { applyNodeChanges, addEdge, removeEdge, selectNode, selectEdge, removeSelected, undo, redo } = useGraphStore.getState()
  const [connectError, setConnectError] = useState<string | null>(null)

  // Analysis re-runs on the backend 300 ms after the graph or its failures change.
  useAutoAnalyze()

  // Active side panel tab: 'properties' | 'analysis' | 'simulation'
  const [activeTab, setActiveTab] = useState<'properties' | 'analysis' | 'simulation'>('properties')

  const selectedId = selectedNodeId || selectedEdgeId
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId)
  if (selectedId && selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId)
    setActiveTab('properties')
  }

  const nodeTypes = useMemo(() => ({ netshieldNode: NetShieldCustomNode }), [])
  const edgeTypes = useMemo(() => ({ netshieldEdge: NetShieldCustomEdge }), [])

  // Selection lives in the store; React Flow only displays it.
  const flowNodes = useMemo(() => nodes.map((n) => (n.id === selectedNodeId ? { ...n, selected: true } : n)), [nodes, selectedNodeId])
  const flowEdges = useMemo(() => edges.map((e) => (e.id === selectedEdgeId ? { ...e, selected: true } : e)), [edges, selectedEdgeId])

  const handleNodesChange = useCallback((changes: NodeChange<EditorNode>[]) => applyNodeChanges(changes), [applyNodeChanges])
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<EditorEdge>[]) => {
      for (const change of changes) if (change.type === 'remove') removeEdge(change.id)
    },
    [removeEdge]
  )
  const handleConnect = useCallback(
    (connection: Connection) => {
      const result = addEdge({ source: connection.source, target: connection.target })
      setConnectError(result.ok ? null : result.error)
    },
    [addEdge]
  )

  const handleNodeClick = useCallback((_: React.MouseEvent, node: EditorNode) => selectNode(node.id), [selectNode])
  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: EditorEdge) => selectEdge(edge.id), [selectEdge])
  const handlePaneClick = useCallback(() => {
    selectNode(null)
    setConnectError(null)
  }, [selectNode])

  // Keyboard: Delete or Backspace removes the selection, Escape clears it, Ctrl or Cmd Z undoes.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelected()
      } else if (e.key === 'Escape') {
        selectNode(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [removeSelected, selectNode, undo, redo])

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      <Navbar />

      {/* Main Studio Workspace Container */}
      <div className="flex-1 flex flex-col pt-16 overflow-hidden">
      <PersistenceNotice />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Graph Canvas & Toolbar */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden border-r border-border-subtle">
          <StudioToolbar />

          {/* Interactive ReactFlow Canvas */}
          <div className="flex-1 w-full h-full relative bg-bg-primary overflow-hidden" role="region" aria-label="Network topology canvas">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              deleteKeyCode={null}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={handlePaneClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={2.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1.5}
                color="#222638"
              />
              <Controls className="!bg-bg-surface !border !border-border-strong !rounded-[2px]" />
            </ReactFlow>

            {connectError && (
              <div role="alert" data-testid="connect-error" className="absolute top-3 left-3 max-w-sm px-3 py-2 bg-state-failure-dim border border-state-failure/40 text-state-failure text-[11px] font-mono rounded-[2px]">
                {connectError}
              </div>
            )}

            {/* Quick Canvas Helper Overlay */}
            <div className="absolute bottom-3 right-3 hidden lg:flex items-center gap-3 bg-bg-surface/90 border border-border-subtle px-3 py-1.5 rounded-[2px] text-[10px] font-mono text-text-muted backdrop-blur-xs select-none">
              <span>Drag from handles to connect</span>
              <span className="text-border-strong">&bull;</span>
              <span>Del to remove</span>
              <span className="text-border-strong">&bull;</span>
              <span>Scroll to zoom</span>
            </div>
          </div>
        </div>

        {/* Right Side: Tabbed Inspection & Analysis Panels */}
        <div className="w-full md:w-[380px] lg:w-[420px] h-[340px] md:h-full bg-bg-surface flex flex-col border-t md:border-t-0 border-border-subtle shrink-0 overflow-hidden">
          {/* Panel Tab Navigation */}
          <div className="flex items-center border-b border-border-subtle bg-bg-surface shrink-0 text-xs font-mono h-12">
            <button
              onClick={() => setActiveTab('properties')}
              className={`flex-1 h-full px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'properties'
                  ? 'border-accent-teal text-accent-teal font-semibold bg-bg-primary/40'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Properties</span>
            </button>

            <button
              onClick={() => setActiveTab('analysis')}
              className={`flex-1 h-full px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'analysis'
                  ? 'border-accent-teal text-accent-teal font-semibold bg-bg-primary/40'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Analysis</span>
            </button>

            <button
              onClick={() => setActiveTab('simulation')}
              className={`flex-1 h-full px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'simulation'
                  ? 'border-accent-teal text-accent-teal font-semibold bg-bg-primary/40'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Simulator</span>
            </button>
          </div>

          {/* Panel Content Scroll Container */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'properties' && <PropertiesPanel />}
            {activeTab === 'analysis' && <AnalysisPanel />}
            {activeTab === 'simulation' && <SimulationPanel />}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default StudioPage
