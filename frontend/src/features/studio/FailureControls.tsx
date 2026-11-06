import React, { useState } from 'react'
import { AlertTriangle, CheckCircle2, Dices, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useGraphStore } from '@/store/graphStore'

export const FAILURE_RULE = 'When a node fails, its links become unavailable (dashed and faded). Their own stored status does not change.'

/** Every action goes through graphStore, which triggers re-analysis. */
export const FailureControls: React.FC = () => {
  const selectedNode = useGraphStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId))
  const selectedEdge = useGraphStore((s) => s.edges.find((e) => e.id === s.selectedEdgeId))
  const anyFailed = useGraphStore((s) => s.nodes.some((n) => n.data.failed) || s.edges.some((e) => e.data?.failed))
  const empty = useGraphStore((s) => s.nodes.length === 0)
  const last = useGraphStore((s) => s.lastRandom)
  const { failNode, restoreNode, failEdge, restoreEdge, clearFailures, failRandom } = useGraphStore.getState()
  const [seed, setSeed] = useState('1')
  const [error, setError] = useState<string | null>(null)

  const kind = selectedNode ? 'node' : selectedEdge ? 'edge' : null
  const failed = selectedNode ? selectedNode.data.failed : (selectedEdge?.data?.failed ?? false)
  const name = kind ?? ''
  const fail = () => {
    if (selectedNode) failNode(selectedNode.id)
    else if (selectedEdge) failEdge(selectedEdge.id)
  }
  const restore = () => {
    if (selectedNode) restoreNode(selectedNode.id)
    else if (selectedEdge) restoreEdge(selectedEdge.id)
  }

  return (
    <div className="p-5 space-y-3 text-xs border-b border-border-subtle" data-testid="failure-controls">
      <div className="font-semibold uppercase tracking-wider text-[11px] font-mono text-text-primary">Failures</div>
      <div className="grid grid-cols-1 gap-2">
        <Button variant="danger" size="sm" disabled={kind === null || failed} leftIcon={<AlertTriangle className="w-3.5 h-3.5" />} onClick={fail}>
          {`Fail selected ${name}`.trim()}
        </Button>
        <Button variant="secondary" size="sm" disabled={kind === null || !failed} leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-state-success" />} onClick={restore}>
          {`Restore selected ${name}`.trim()}
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <Button
          variant="outline"
          size="sm"
          disabled={empty}
          leftIcon={<Dices className="w-3.5 h-3.5" />}
          onClick={() => {
            const result = failRandom(Number(seed === '' ? Number.NaN : seed))
            setError(result.ok ? null : result.error)
          }}
        >
          Fail random
        </Button>
        <div className="w-20">
          <label htmlFor="random-seed" className="block text-[10px] text-text-muted mb-1 font-mono">
            Seed
          </label>
          <input
            id="random-seed"
            type="number"
            min={0}
            step={1}
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-full h-9 px-2 bg-bg-primary border border-border-strong rounded-[2px] text-text-primary font-mono text-xs focus:border-accent-teal focus:outline-none"
          />
        </div>
      </div>
      {last && (
        <p className="text-[11px] font-mono text-text-secondary" data-testid="random-result" data-kind={last.kind} data-id={last.id}>
          Fail random picked {last.kind === 'node' ? 'node' : 'link'} {last.id} (seed {last.seed}, draw {last.draw}).
        </p>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-state-failure" data-testid="random-error">
          {error}
        </p>
      )}
      <Button variant="ghost" size="sm" className="w-full" disabled={!anyFailed} leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={clearFailures}>
        Clear all failures
      </Button>
      <p className="text-[10px] text-text-muted leading-snug">{FAILURE_RULE}</p>
    </div>
  )
}
