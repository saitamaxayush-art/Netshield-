import React, { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  Network,
  Server,
  Monitor,
  ShieldCheck,
  Trash2,
  RotateCcw,
  RefreshCw,
  Undo2,
  Redo2,
  Maximize,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  FileJson,
  Wrench,
  PanelRight,
  ChevronDown,
} from 'lucide-react'
import { useGraphStore } from '@/store/graphStore'
import { PRESET_NAMES, PRESET_TITLES, type PresetName } from '@/store/presets'
import { clearSavedData } from '@/store/persistence'
import { FIT_OPTIONS, useAddNodeAtCentre } from './studioActions'
import { GraphDataDialog } from './GraphDataDialog'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Sheet } from '@/components/ui/Sheet'
import { NODE_TYPES, type NodeType } from '@/types/graph'

export const NODE_DRAG_TYPE = 'application/netshield-node'

const PALETTE: Record<NodeType, { name: string; icon: React.ReactNode }> = {
  router: { name: 'Router', icon: <Network className="w-3.5 h-3.5 text-accent-teal" /> },
  server: { name: 'Server', icon: <Server className="w-3.5 h-3.5 text-accent-cyan" /> },
  client: { name: 'Client', icon: <Monitor className="w-3.5 h-3.5 text-text-secondary" /> },
  firewall: { name: 'Firewall', icon: <ShieldCheck className="w-3.5 h-3.5 text-state-warning" /> },
}
const PRESET_LABEL: Record<PresetName, string> = { star: 'Star', ring: 'Ring', mesh: 'Mesh', campus: 'Campus' }

const IconButton: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: 'ghost' | 'danger'; tour?: string }> = ({
  label,
  icon,
  onClick,
  disabled,
  variant = 'ghost',
  tour,
}) => (
  <Button variant={variant} size="sm" className="w-9 !px-0" aria-label={label} title={label} disabled={disabled} leftIcon={icon} onClick={onClick} data-tour={tour} />
)

/** Guided tour anchors for the toolbar actions. */
const TOUR_ANCHOR: Record<string, string> = { 'Import or export': 'import-export' }

const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['Tab', 'Move between nodes and links'],
  ['Enter or Space', 'Select or deselect the focused node or link'],
  ['Arrow keys', 'Nudge the selected node (Shift for a bigger step)'],
  ['Delete or Backspace', 'Delete the selection'],
  ['Ctrl or Cmd + Z', 'Undo'],
  ['Ctrl or Cmd + Shift + Z', 'Redo'],
  ['Escape', 'Clear the selection, or close a dialog'],
  ['?', 'Show this help'],
]

