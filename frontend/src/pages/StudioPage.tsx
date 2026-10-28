import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  BackgroundVariant,
} from '@xyflow/react'
import { Navbar } from '@/components/layout/Navbar'
import { StudioToolbar } from '@/features/studio/StudioToolbar'
import { NetShieldCustomNode } from '@/features/studio/NetShieldCustomNode'
import { NetShieldCustomEdge } from '@/features/studio/NetShieldCustomEdge'
import { PropertiesPanel } from '@/features/studio/PropertiesPanel'
import { AnalysisPanel } from '@/features/studio/AnalysisPanel'
import { SimulationPanel } from '@/features/studio/SimulationPanel'
import { useGraphStore, NetShieldNode, NetShieldEdge } from '@/store/graphStore'
import { Sliders, Network, Activity } from 'lucide-react'

export const StudioPage: React.FC = () => {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onConnect,
    selectNode,
    selectEdge,
    removeSelected,
    selectedNodeId,
    selectedEdgeId,
  } = useGraphStore()

  // Active side panel tab: 'properties' | 'analysis' | 'simulation'
  const [activeTab, setActiveTab] = useState<'properties' | 'analysis' | 'simulation'>('properties')

  const selectedId = selectedNodeId || selectedEdgeId
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId)
  if (selectedId && selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId)
    setActiveTab('properties')
  }

  // Custom node and edge registration
  const nodeTypes = useMemo(() => ({ netshieldNode: NetShieldCustomNode }), [])
  const edgeTypes = useMemo(() => ({ netshieldEdge: NetShieldCustomEdge }), [])

  // Flow change handlers
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds as NetShieldNode[]) as NetShieldNode[])
    },
    [setNodes]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds as NetShieldEdge[]) as NetShieldEdge[])
    },
    [setEdges]
  )

  // Selection handlers
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: NetShieldNode) => {
      selectNode(node.id)
    },
    [selectNode]
  )

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: NetShieldEdge) => {
      selectEdge(edge.id)
    },
    [selectEdge]
  )

  const handlePaneClick = useCallback(() => {
    selectNode(null)
    selectEdge(null)
  }, [selectNode, selectEdge])

  // Keyboard shortcut listener (Delete, Backspace, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or select
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelected()
      } else if (e.key === 'Escape') {
        selectNode(null)
        selectEdge(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [removeSelected, selectNode, selectEdge])

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      <Navbar />

      {/* Main Studio Workspace Container */}
      <div className="flex-1 flex flex-col md:flex-row pt-16 overflow-hidden">
        {/* Left Side: Graph Canvas & Toolbar */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden border-r border-border-subtle">
          <StudioToolbar />

          {/* Interactive ReactFlow Canvas */}
          <div className="flex-1 w-full h-full relative bg-bg-primary overflow-hidden" role="region" aria-label="Network topology canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
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
  )
}

export default StudioPage
