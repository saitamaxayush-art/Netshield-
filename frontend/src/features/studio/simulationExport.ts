/**
 * Client generated downloads of results already received. They carry the request, every seed and the
 * backend's assumptions, so a run can be repeated exactly.
 */
import type { SweepResponseBody } from '@/services/api/schemas'
import type { SimulationRun } from '@/store/simulationRuns'

export interface ExportInput {
  run: (SimulationRun & { isDemo: boolean }) | null
  sweep: (SweepResponseBody & { isDemo: boolean }) | null
  exportedAt: string
}

export function toJson({ run, sweep, exportedAt }: ExportInput): string {
  return JSON.stringify(
    {
      format: 'netshield-simulation-export',
      version: 1,
      exportedAt,
      simulation: run && {
        source: run.isDemo ? 'demo adapter' : 'backend',
        request: run.request,
        runSeed: run.seed,
        batchSeeds: run.batches.map((b) => b.seed),
        combinedFromBatches: run.isBatched,
        result: run.combined,
        batches: run.batches,
      },
      sweep: sweep && { source: sweep.isDemo ? 'demo adapter' : 'backend', result: sweep },
    },
    null,
    2
  )
}

const csvCell = (v: string | number | boolean | null) => {
  const text = v === null ? '' : String(v)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const csvRows = (rows: Array<Array<string | number | boolean | null>>) => rows.map((r) => r.map(csvCell).join(',')).join('\n')

export function toCsv({ run, sweep, exportedAt }: ExportInput): string {
  const parts: string[] = [csvRows([['netshield simulation export'], ['exported at', exportedAt]])]
  if (run) {
    const c = run.combined
    parts.push(
      csvRows([
        ['simulation'],
        ['source', run.isDemo ? 'demo adapter' : 'backend'],
        ['mode', run.request.mode ?? 'all-terminal'],
        ['source node', run.request.source ?? null],
        ['target node', run.request.target ?? null],
        ['edge failure probability', run.request.edgeFailureProbability],
        ['node failure probability', run.request.nodeFailureProbability ?? 0],
        ['trials', c.trials],
        ['successful trials', c.connectedTrials],
        ['estimate', c.estimate],
        ['standard error', c.standardError],
        ['wilson 95 low', c.wilson95.low],
        ['wilson 95 high', c.wilson95.high],
        ['average components', c.averageComponents],
        ['run seed', run.seed],
        ['combined from batches', run.isBatched],
      ]),
      csvRows([['batch', 'seed', 'trials', 'successful trials', 'estimate', 'critical edge'], ...run.batches.map((b, i) => [i + 1, b.seed, b.trials, b.connectedTrials, b.estimate, b.criticalEdge?.edgeId ?? null])]),
      csvRows([['components', 'trials'], ...c.componentHistogram.map((bin) => [bin.components, bin.trials])]),
      csvRows([['assumption'], ...(run.batches[0]?.assumptions ?? []).map((a) => [a])])
    )
  }
  if (sweep) {
    parts.push(
      csvRows([['sweep'], ['source', sweep.isDemo ? 'demo adapter' : 'backend'], ['seed', sweep.seed], ['trials per point', sweep.trialsPerPoint], ['node failure probability', sweep.nodeFailureProbability]]),
      csvRows([['p', 'estimate', 'successful trials', 'standard error', 'wilson 95 low', 'wilson 95 high'], ...sweep.points.map((p) => [p.p, p.estimate, p.connectedTrials, p.standardError, p.wilson95.low, p.wilson95.high])]),
      csvRows([['assumption'], ...sweep.assumptions.map((a) => [a])])
    )
  }
  return parts.join('\n\n') + '\n'
}

export function download(filename: string, text: string, type: string): void {
  downloadBlob(filename, new Blob([text], { type }))
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