/** A labelled disclosure for the less frequent actions; closes on Escape, outside click, or a choice. */
const MoreMenu: React.FC<{ actions: ReadonlyArray<[string, React.ReactNode, () => void]> }> = ({ actions }) => {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])
  return (
    <div
      ref={root}
      className="relative ml-1"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <Button
        ref={trigger}
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls="toolbar-more"
        data-tour="more"
        rightIcon={<ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />}
        onClick={() => setOpen((o) => !o)}
      >
        More
      </Button>
      {open && (
        <div id="toolbar-more" role="group" aria-label="More canvas actions" className="absolute right-0 top-full mt-1 z-30 w-52 py-1 bg-bg-surface border border-border-strong rounded-[3px] shadow-2xl">
          {actions.map(([label, icon, run]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setOpen(false)
                run()
              }}
              className="w-full min-h-9 px-3 flex items-center gap-2.5 text-left text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface-active cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-teal"
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const StudioToolbar: React.FC<{
  isDesktop: boolean
  helpOpen: boolean
  onHelpChange: (open: boolean) => void
  onOpenDetails: () => void
}> = ({ isDesktop, helpOpen, onHelpChange, onOpenDetails }) => {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const addAtCentre = useAddNodeAtCentre()
  const hasSelection = useGraphStore((s) => s.selectedNodeId !== null || s.selectedEdgeId !== null)
  const canUndo = useGraphStore((s) => s.past.length > 0)
  const canRedo = useGraphStore((s) => s.future.length > 0)
  const { undo, redo, removeSelected, clearFailures, reset, loadPreset } = useGraphStore.getState()

  const [toolsOpen, setToolsOpen] = useState(false)
  const [pendingPreset, setPendingPreset] = useState<PresetName | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)

  const fit = () => void fitView(FIT_OPTIONS)
  // New nodes must be measured first; React Flow queues a fit requested after they are rendered.
  const fitSoon = () => setTimeout(fit, 50)
  const applyPreset = (name: PresetName) => {
    loadPreset(name)
    fitSoon()
  }
  const requestPreset = (name: PresetName) => {
    setToolsOpen(false)
    if (useGraphStore.getState().nodes.length > 0) setPendingPreset(name)
    else applyPreset(name)
  }

  const palette = NODE_TYPES.map((t) => (
    <Button
      key={t}
      variant={isDesktop ? 'ghost' : 'secondary'}
      size="sm"
      leftIcon={PALETTE[t].icon}
      draggable
      title={`Click to add a ${PALETTE[t].name.toLowerCase()} at the centre, or drag it onto the canvas`}
      onDragStart={(e) => {
        e.dataTransfer.setData(NODE_DRAG_TYPE, t)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => {
        addAtCentre(t)
        setToolsOpen(false)
      }}
    >
      {PALETTE[t].name}
    </Button>
  ))
  const presets = PRESET_NAMES.map((name) => (
    <Button key={name} variant="ghost" size="sm" title={`Load ${PRESET_TITLES[name]}`} onClick={() => requestPreset(name)}>
      {PRESET_LABEL[name]}
    </Button>
  ))
  const history = (
    <>
      <IconButton label="Undo" icon={<Undo2 className="w-4 h-4" />} disabled={!canUndo} onClick={undo} />
      <IconButton label="Redo" icon={<Redo2 className="w-4 h-4" />} disabled={!canRedo} onClick={redo} />
      <IconButton label="Delete selection" icon={<Trash2 className="w-4 h-4" />} variant="danger" disabled={!hasSelection} onClick={() => removeSelected()} />
    </>
  )
  const fitButton = <IconButton label="Fit view" icon={<Maximize className="w-4 h-4" />} onClick={fit} />
  const importExport: [string, React.ReactNode, () => void] = ['Import or export', <FileJson className="w-4 h-4" />, () => {
    setToolsOpen(false)
    setDataOpen(true)
  }]
  // Less frequent canvas actions: behind More on desktop (the wheel and pinch also zoom).
  const moreActions: ReadonlyArray<[string, React.ReactNode, () => void]> = [
    ['Zoom in', <ZoomIn className="w-4 h-4" />, () => void zoomIn()],
    ['Zoom out', <ZoomOut className="w-4 h-4" />, () => void zoomOut()],
    ['Restore all failed', <RefreshCw className="w-4 h-4" />, clearFailures],
    ['Reset canvas', <RotateCcw className="w-4 h-4" />, () => setConfirmReset(true)],
    ['Keyboard shortcuts', <HelpCircle className="w-4 h-4" />, () => onHelpChange(true)],
  ]
  const secondaryActions = [...moreActions.slice(0, 4), importExport, moreActions[4]]
  const heading = 'text-[11px] font-mono text-text-muted uppercase tracking-wider'

  return (
    <>
      <div role="toolbar" aria-label="Network editing tools" data-testid="studio-toolbar" className="h-12 shrink-0 bg-bg-surface border-b border-border-subtle px-3 flex items-center justify-between gap-1 text-xs">
        {isDesktop ? (
          <>
            <div className="flex items-center gap-1" data-tour="add-nodes">
              {palette}
            </div>
            <div className="flex items-center gap-0.5" data-tour="presets">
              <span className={`${heading} ml-1`}>Example:</span>
              {presets}
            </div>
            <div className="flex items-center">
              {history}
              {fitButton}
              <IconButton label={importExport[0]} icon={importExport[1]} onClick={importExport[2]} tour={TOUR_ANCHOR[importExport[0]]} />
              <MoreMenu actions={moreActions} />
            </div>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" data-tour="tools" leftIcon={<Wrench className="w-3.5 h-3.5" />} onClick={() => setToolsOpen(true)}>
              Tools
            </Button>
            <div className="flex items-center">
              {history}
              {fitButton}
              <IconButton label="Details and analysis" icon={<PanelRight className="w-4 h-4" />} onClick={onOpenDetails} />
            </div>
          </>
        )}
      </div>

      <Sheet isOpen={toolsOpen} onClose={() => setToolsOpen(false)} title="Tools" testId="tools-sheet">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className={heading}>Add node</div>
            <div className="grid grid-cols-2 gap-2">{palette}</div>
          </div>
          <div className="space-y-2">
            <div className={heading}>Load example</div>
            <div className="grid grid-cols-3 gap-2">{presets}</div>
          </div>
          <div className="space-y-2">
            <div className={heading}>Canvas</div>
            {/* Visible names: touch has no hover titles. */}
            <div className="grid grid-cols-2 gap-2">
              {secondaryActions.map(([label, icon, run]) => (
                <Button key={label} variant="secondary" size="sm" leftIcon={icon} onClick={run}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      <Dialog
        isOpen={pendingPreset !== null}
        onClose={() => setPendingPreset(null)}
        title="Replace the current graph?"
        description="Loading an example replaces the nodes and links on the canvas. You can undo this."
        confirmLabel={pendingPreset ? `Load ${PRESET_LABEL[pendingPreset]} example` : 'Load'}
        onConfirm={() => {
          if (pendingPreset) applyPreset(pendingPreset)
        }}
      >
        {pendingPreset && <p className="text-xs text-text-muted">{PRESET_TITLES[pendingPreset]}</p>}
      </Dialog>
      <Dialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the canvas?"
        description="Remove all nodes and links from the canvas. You can undo this."
        confirmLabel="Reset canvas"
        isDanger
        onConfirm={() => {
          setToolsOpen(false)
          reset()
        }}
      >
        <p className="text-xs text-text-muted">Settings are kept.</p>
      </Dialog>
      <Dialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear saved data?"
        description="Remove the saved graph and settings from this browser and go back to the star example. This cannot be undone."
        confirmLabel="Clear saved data"
        isDanger
        onConfirm={() => {
          setToolsOpen(false)
          clearSavedData()
          fitSoon()
        }}
      >
        <p className="text-xs text-text-muted">The Privacy page offers the same action.</p>
      </Dialog>
      <GraphDataDialog isOpen={dataOpen} onClose={() => setDataOpen(false)} onImported={fitSoon} onClearSaved={() => setConfirmClear(true)} />
      <Dialog isOpen={helpOpen} onClose={() => onHelpChange(false)} title="Keyboard shortcuts" cancelLabel="Close">
        <dl data-testid="shortcut-help" className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          {SHORTCUTS.map(([key, what]) => (
            <React.Fragment key={key}>
              <dt className="font-mono text-accent-teal">{key}</dt>
              <dd className="text-text-secondary">{what}</dd>
            </React.Fragment>
          ))}
        </dl>
        <p className="mt-3 text-xs text-text-muted">Touch: tap a handle on one node, then a handle on another, to connect them.</p>
        <p className="mt-2 text-xs text-text-muted">The guided tour is turned on and off with the Tutorial switch at the top of the page.</p>
      </Dialog>
    </>
  )
}
