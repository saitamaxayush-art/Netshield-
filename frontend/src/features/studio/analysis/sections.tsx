/**
 * One component per analysis section. Each shows only values from the backend result it is given (or
 * a labelled demo result), with the mathematical explanation for its explanation key.
 */
import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Play, Square } from 'lucide-react'
import type { Analysis, AnalyzeResponseBody } from '@/services/api/schemas'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useGraphStore } from '@/store/graphStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useStudioView } from '@/store/studioViewStore'
import { EXPLANATIONS, type ExplanationKey } from '../explanations'
import { nodeNames } from '../nodeNames'

type LabelOf = (id: string) => string
const card = 'p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle space-y-2'
const heading = 'text-[11px] font-mono font-semibold uppercase tracking-wider text-text-primary'
const select = 'w-full px-2 py-1 bg-bg-surface border border-border-strong rounded-[2px] text-text-primary text-xs focus:border-accent-teal focus:outline-none'
const listButton = (active: boolean) =>
  `w-full text-left px-2 py-1.5 border rounded-[2px] font-mono text-[11px] cursor-pointer ${
    active ? 'border-state-warning text-state-warning bg-state-warning-dim' : 'border-border-subtle text-accent-teal bg-bg-primary hover:border-border-strong'
  }`

export const Explain: React.FC<{ k: ExplanationKey }> = ({ k }) => (
  <p data-testid={`explain-${k}`} className="text-[10px] text-text-muted leading-snug">
    {EXPLANATIONS[k]}
  </p>
)

const Stat: React.FC<{ label: string; value: React.ReactNode; testId?: string }> = ({ label, value, testId }) => (
  <div className="p-2.5 bg-bg-primary rounded-[2px] border border-border-subtle font-mono">
    <div className="text-[10px] text-text-muted">{label}</div>
    <div className="text-base font-semibold text-text-primary mt-0.5" data-testid={testId}>
      {value}
    </div>
  </div>
)

export const OverviewSection: React.FC<{ current: Analysis }> = ({ current }) => (
  <div className="space-y-3" data-testid="section-overview">
    <div className={card}>
      <div className="flex items-center justify-between">
        <span className={heading}>Connectivity</span>
        <Badge variant={current.connectivity.connected ? 'success' : 'failure'} size="sm" data-testid="analysis-connected">
          {current.connectivity.connected ? 'Connected' : 'Not connected'}
        </Badge>
      </div>
      <p className="text-[11px] text-text-secondary" data-testid="analysis-reason">
        {current.connectivity.reason}
      </p>
      <Explain k={current.connectivity.explanationKey} />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Nodes" value={current.summary.nodeCount} testId="analysis-node-count" />
      <Stat label="Links" value={current.summary.edgeCount} testId="analysis-edge-count" />
      <Stat label="Components" value={current.connectivity.componentCount} testId="analysis-component-count" />
      <Stat label="Density" value={current.summary.density.toFixed(4)} testId="analysis-density" />
    </div>
    {current.summary.nodeCount > 0 && current.summary.operationalNodeCount === 0 && (
      <p role="note" data-testid="all-failed-note" className="text-[11px] text-state-warning">
        Every node is marked failed, so no node is operational and there is nothing to connect.
      </p>
    )}
    <p className="text-[11px] font-mono text-text-muted">
      Operational: {current.summary.operationalNodeCount} nodes, {current.summary.operationalEdgeCount} links. Failed: {current.summary.failedNodeCount} nodes,{' '}
      {current.summary.failedEdgeCount} links. Unavailable links in total: {current.summary.unavailableEdgeCount}.
    </p>
    <Explain k={current.summary.explanationKey} />
    <Explain k={current.components.explanationKey} />
  </div>
)

