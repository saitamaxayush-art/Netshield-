import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  useStore,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { Navbar } from '@/components/layout/Navbar'
import { NODE_DRAG_TYPE, StudioToolbar } from '@/features/studio/StudioToolbar'
import { StudioToast } from '@/features/studio/StudioToast'
import { addNodeOrExplain, connectOrExplain, FIT_OPTIONS, NODE_HEIGHT, NODE_WIDTH, useAddNodeAtCentre } from '@/features/studio/studioActions'
import { NetShieldCustomNode } from '@/features/studio/NetShieldCustomNode'
import { NetShieldCustomEdge } from '@/features/studio/NetShieldCustomEdge'
import { PropertiesPanel } from '@/features/studio/PropertiesPanel'
import { AnalysisPanel } from '@/features/studio/AnalysisPanel'
import { SimulationPanel } from '@/features/studio/SimulationPanel'
import { PersistenceNotice } from '@/features/studio/PersistenceNotice'
import { FAILURE_RULE, FailureControls } from '@/features/studio/FailureControls'
import { AnalysisAnnouncer } from '@/features/studio/AnalysisAnnouncer'
import { useAnalysisStore } from '@/store/analysisStore'
import { ANALYSIS_SECTIONS, useStudioView, type AnalysisSection, type PanelTab } from '@/store/studioViewStore'
import { Sheet } from '@/components/ui/Sheet'
import { ErrorBoundary, PanelErrorFallback } from '@/components/layout/ErrorBoundary'
import { Button } from '@/components/ui/Button'
import { useGraphStore } from '@/store/graphStore'
import { PRESET_NAMES, PRESET_TITLES } from '@/store/presets'
import { useAutoAnalyze } from '@/hooks/useAutoAnalyze'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { NODE_TYPES, type EditorEdge, type EditorNode, type NodeType, type Position } from '@/types/graph'
import { Sliders, Network, Activity, Plus } from 'lucide-react'
import '@/store/bootstrap'

const NODE_COMPONENTS = { netshieldNode: NetShieldCustomNode }
const EDGE_COMPONENTS = { netshieldEdge: NetShieldCustomEdge }

const isTyping = () => {
  const tag = document.activeElement?.tagName
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
}
// The navbar's menu overlay stays mounted while hidden, so only a visible dialog counts.
const dialogOpen = () => [...document.querySelectorAll('[role="dialog"]')].some((d) => d.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
const isDesktopNow = () => typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1280px)').matches
const isNodeType = (value: string): value is NodeType => NODE_TYPES.some((t) => t === value)

// Display copies with aria labels, cached per store object so unchanged nodes and edges keep their
// identity and their memoized components do not re-render.
const nodeCopies = new WeakMap<EditorNode, EditorNode>()
const edgeCopies = new WeakMap<EditorEdge, EditorEdge>()
function nodeCopy(n: EditorNode): EditorNode {
  let copy = nodeCopies.get(n)
  if (!copy) {
    copy = { ...n, ariaLabel: `${n.data.nodeType} ${n.data.label}${n.data.failed ? ', failed' : ''}` }
    nodeCopies.set(n, copy)
  }
  return copy
}
function edgeCopy(e: EditorEdge): EditorEdge {
  let copy = edgeCopies.get(e)
  if (!copy) {
    copy = { ...e, ariaLabel: `Link from ${e.source} to ${e.target}${e.data?.failed ? ', failed' : ''}` }
    edgeCopies.set(e, copy)
  }
  return copy
}

/** Saves pan and zoom shortly after they stop changing. Renders nothing, so ticks stay cheap. */
const ViewportSaver: React.FC = () => {
  const [x, y, zoom] = useStore((s) => s.transform)
  useEffect(() => {
    const timer = setTimeout(() => useGraphStore.getState().setViewport({ x, y, zoom }), 200)
    return () => clearTimeout(timer)
  }, [x, y, zoom])
  return null
}

