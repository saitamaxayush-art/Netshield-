/** Import a graph file (validated, previewed, undoable), export JSON, SVG or PNG, and clear saved data. */
import React, { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useGraphStore } from '@/store/graphStore'
import { useAnalysisStore } from '@/store/analysisStore'
import type { EditorGraph } from '@/types/graph'
import { exportGraphFile, MAX_IMPORT_BYTES, parseGraphFile } from './graphFile'
import { graphSvg, svgToPng } from './canvasImage'
import { download, downloadBlob } from './simulationExport'

const heading = 'text-[11px] font-mono text-text-muted uppercase tracking-wider'
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

export const GraphDataDialog: React.FC<{ isOpen: boolean; onClose: () => void; onImported: () => void; onClearSaved: () => void }> = ({ isOpen, onClose, onImported, onClearSaved }) => {
  const [errors, setErrors] = useState<string[] | null>(null)
  const [preview, setPreview] = useState<{ name: string; graph: EditorGraph } | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const current = { nodes: useGraphStore((s) => s.nodes.length), edges: useGraphStore((s) => s.edges.length) }
  const close = () => {
    setErrors(null)
    setPreview(null)
    setImageError(null)
    onClose()
  }

  const onFile = (file: File | undefined) => {
    setErrors(null)
    setPreview(null)
    if (!file) return
    // Refuse oversized files before reading them.
    if (file.size > MAX_IMPORT_BYTES) {
      setErrors([`The file is ${(file.size / 1024).toFixed(0)} KB; the limit is ${MAX_IMPORT_BYTES / 1024} KB.`])
      return
    }
    void file.text().then(
      (text) => {
        const result = parseGraphFile(text, file.size)
        if (result.ok) setPreview({ name: file.name, graph: result.graph })
        else setErrors(result.errors)
      },
      () => setErrors(['The file could not be read.'])
    )
  }

  const graphNow = () => {
    const s = useGraphStore.getState()
    return { nodes: s.nodes, edges: s.edges }
  }
  const componentOf = () => {
    const slot = useAnalysisStore.getState().analyze
    return slot.result && !slot.stale ? slot.result.current.components.componentOf : null
  }
  const exportPng = () => {
    setImageError(null)
    svgToPng(graphSvg(graphNow(), componentOf())).then(
      (blob) => downloadBlob(`netshield-network-${stamp()}.png`, blob),
      (e: unknown) => setImageError(e instanceof Error ? e.message : 'Could not create the PNG.')
    )
  }

  return (
    <Dialog isOpen={isOpen} onClose={close} title="Import, export and saved data" cancelLabel="Close">
      <div className="space-y-5" data-testid="graph-data-dialog">
        <section className="space-y-2">
          <h3 className={heading}>Import a graph</h3>
          <label className="flex items-center gap-2 min-h-10 px-3 border border-border-strong rounded-[3px] text-xs cursor-pointer focus-within:ring-2 focus-within:ring-accent-teal hover:border-accent-teal/50">
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Choose a NetShield graph file (.json, up to {MAX_IMPORT_BYTES / 1024} KB)</span>
            <input type="file" accept=".json,application/json" className="sr-only" data-testid="import-file" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {errors && (
            <div role="alert" data-testid="import-errors" className="p-2 bg-state-failure-dim border border-state-failure/40 rounded-[2px] text-state-failure text-[11px] space-y-1">
              <div className="font-semibold">The file was not imported:</div>
              <ul className="list-disc pl-4 font-mono break-words">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {preview && (
            <div data-testid="import-preview" className="p-2 bg-bg-primary border border-border-subtle rounded-[2px] text-[11px] space-y-2">
              <div>
                <span className="font-semibold">{preview.name}</span>: {preview.graph.nodes.length} nodes and {preview.graph.edges.length} links.
              </div>
              <div className="font-mono text-text-secondary break-words">
                Nodes: {preview.graph.nodes.slice(0, 8).map((n) => n.data.label).join(', ')}
                {preview.graph.nodes.length > 8 ? `, and ${preview.graph.nodes.length - 8} more` : ''}
              </div>
              <div className="text-state-warning">
                This replaces the current graph ({current.nodes} nodes, {current.edges} links). You can undo it.
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const result = useGraphStore.getState().importGraph(preview.graph)
                  if (result.ok) {
                    close()
                    onImported()
                  } else setErrors([result.error])
                }}
              >
                Replace graph
              </Button>
            </div>
          )}
        </section>
        <section className="space-y-2">
          <h3 className={heading}>Export</h3>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={() => download(`netshield-graph-${stamp()}.json`, exportGraphFile(graphNow(), new Date().toISOString()), 'application/json')}>
              JSON
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={() => download(`netshield-network-${stamp()}.svg`, graphSvg(graphNow(), componentOf()), 'image/svg+xml')}>
              SVG
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={exportPng}>
              PNG
            </Button>
          </div>
          {imageError && (
            <p role="alert" className="text-[11px] text-state-failure">
              {imageError}
            </p>
          )}
          <p className="text-[10px] text-text-muted">JSON can be imported again. SVG and PNG are pictures of the canvas with component colours from the latest analysis.</p>
        </section>
        <section className="space-y-2">
          <h3 className={heading}>Saved data</h3>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              close()
              onClearSaved()
            }}
          >
            Clear saved data
          </Button>
        </section>
      </div>
    </Dialog>
  )
}
