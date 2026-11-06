/**
 * Simulation and analysis charts. Each plots only the result it is given, is described in text for
 * screen readers, and can be switched to a data table. Nothing is drawn before data exists.
 */
import React, { useId, useState } from 'react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Eye, Table } from 'lucide-react'
import type { Analysis, SweepResponseBody } from '@/services/api/schemas'
import type { SimulationRun } from '@/store/simulationRuns'
import { Button } from '@/components/ui/Button'

const C = {
  grid: '#222638',
  axis: '#94A3B8',
  estimate: '#2DD4BF',
  band: '#2DD4BF',
  success: '#2DD4BF',
  failure: '#F43F5E',
  bars: '#38BDF8',
  healthy: '#2DD4BF',
  current: '#F59E0B',
  tooltipBg: '#181B28',
  tooltipBorder: '#2F364E',
}
const axis = { stroke: C.axis, fontSize: 10, tickLine: false } as const
const tooltip = {
  contentStyle: { backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, borderRadius: 2, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#E9ECEE' },
  labelStyle: { color: '#E9ECEE' },
  itemSorter: (item: { name?: unknown }) => SERIES_ORDER.indexOf(String(item.name)),
} as const
// Keep series in drawing order (Recharts sorts legend and tooltip entries alphabetically by default).
const SERIES_ORDER = ['95% Wilson interval', 'Estimate', 'Successful', 'Failed', 'Healthy', 'Current', 'Trials']
const legend = { wrapperStyle: { fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: C.axis }, itemSorter: null } as const
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`

interface ChartCardProps {
  title: string
  /** Plain text summary of what the chart shows, read by screen readers. */
  description: string
  testId: string
  table: { columns: string[]; rows: Array<Array<string | number>> }
  children: React.ReactNode
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, description, testId, table, children }) => {
  const [showTable, setShowTable] = useState(false)
  const descriptionId = useId()
  return (
    <figure className="p-3 bg-bg-primary border border-border-subtle rounded-[2px] space-y-2" data-testid={testId} aria-describedby={descriptionId}>
      <div className="flex items-center justify-between gap-2">
        <figcaption className="text-[11px] font-mono uppercase tracking-wider text-text-primary">{title}</figcaption>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[11px] shrink-0"
          aria-pressed={showTable}
          leftIcon={showTable ? <Eye className="w-3 h-3" /> : <Table className="w-3 h-3" />}
          onClick={() => setShowTable(!showTable)}
        >
          {showTable ? 'View chart' : 'View data table'}
        </Button>
      </div>
      <p id={descriptionId} className="text-[10px] text-text-muted leading-snug" data-testid={`${testId}-description`}>
        {description}
      </p>
      {showTable ? (
        <div className="h-56 overflow-auto border border-border-subtle rounded-[2px]">
          <table className="w-full text-left font-mono text-[10px]" data-testid={`${testId}-table`}>
            <thead className="bg-bg-surface text-text-muted border-b border-border-subtle sticky top-0">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="p-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="p-2 text-text-primary">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-56 w-full" role="img" aria-label={`${title}. ${description}`}>
          {children}
        </div>
      )}
    </figure>
  )
}

/** Chart 1: reliability against link failure probability, with the 95% Wilson band. */
export const SweepChart: React.FC<{ result: SweepResponseBody & { isDemo: boolean } }> = ({ result }) => {
  const data = result.points.map((pt) => ({
    p: Number((pt.p * 100).toFixed(2)),
    estimate: Number((pt.estimate * 100).toFixed(2)),
    band: [Number((pt.wilson95.low * 100).toFixed(2)), Number((pt.wilson95.high * 100).toFixed(2))],
  }))
  const first = result.points[0]
  const last = result.points[result.points.length - 1]
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono text-text-muted" data-testid="sweep-summary" data-source={result.isDemo ? 'demo' : 'backend'}>
        {result.points.length} points from {result.isDemo ? 'the demo adapter' : 'the FastAPI backend'}: R = {pct(first.estimate)} at p = {pct(first.p)} to R ={' '}
        {pct(last.estimate)} at p = {pct(last.p)}
      </p>
      <ChartCard
        title={`Reliability vs link failure p${result.isDemo ? ' (Demo result)' : ''}`}
        testId="chart-sweep"
        description={`Estimated reliability at ${result.points.length} values of p from ${pct(first.p)} to ${pct(last.p)}, ${result.trialsPerPoint} trials each, with the 95 percent Wilson interval as a band. It falls from ${pct(first.estimate)} to ${pct(last.estimate)}.`}
        table={{
          columns: ['p', 'Estimate', 'Successful', 'Wilson 95%'],
          rows: result.points.map((pt) => [pct(pt.p), pct(pt.estimate), `${pt.connectedTrials} / ${result.trialsPerPoint}`, `[${pct(pt.wilson95.low)}, ${pct(pt.wilson95.high)}]`]),
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
            <XAxis dataKey="p" {...axis} unit="%" type="number" domain={['dataMin', 'dataMax']} />
            <YAxis {...axis} domain={[0, 100]} unit="%" />
            <Tooltip {...tooltip} formatter={(value) => (Array.isArray(value) ? `${String(value[0])}% to ${String(value[1])}%` : `${String(value)}%`)} labelFormatter={(p) => `p = ${String(p)}%`} />
            <Legend {...legend} />
            <Area dataKey="band" name="95% Wilson interval" legendType="square" stroke={C.band} strokeOpacity={0.35} fill={C.band} fillOpacity={0.25} isAnimationActive={false} />
            <Line dataKey="estimate" name="Estimate" legendType="line" stroke={C.estimate} strokeWidth={2} dot={{ r: 2.5, fill: C.estimate }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

/** Chart 2: successful and failed trials, per batch when the run was split. */
export const TrialsChart: React.FC<{ run: SimulationRun }> = ({ run }) => {
  const data = run.batches.map((b, i) => ({ name: run.isBatched ? `Batch ${i + 1}` : 'All trials', successful: b.connectedTrials, failed: b.trials - b.connectedTrials }))
  const { trials, connectedTrials } = run.combined
  return (
    <ChartCard
      title="Successful vs failed trials"
      testId="chart-trials"
      description={`${connectedTrials} of ${trials} trials succeeded and ${trials - connectedTrials} failed${run.isBatched ? `, over ${run.batches.length} batches` : ''}.`}
      table={{ columns: ['Request', 'Successful', 'Failed', 'Total', 'Seed'], rows: run.batches.map((b, i) => [data[i].name, b.connectedTrials, b.trials - b.connectedTrials, b.trials, b.seed]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" {...axis} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tooltip} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Legend {...legend} />
          <Bar dataKey="successful" name="Successful" stackId="t" fill={C.success} isAnimationActive={false} />
          <Bar dataKey="failed" name="Failed" stackId="t" fill={C.failure} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/** Chart 3: how many trials ended with each number of components. */
export const HistogramChart: React.FC<{ run: SimulationRun }> = ({ run }) => {
  const { componentHistogram, trials, averageComponents } = run.combined
  const data = componentHistogram.map((bin) => ({ components: String(bin.components), trials: bin.trials }))
  const commonest = [...componentHistogram].sort((a, b) => b.trials - a.trials)[0]
  return (
    <ChartCard
      title="Components per trial"
      testId="chart-histogram"
      description={`Number of trials ending with each component count. Most often ${commonest?.components ?? 0} ${commonest?.components === 1 ? 'component' : 'components'} (${commonest?.trials ?? 0} of ${trials} trials); average ${averageComponents.toFixed(3)}.`}
      table={{ columns: ['Components', 'Trials', 'Share'], rows: componentHistogram.map((bin) => [bin.components, bin.trials, pct(bin.trials / trials)]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="components" {...axis} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tooltip} cursor={{ fill: 'rgba(148,163,184,0.08)' }} labelFormatter={(c) => `${String(c)} ${String(c) === '1' ? 'component' : 'components'}`} />
          <Bar dataKey="trials" name="Trials" fill={C.bars} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/** Chart 4: healthy against current, from the analysis with compareHealthy. */
export const CompareChart: React.FC<{ current: Analysis; healthy: Analysis }> = ({ current, healthy }) => {
  const rows: Array<[string, number, number]> = [
    ['Components', healthy.connectivity.componentCount, current.connectivity.componentCount],
    ['Nodes up', healthy.summary.operationalNodeCount, current.summary.operationalNodeCount],
    ['Links up', healthy.summary.operationalEdgeCount, current.summary.operationalEdgeCount],
    ['Bridges', healthy.bridges.edgeIds.length, current.bridges.edgeIds.length],
    ['Cut vertices', healthy.articulationPoints.nodeIds.length, current.articulationPoints.nodeIds.length],
  ]
  return (
    <ChartCard
      title="Connectivity before and after failures"
      testId="chart-compare"
      description={`With no failures the network is ${healthy.connectivity.connected ? 'connected' : 'not connected'} (${healthy.connectivity.reason}); now it is ${
        current.connectivity.connected ? 'connected' : 'not connected'
      } (${current.connectivity.reason}).`}
      table={{ columns: ['Measure', 'Healthy', 'Current'], rows }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows.map(([name, h, c]) => ({ name, healthy: h, current: c }))} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 9, fill: C.axis }} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tooltip} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Legend {...legend} />
          <Bar dataKey="healthy" name="Healthy" fill={C.healthy} isAnimationActive={false} />
          <Bar dataKey="current" name="Current" fill={C.current} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