const EmptyCanvas: React.FC = () => {
  const addAtCentre = useAddNodeAtCentre()
  const { fitView } = useReactFlow()
  const loadPreset = useGraphStore((s) => s.loadPreset)
  return (
    <div data-testid="empty-canvas" className="absolute inset-0 z-10 flex items-center justify-center p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-sm w-full p-6 bg-bg-surface border border-border-subtle rounded-[4px] text-center space-y-4">
        <Network className="w-8 h-8 mx-auto stroke-1 text-text-muted" />
        <div>
          <h2 className="text-sm font-semibold text-text-primary">The canvas is empty</h2>
          <p className="mt-1 text-xs text-text-secondary">Add a first node, or start from an example network.</p>
        </div>
        <Button variant="primary" size="md" className="w-full" leftIcon={<Plus className="w-4 h-4" />} onClick={() => addAtCentre('router')}>
          Add node
        </Button>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_NAMES.map((name) => (
            <Button
              key={name}
              variant="secondary"
              size="sm"
              title={`Load ${PRESET_TITLES[name]}`}
              onClick={() => {
                loadPreset(name)
                setTimeout(() => void fitView(FIT_OPTIONS), 50)
              }}
            >
              {name[0].toUpperCase() + name.slice(1)}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-text-muted">These load labelled examples.</p>
      </div>
    </div>
  )
}

const TABS: ReadonlyArray<[PanelTab, string, typeof Sliders]> = [
  ['properties', 'Properties', Sliders],
  ['analysis', 'Analysis', Network],
  ['simulation', 'Simulator', Activity],
]

const Panels: React.FC = () => {
  const activeTab = useStudioView((s) => s.panelTab)
  const setActiveTab = useStudioView((s) => s.setPanelTab)
  const analysisFailed = useAnalysisStore((s) => s.analyze.error !== null)
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center border-b border-border-subtle bg-bg-surface shrink-0 text-xs font-mono h-12" data-testid="panel-tabs">
        {TABS.map(([tab, name, Icon]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={`flex-1 h-full px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === tab ? 'border-accent-teal text-accent-teal font-semibold bg-bg-primary/40' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{name}</span>
            {tab === 'analysis' && analysisFailed && <span aria-hidden="true" data-testid="analysis-tab-error" className="w-1.5 h-1.5 bg-state-failure" />}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ErrorBoundary resetKey={activeTab} fallback={(error, reset) => <PanelErrorFallback error={error} reset={reset} name={TABS.find(([t]) => t === activeTab)?.[1] ?? 'details'} />}>
        {activeTab === 'properties' && (
          <>
            <FailureControls />
            <PropertiesPanel />
          </>
        )}
        {activeTab === 'analysis' && <AnalysisPanel />}
        {activeTab === 'simulation' && <SimulationPanel />}
        </ErrorBoundary>
      </div>
    </div>
  )
}

const Studio: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const isEmpty = nodes.length === 0
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId)
  const example = useGraphStore((s) => s.example)
  const anyNodeFailed = useGraphStore((s) => s.nodes.some((n) => n.data.failed))
  const { applyNodeChanges, moveNodes, removeEdge, selectNode, selectEdge, removeSelected, undo, redo } = useGraphStore.getState()
  const { screenToFlowPosition } = useReactFlow()
  const isDesktop = useMediaQuery('(min-width: 1280px)')

  const [helpOpen, setHelpOpen] = useState(false)
  // A dashboard link opens the details sheet straight away on small screens.
  const [detailsOpen, setDetailsOpen] = useState(() => new URLSearchParams(window.location.search).has('panel') && !isDesktopNow())
  // The only state outside the store: positions during a drag, committed once when it ends. The store,
  // the stale check and the save do not run on every drag tick.
  const [dragging, setDragging] = useState<Record<string, Position> | null>(null)
  const draggingRef = useRef<Record<string, Position> | null>(null)
  const [initialViewport] = useState(() => useGraphStore.getState().viewport)

  useAutoAnalyze()

  // Dashboard metrics link to the panel that explains them.
  const [params] = useSearchParams()
  useEffect(() => {
    const view = useStudioView.getState()
    const panel = params.get('panel')
    if (panel === 'analysis' || panel === 'simulation' || panel === 'properties') view.setPanelTab(panel)
    const section = ANALYSIS_SECTIONS.find((s): s is AnalysisSection => s === params.get('section'))
    if (section) view.setSection(section)
  }, [params])

  const flowNodes = useMemo(
    () =>
      nodes.map((n) => {
        const position = dragging?.[n.id]
        const copy = nodeCopy(n)
        if (!position && n.id !== selectedNodeId) return copy
        return { ...copy, position: position ?? n.position, selected: n.id === selectedNodeId }
      }),
    [nodes, selectedNodeId, dragging]
  )
  const flowEdges = useMemo(() => edges.map((e) => (e.id === selectedEdgeId ? { ...edgeCopy(e), selected: true } : edgeCopy(e))), [edges, selectedEdgeId])

  const handleNodesChange = useCallback(
    (changes: NodeChange<EditorNode>[]) => {
      const rest: NodeChange<EditorNode>[] = []
      const ticks: Record<string, Position> = {}
      const finals: Record<string, Position> = {}
      for (const c of changes) {
        if (c.type === 'position') {
          const position = c.position ?? draggingRef.current?.[c.id]
          if (!position) continue
          if (c.dragging) ticks[c.id] = position
          else finals[c.id] = position
        } else if (c.type === 'select') {
          if (c.selected) selectNode(c.id)
          else if (useGraphStore.getState().selectedNodeId === c.id) selectNode(null)
        } else {
          rest.push(c)
        }
      }
      if (rest.length > 0) applyNodeChanges(rest)
      if (Object.keys(ticks).length > 0) {
        draggingRef.current = { ...draggingRef.current, ...ticks }
        setDragging(draggingRef.current)
      }
      if (Object.keys(finals).length > 0) {
        moveNodes(finals)
        draggingRef.current = null
        setDragging(null)
      }
    },
    [applyNodeChanges, moveNodes, selectNode]
  )
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<EditorEdge>[]) => {
      for (const c of changes) {
        if (c.type === 'remove') removeEdge(c.id)
        else if (c.type === 'select') {
          if (c.selected) selectEdge(c.id)
          else if (useGraphStore.getState().selectedEdgeId === c.id) selectEdge(null)
        }
      }
    },
    [removeEdge, selectEdge]
  )
  const handleConnect = useCallback((connection: Connection) => void connectOrExplain(connection.source, connection.target), [])
  // Selecting on the canvas opens its properties. Selecting from an analysis list stays in the analysis.
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: EditorNode) => {
      selectNode(node.id)
      useStudioView.getState().setPanelTab('properties')
    },
    [selectNode]
  )
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: EditorEdge) => {
      selectEdge(edge.id)
      useStudioView.getState().setPanelTab('properties')
    },
    [selectEdge]
  )
  const handlePaneClick = useCallback(() => selectNode(null), [selectNode])

  const handleDrop = (e: React.DragEvent) => {
    const nodeType = e.dataTransfer.getData(NODE_DRAG_TYPE)
    if (!isNodeType(nodeType)) return
    e.preventDefault()
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addNodeOrExplain(nodeType, { x: Math.round(p.x - NODE_WIDTH / 2), y: Math.round(p.y - NODE_HEIGHT / 2) })
  }

  // Enter and Space toggle selection of the focused node or link (React Flow alone only selects).
  const handleCanvasKeys = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    if (!(e.target instanceof Element)) return
    const node = e.target.closest('.react-flow__node')
    const edge = e.target.closest('.react-flow__edge')
    const id = (node ?? edge)?.getAttribute('data-id')
    if (!id) return
    e.preventDefault()
    e.stopPropagation()
    const s = useGraphStore.getState()
    if (node) selectNode(s.selectedNodeId === id ? null : id)
    else selectEdge(s.selectedEdgeId === id ? null : id)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTyping() || dialogOpen()) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (e.key === '?') {
        setHelpOpen(true)
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
    <div className="studio-root h-[calc(100dvh-var(--ns-banner-h,0px))] flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      <Navbar />
      <AnalysisAnnouncer />
      <div className="flex-1 min-h-0 flex flex-col pt-16">
        <PersistenceNotice />
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 flex flex-col">
            <StudioToolbar isDesktop={isDesktop} helpOpen={helpOpen} onHelpChange={setHelpOpen} onOpenDetails={() => setDetailsOpen(true)} />
            <div
              data-testid="studio-canvas"
              role="region"
              aria-label="Network topology canvas"
              className="flex-1 min-h-0 relative bg-bg-primary overflow-hidden"
              onKeyDownCapture={handleCanvasKeys}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={handleDrop}
            >
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={NODE_COMPONENTS}
                edgeTypes={EDGE_COMPONENTS}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                connectionMode={ConnectionMode.Loose}
                deleteKeyCode={null}
                selectionKeyCode={null}
                multiSelectionKeyCode={null}
                zoomOnDoubleClick={false}
                fitView={initialViewport === null}
                fitViewOptions={FIT_OPTIONS}
                defaultViewport={initialViewport ?? undefined}
                minZoom={0.005}
                maxZoom={2.5}
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#222638" />
                <ViewportSaver />
              </ReactFlow>
              {isEmpty && <EmptyCanvas />}
              {example && !isEmpty && (
                <span
                  data-testid="example-label"
                  className="absolute top-3 left-3 z-10 text-[11px] font-mono text-state-warning bg-bg-surface border border-state-warning/40 px-1.5 py-0.5 rounded-[2px]"
                >
                  {PRESET_TITLES[example]}
                </span>
              )}
              <StudioToast />
              {anyNodeFailed && (
                <p data-testid="failure-rule-note" className="absolute bottom-3 left-3 z-10 max-w-[min(26rem,calc(100%-1.5rem))] px-2 py-1 bg-bg-surface border border-border-subtle rounded-[2px] text-[11px] text-text-secondary">
                  {FAILURE_RULE}
                </p>
              )}
            </div>
          </div>
          {isDesktop && (
            <aside aria-label="Details and analysis" data-testid="side-panel" className="w-[380px] shrink-0 bg-bg-surface border-l border-border-subtle">
              <Panels />
            </aside>
          )}
        </div>
      </div>
      {!isDesktop && (
        <Sheet isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="Details and analysis" testId="details-sheet">
          <div className="h-[70dvh]">
            <Panels />
          </div>
        </Sheet>
      )}
    </div>
  )
}

export const StudioPage: React.FC = () => (
  <ReactFlowProvider>
    <Studio />
  </ReactFlowProvider>
)

export default StudioPage