export const ComponentsSection: React.FC<{ current: Analysis; labelOf: LabelOf }> = ({ current, labelOf }) => {
  const focus = useStudioView((s) => s.focusComponent)
  const focusOn = useStudioView((s) => s.focusOnComponent)
  const { items } = current.components
  return (
    <div className="space-y-3" data-testid="section-components">
      <div className={heading}>Components ({items.length})</div>
      <Explain k={current.components.explanationKey} />
      {items.length === 0 ? (
        <p className="text-[11px] text-text-muted italic" data-testid="components-none">
          No operational nodes, so there are no components.
        </p>
      ) : (
        <ul className="space-y-1.5" data-testid="analysis-components">
          {items.map((members, i) => (
            <li key={members[0]}>
              <button type="button" aria-pressed={focus === i} data-component-index={i} className={listButton(focus === i)} onClick={() => focusOn(focus === i ? null : i)}>
                <span className="font-semibold">
                  C{i} ({members.length} {members.length === 1 ? 'node' : 'nodes'})
                </span>
                <span className="block text-text-secondary break-words">{members.map(labelOf).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && <p className="text-[10px] text-text-muted">Select a component to highlight it on the canvas.</p>}
    </div>
  )
}

export const CriticalSection: React.FC<{ current: Analysis; labelOf: LabelOf; linkName: (edgeId: string) => string }> = ({ current, labelOf, linkName }) => {
  const focus = useStudioView((s) => s.focusCritical)
  const focusOn = useStudioView((s) => s.focusOnCritical)
  const selectNode = useGraphStore((s) => s.selectNode)
  const selectEdge = useGraphStore((s) => s.selectEdge)
  return (
    <div className="space-y-3" data-testid="section-critical">
      <div className={card}>
        <div className={heading}>Bridges ({current.bridges.edgeIds.length})</div>
        <Explain k={current.bridges.explanationKey} />
        {current.bridges.edgeIds.length > 0 ? (
          <ul className="space-y-1" data-testid="analysis-bridges">
            {current.bridges.edgeIds.map((id) => {
              const active = focus?.kind === 'bridge' && focus.id === id
              return (
                <li key={id} data-edge-id={id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    className={listButton(active)}
                    onClick={() => {
                      focusOn({ kind: 'bridge', id })
                      selectEdge(id)
                    }}
                  >
                    {linkName(id)}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-text-muted italic" data-testid="analysis-bridges-none">
            No bridges: no single link failure splits a component.
          </p>
        )}
      </div>
      <div className={card}>
        <div className={heading}>Articulation points ({current.articulationPoints.nodeIds.length})</div>
        <Explain k={current.articulationPoints.explanationKey} />
        {current.articulationPoints.nodeIds.length > 0 ? (
          <ul className="space-y-1" data-testid="analysis-articulation">
            {current.articulationPoints.nodeIds.map((id) => {
              const active = focus?.kind === 'articulation' && focus.id === id
              return (
                <li key={id} data-node-id={id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    className={listButton(active)}
                    onClick={() => {
                      focusOn({ kind: 'articulation', id })
                      selectNode(id)
                    }}
                  >
                    {labelOf(id)}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-text-muted italic" data-testid="analysis-articulation-none">
            No articulation points: no single node failure splits a component.
          </p>
        )}
      </div>
    </div>
  )
}

type DegreeSort = 'node' | 'operational' | 'stored'

export const DegreesSection: React.FC<{ current: Analysis; labelOf: LabelOf }> = ({ current, labelOf }) => {
  const [sort, setSort] = useState<{ by: DegreeSort; descending: boolean }>({ by: 'operational', descending: true })
  const rows = Object.entries(current.degrees.byNode).map(([id, d]) => ({ id, label: labelOf(id), ...d }))
  rows.sort((a, b) => {
    const order = sort.by === 'node' ? a.label.localeCompare(b.label) : a[sort.by] - b[sort.by]
    return (sort.descending ? -order : order) || a.label.localeCompare(b.label)
  })
  const header = (by: DegreeSort, name: string) => (
    <th scope="col" className="p-0" aria-sort={sort.by === by ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        className="w-full p-2 text-left font-mono cursor-pointer hover:text-text-primary"
        onClick={() => setSort({ by, descending: sort.by === by ? !sort.descending : by !== 'node' })}
      >
        {name}
        {sort.by === by ? (sort.descending ? ' (high first)' : ' (low first)') : ''}
      </button>
    </th>
  )
  return (
    <div className="space-y-3" data-testid="section-degrees">
      <Explain k={current.degrees.explanationKey} />
      {rows.length === 0 ? (
        <p className="text-[11px] text-text-muted italic">No nodes.</p>
      ) : (
        <div className="overflow-x-auto border border-border-subtle rounded-[2px]">
          <table className="w-full font-mono text-[11px]" data-testid="analysis-degrees">
            <thead className="bg-bg-primary text-text-muted border-b border-border-subtle">
              <tr>
                {header('node', 'Node')}
                {header('operational', 'Operational')}
                {header('stored', 'Stored')}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((r) => (
                <tr key={r.id} data-node-id={r.id}>
                  <td className="p-2 text-text-primary">{r.label}</td>
                  <td className="p-2 text-accent-teal">{r.operational}</td>
                  <td className="p-2 text-text-secondary">{r.stored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const NodeSelect: React.FC<{ id: string; label: string; placeholder: string; value: string; nodes: Array<{ id: string; label: string }>; onChange: (id: string) => void }> = ({
  id,
  label,
  placeholder,
  value,
  nodes,
  onChange,
}) => (
  <div>
    <label htmlFor={id} className="block text-[10px] text-text-muted mb-1 font-mono">
      {label}
    </label>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={select}>
      <option value="">{placeholder}</option>
      {nodes.map((n) => (
        <option key={n.id} value={n.id}>
          {n.label}
        </option>
      ))}
    </select>
  </div>
)

function useNodeOptions() {
  const nodes = useGraphStore((s) => s.nodes)
  const names = nodeNames(nodes)
  return nodes.map((n) => ({ id: n.id, label: names.get(n.id) ?? n.id }))
}

export const TraversalSection: React.FC<{ current: Analysis; labelOf: LabelOf }> = ({ current, labelOf }) => {
  const options = useNodeOptions()
  const start = useSettingsStore((s) => s.traversalStart) ?? ''
  const update = useSettingsStore((s) => s.update)
  const v = useStudioView()
  const { traversal } = current
  const ready = traversal !== null && traversal.error === null
  const length = ready ? (v.traversalOrder === 'bfs' ? traversal.bfs.length : traversal.dfs.length) : 0
  return (
    <div className="space-y-3" data-testid="section-traversal">
      <NodeSelect id="traversal-start" label="Start node:" placeholder="(Select start)" value={start} nodes={options} onChange={(id) => update({ traversalStart: id || null })} />
      {!traversal && <p className="text-[11px] text-text-muted italic">Choose a start node to see the BFS and DFS orders.</p>}
      {traversal?.error && (
        <p className="text-[11px] text-state-failure" data-testid="traversal-error">
          {traversal.error.message}
        </p>
      )}
      {ready && (
        <>
          <div className={card}>
            <div className={heading}>BFS, with layer numbers</div>
            <p className="font-mono text-[10px] text-text-primary break-words" data-testid="analysis-bfs">
              {traversal.bfs.map((s) => `${labelOf(s.nodeId)} (${s.layer})`).join(' → ')}
            </p>
            <Explain k={traversal.bfsExplanationKey} />
          </div>
          <div className={card}>
            <div className={heading}>DFS</div>
            <p className="font-mono text-[10px] text-text-primary break-words" data-testid="analysis-dfs">
              {traversal.dfs.map(labelOf).join(' → ')}
            </p>
            <Explain k={traversal.dfsExplanationKey} />
          </div>
          <div className={card}>
            <div className={heading}>Show on the canvas</div>
            <div className="grid grid-cols-2 gap-2">
              {(['bfs', 'dfs'] as const).map((order) => (
                <Button key={order} variant={v.traversalOrder === order ? 'primary' : 'secondary'} size="sm" aria-pressed={v.traversalOrder === order} onClick={() => v.setTraversalOrder(order)}>
                  {order.toUpperCase()}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {v.playing ? (
                <Button variant="outline" size="sm" leftIcon={<Square className="w-3 h-3" />} onClick={v.stopTraversal}>
                  Stop
                </Button>
              ) : (
                <Button variant="outline" size="sm" leftIcon={<Play className="w-3 h-3" />} onClick={v.playTraversal}>
                  Play
                </Button>
              )}
              <Button variant="ghost" size="sm" aria-label="Previous step" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={() => v.stepTraversal(-1)} />
              <Button variant="ghost" size="sm" aria-label="Next step" leftIcon={<ChevronRight className="w-4 h-4" />} onClick={() => v.stepTraversal(1)} />
              <Button variant="ghost" size="sm" onClick={v.resetTraversal}>
                Show all
              </Button>
            </div>
            <p className="text-[11px] font-mono text-text-secondary" data-testid="traversal-step">
              {v.traversalStep === null ? `Showing all ${length} visited nodes` : `Step ${v.traversalStep + 1} of ${length}`}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

const PATH_REASON: Record<'SOURCE_FAILED' | 'TARGET_FAILED' | 'DISCONNECTED', string> = {
  SOURCE_FAILED: 'No path: the source node is failed.',
  TARGET_FAILED: 'No path: the target node is failed.',
  DISCONNECTED: 'No path exists: the two nodes are in different components.',
}

export const PathsSection: React.FC<{ current: Analysis; labelOf: LabelOf }> = ({ current, labelOf }) => {
  const options = useNodeOptions()
  const source = useSettingsStore((s) => s.pathSource) ?? ''
  const target = useSettingsStore((s) => s.pathTarget) ?? ''
  const useWeights = useSettingsStore((s) => s.useWeights)
  const update = useSettingsStore((s) => s.update)
  const allWeighted = useGraphStore((s) => s.edges.length > 0 && s.edges.every((e) => e.data?.weight !== undefined))
  const { path } = current
  return (
    <div className="space-y-3" data-testid="section-paths">
      <div className="grid grid-cols-2 gap-2">
        <NodeSelect id="path-source" label="Source:" placeholder="(Select source)" value={source} nodes={options} onChange={(id) => update({ pathSource: id || null })} />
        <NodeSelect id="path-target" label="Target:" placeholder="(Select target)" value={target} nodes={options} onChange={(id) => update({ pathTarget: id || null })} />
      </div>
      {allWeighted && (
        <label className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer">
          <input type="checkbox" data-testid="path-use-weights" checked={useWeights} onChange={(e) => update({ useWeights: e.target.checked })} />
          Use link weights (every link has one)
        </label>
      )}
      {!path && <p className="text-[11px] text-text-muted italic">Choose a source and a target to see the shortest path.</p>}
      {path && (
        <div className={card} data-testid="analysis-path">
          <div className={heading}>Shortest path</div>
          {path.found && path.nodeIds ? (
            <p className="font-mono text-[11px] text-accent-teal font-semibold break-words">
              {path.nodeIds.map(labelOf).join(' → ')} ({path.hops} hops{path.metric === 'weight' ? `, total weight ${path.length}` : ''})
            </p>
          ) : (
            <p className="font-mono text-[11px] text-state-failure">{PATH_REASON[path.reason ?? 'DISCONNECTED']}</p>
          )}
          <Explain k={path.explanationKey} />
        </div>
      )}
    </div>
  )
}

export const CompareSection: React.FC<{ result: AnalyzeResponseBody }> = ({ result }) => {
  const { current, healthy } = result
  if (!healthy) return <p className="text-[11px] text-text-muted italic">No healthy comparison in this result.</p>
  const rows: Array<[string, string, string]> = [
    ['Connected', healthy.connectivity.connected ? 'Yes' : 'No', current.connectivity.connected ? 'Yes' : 'No'],
    ['Components', String(healthy.connectivity.componentCount), String(current.connectivity.componentCount)],
    ['Operational nodes', String(healthy.summary.operationalNodeCount), String(current.summary.operationalNodeCount)],
    ['Operational links', String(healthy.summary.operationalEdgeCount), String(current.summary.operationalEdgeCount)],
    ['Density', healthy.summary.density.toFixed(4), current.summary.density.toFixed(4)],
    ['Bridges', String(healthy.bridges.edgeIds.length), String(current.bridges.edgeIds.length)],
    ['Articulation points', String(healthy.articulationPoints.nodeIds.length), String(current.articulationPoints.nodeIds.length)],
  ]
  return (
    <div className="space-y-3" data-testid="section-compare">
      <p className="text-[11px] text-text-secondary">The same network with every failure cleared, next to its current state.</p>
      <div className="overflow-x-auto border border-border-subtle rounded-[2px]">
        <table className="w-full font-mono text-[11px]" data-testid="analysis-compare">
          <thead className="bg-bg-primary text-text-muted border-b border-border-subtle">
            <tr>
              <th scope="col" className="p-2 text-left">
                Measure
              </th>
              <th scope="col" className="p-2 text-left">
                Healthy
              </th>
              <th scope="col" className="p-2 text-left">
                Current
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map(([name, before, after]) => (
              <tr key={name} data-measure={name} data-changed={before !== after}>
                <td className="p-2 text-text-secondary">{name}</td>
                <td className="p-2 text-text-primary">{before}</td>
                <td className={`p-2 ${before !== after ? 'text-state-warning font-semibold' : 'text-text-primary'}`}>
                  {after}
                  {before !== after ? ' (changed)' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const AnalysisSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse motion-reduce:animate-none" data-testid="analysis-skeleton" aria-hidden="true">
    <div className="h-20 bg-bg-surface-elevated rounded-[2px]" />
    <div className="grid grid-cols-2 gap-2">
      <div className="h-14 bg-bg-surface-elevated rounded-[2px]" />
      <div className="h-14 bg-bg-surface-elevated rounded-[2px]" />
      <div className="h-14 bg-bg-surface-elevated rounded-[2px]" />
      <div className="h-14 bg-bg-surface-elevated rounded-[2px]" />
    </div>
  </div>
)
