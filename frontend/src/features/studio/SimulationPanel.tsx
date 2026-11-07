import React, { useEffect, useState } from 'react'
import { useGraphStore } from '@/store/graphStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { DEFAULT_SETTINGS, MAX_SEED, MAX_SWEEP_POINTS, useSettingsStore, type Settings } from '@/store/settingsStore'
import { BATCH_TRIALS } from '@/store/simulationRuns'
import { Button } from '@/components/ui/Button'
import { Activity, Play, TrendingDown, Info, Square, Shuffle, RotateCcw, Download } from 'lucide-react'
import { CompareChart, HistogramChart, SweepChart, TrialsChart } from '@/features/analytics/charts'
import { ApiErrorBox, SourceBadge, StaleNotice } from './ResultStatus'
import { Explain, KeyValues, VALUE } from './analysis/sections'
import { download, toCsv, toJson } from './simulationExport'
import { nodeNames } from './nodeNames'
import { clampInput } from './clamp'

const TRIAL_OPTIONS = [100, 500, 1000, 5000, 20000] as const
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`
const field = 'w-full px-2 py-1.5 bg-bg-surface border border-border-strong rounded-[2px] text-text-primary text-xs focus:border-accent-teal focus:outline-none'
const heading = 'text-[11px] font-mono text-text-secondary uppercase tracking-wider'

/** Text input for a number; commits on blur or Enter, shows the store's reason when refused. Keyed by value so it follows the store. */
const NumberField: React.FC<{
  id: string
  label: string
  value: number | null
  step: string
  placeholder?: string
  toPatch: (value: number | null) => Partial<Settings>
  onError: (error: string | null) => void
  /** Allowed range: out of range values are clamped (with a note), not refused. */
  range?: { min: number; max: number; integer?: boolean }
  /** Label for assistive technology when the visible label lives elsewhere. */
  ariaLabel?: string
}> = ({ id, label, value, step, placeholder, toPatch, onError, range, ariaLabel }) => {
  const update = useSettingsStore((s) => s.update)
  const commit = (text: string) => {
    const typed = text.trim() === '' ? null : Number(text)
    const clamped = typed !== null && range ? clampInput(typed, range.min, range.max, range.integer) : { value: typed, note: null }
    const result = update(toPatch(clamped.value))
    onError(result.ok ? clamped.note : result.error)
    return result.ok
  }
  return (
    <div>
      <label htmlFor={id} className={ariaLabel ? 'sr-only' : 'block text-[11px] text-text-muted mb-1 font-mono'}>
        {ariaLabel ?? label}
      </label>
      <input
        key={String(value)}
        id={id}
        type="number"
        step={step}
        min={range?.min}
        max={range?.max}
        defaultValue={value === null ? '' : String(value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        onBlur={(e) => {
          if (!commit(e.currentTarget.value)) e.currentTarget.value = value === null ? '' : String(value)
        }}
        className={`${field} font-mono`}
      />
    </div>
  )
}

/** Slider plus validated number input for a probability in [0, 1]. */
const ProbabilityField: React.FC<{ id: string; label: string; value: number; patch: (v: number) => Partial<Settings>; onError: (e: string | null) => void }> = ({
  id,
  label,
  value,
  patch,
  onError,
}) => {
  const update = useSettingsStore((s) => s.update)
  return (
    <div>
      <div className="flex justify-between items-end gap-3 text-[11px] font-mono mb-1">
        <label htmlFor={id} className="text-text-muted">
          {label}
        </label>
        <div className="w-24">
          <NumberField id={`${id}-value`} label="" ariaLabel={`${label.replace(/:$/, '')}, exact value`} value={value} step="0.01" range={{ min: 0, max: 1 }} toPatch={(v) => patch(v ?? Number.NaN)} onError={onError} />
        </div>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        aria-valuetext={pct(value, 0)}
        onChange={(e) => onError(update(patch(Number(e.target.value))).ok ? null : 'Invalid value')}
        className="w-full accent-accent-teal cursor-pointer"
      />
    </div>
  )
}

function useElapsed(startedAt: number | null, running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [running])
  return running && startedAt !== null ? Math.max(0, now - startedAt) : 0
}

const RunProgress: React.FC<{ startedAt: number | null; progress: { done: number; total: number } | null }> = ({ startedAt, progress }) => {
  const elapsed = useElapsed(startedAt, true)
  const batched = progress !== null && progress.total > BATCH_TRIALS
  const share = batched ? progress.done / progress.total : null
  return (
    <div className="space-y-1.5" data-testid="simulation-progress" data-batched={batched}>
      <div
        role="progressbar"
        aria-label="Simulation progress"
        aria-valuemin={0}
        aria-valuemax={batched ? progress.total : undefined}
        aria-valuenow={batched ? progress.done : undefined}
        aria-valuetext={batched ? `${progress.done} of ${progress.total} trials` : 'Running'}
        className="h-1.5 bg-bg-surface-active rounded-[1px] overflow-hidden"
      >
        {share !== null ? (
          <div className="h-full bg-accent-teal transition-[width] duration-200" style={{ width: `${share * 100}%` }} />
        ) : (
          <div className="h-full w-1/3 bg-accent-teal ns-indeterminate" />
        )}
      </div>
      <p className="text-[11px] font-mono text-text-muted" data-testid="simulation-progress-text">
        {batched ? `${progress.done} of ${progress.total} trials` : 'Running on the backend'}, {(elapsed / 1000).toFixed(1)} s
      </p>
    </div>
  )
}

export const SimulationPanel: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const settings = useSettingsStore()
  const simulate = useAnalysisStore((s) => s.simulate)
  const sweep = useAnalysisStore((s) => s.sweep)
  const analyze = useAnalysisStore((s) => s.analyze)
  const { run, cancel, clear } = useAnalysisStore.getState()
  const [settingError, setSettingError] = useState<string | null>(null)

  const result = simulate.result
  const c = result?.combined
  const first = result?.batches[0]
  const isSimulating = simulate.status === 'loading'
  const isSweeping = sweep.status === 'loading'
  const names = nodeNames(nodes)
  const labelOf = (id: string) => names.get(id) ?? id
  const twoTerminal = settings.mode === 'two-terminal'
  const trialOptions = TRIAL_OPTIONS.some((t) => t === settings.trials) ? TRIAL_OPTIONS : [...TRIAL_OPTIONS, settings.trials].sort((a, b) => a - b)
  const freshAnalysis = analyze.result && !analyze.stale ? analyze.result : null

  const reset = () => {
    clear('simulate')
    clear('sweep')
    const d = DEFAULT_SETTINGS
    settings.update({
      edgeFailureProbability: d.edgeFailureProbability,
      nodeFailureProbability: d.nodeFailureProbability,
      trials: d.trials,
      seed: d.seed,
      mode: d.mode,
      sweepPMin: d.sweepPMin,
      sweepPMax: d.sweepPMax,
      sweepPoints: d.sweepPoints,
    })
    setSettingError(null)
  }
  const randomise = () => {
    const value = new Uint32Array(1)
    crypto.getRandomValues(value)
    settings.update({ seed: value[0] % (MAX_SEED + 1) })
  }
  const exportAs = (kind: 'csv' | 'json') => {
    const input = { run: result, sweep: sweep.result, exportedAt: new Date().toISOString() }
    const stamp = input.exportedAt.slice(0, 19).replace(/[:T]/g, '-')
    if (kind === 'csv') download(`netshield-simulation-${stamp}.csv`, toCsv(input), 'text/csv')
    else download(`netshield-simulation-${stamp}.json`, toJson(input), 'application/json')
  }
  const timeoutHint = 'The run took too long. Try fewer trials or a smaller network. Runs above 5000 trials are sent as batches of 5000.'

  return (
    <div className="p-5 space-y-5 text-xs text-text-primary">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-cyan" />
          <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">Failure Simulator</span>
        </div>
        {result && <SourceBadge isDemo={result.isDemo} testId="simulation-source" backendLabel="FastAPI Backend" />}
      </div>

      <div className="space-y-4 bg-bg-primary p-4 rounded-[2px] border border-border-subtle" data-tour="simulation">
        <div className={heading}>Monte Carlo configuration</div>
        <ProbabilityField id="edge-p" label="Link failure probability (p):" value={settings.edgeFailureProbability} patch={(v) => ({ edgeFailureProbability: v })} onError={setSettingError} />
        <ProbabilityField id="node-p" label="Node failure probability:" value={settings.nodeFailureProbability} patch={(v) => ({ nodeFailureProbability: v })} onError={setSettingError} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="trials" className="block text-[11px] text-text-muted mb-1 font-mono">
              Trials:
            </label>
            <select id="trials" value={settings.trials} onChange={(e) => settings.update({ trials: Number(e.target.value) })} className={`${field} cursor-pointer`}>
              {trialOptions.map((t) => (
                <option key={t} value={t}>
                  {t.toLocaleString('en-US')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <NumberField id="seed" label="Seed (optional):" value={settings.seed} step="1" placeholder="backend picks" range={{ min: 0, max: MAX_SEED, integer: true }} toPatch={(seed) => ({ seed })} onError={setSettingError} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" leftIcon={<Shuffle className="w-3.5 h-3.5" />} onClick={randomise}>
            Randomise seed
          </Button>
        </div>
        {settings.trials > BATCH_TRIALS && (
          <p role="note" data-testid="trials-warning" className="text-[11px] text-state-warning">
            {settings.trials.toLocaleString('en-US')} trials take longer. They are sent as {Math.ceil(settings.trials / BATCH_TRIALS)} batches of up to {BATCH_TRIALS}, with seeds derived from the run seed.
          </p>
        )}

        <div>
          <label htmlFor="mode" className="block text-[11px] text-text-muted mb-1 font-mono">
            Success means:
          </label>
          <select id="mode" value={settings.mode} onChange={(e) => settings.update({ mode: e.target.value === 'two-terminal' ? 'two-terminal' : 'all-terminal' })} className={`${field} cursor-pointer`}>
            <option value="all-terminal">All surviving nodes connected (all-terminal)</option>
            <option value="two-terminal">Two chosen nodes connected (two-terminal)</option>
          </select>
          {twoTerminal && (
            <div className="grid grid-cols-2 gap-2 mt-2" data-testid="simulation-terminals">
              {(['terminalSource', 'terminalTarget'] as const).map((key) => (
                <div key={key}>
                  <label htmlFor={key} className="block text-[11px] text-text-muted mb-1 font-mono">
                    {key === 'terminalSource' ? 'Source s:' : 'Target t:'}
                  </label>
                  <select id={key} value={settings[key] ?? ''} onChange={(e) => settings.update({ [key]: e.target.value || null })} className={`${field} cursor-pointer`}>
                    <option value="">(Select node)</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {labelOf(n.id)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {settingError && (
          <p role="alert" data-testid="setting-error" className="text-[11px] text-state-failure">
            {settingError}
          </p>
        )}

        <div className="pt-1 space-y-2">
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" leftIcon={<Play className="w-3.5 h-3.5 fill-current" />} isLoading={isSimulating} disabled={nodes.length === 0} onClick={() => void run('simulate')}>
              Run Monte Carlo Simulation
            </Button>
            {isSimulating && (
              <Button variant="outline" size="sm" leftIcon={<Square className="w-3 h-3" />} onClick={() => cancel('simulate')}>
                Cancel
              </Button>
            )}
          </div>
          {isSimulating && <RunProgress startedAt={simulate.startedAt} progress={simulate.progress} />}
          <Button variant="ghost" size="sm" className="w-full" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} disabled={isSimulating || isSweeping} onClick={reset}>
            Reset simulation
          </Button>
        </div>
      </div>

      <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle flex items-start gap-2 text-[11px] text-text-secondary leading-relaxed">
        <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-text-primary">Failed elements stay failed:</span> nodes and links you marked failed are failed in every trial, and a link whose
          endpoint fails is unavailable in that trial. A link with its own failure probability uses it instead of p.
        </div>
      </div>

      {simulate.error && (
        <ApiErrorBox
          title="Simulation Execution Error"
          error={simulate.error}
          testId="simulation-error"
          onRetry={() => void run('simulate')}
          hint={simulate.error.isTimeout || simulate.error.code === 'TIMEOUT' ? timeoutHint : undefined}
        />
      )}
      {simulate.cancelled && !isSimulating && (
        <p role="status" data-testid="simulation-cancelled" className="text-[11px] font-mono text-text-secondary">
          Run cancelled. {result ? 'The previous result is still shown.' : 'No result.'}
        </p>
      )}
      {result && simulate.stale && <StaleNotice testId="simulation-stale" onRefresh={() => void run('simulate')} isLoading={isSimulating} />}

      {result && c && first && (
        <div className="p-4 bg-bg-surface-elevated rounded-[2px] border border-border-subtle space-y-3" data-testid="simulation-results">
          {/* The estimate first and largest; related numbers grouped below it, values aligned right. */}
          <div className="pb-3 border-b border-border-subtle">
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">Estimate: reliability R&#770;</div>
            <div className={`text-3xl leading-tight mt-1 ${VALUE}`} data-testid="simulation-reliability">
              {pct(c.estimate)}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              95% Wilson interval{' '}
              <span className={VALUE} data-testid="simulation-ci">
                [{pct(c.wilson95.low)}, {pct(c.wilson95.high)}]
              </span>
            </div>
          </div>
          {result.isBatched && (
            <p className="text-xs text-state-warning leading-relaxed" data-testid="simulation-combined">
              Combined from {result.batches.length} backend requests: counts are summed; the interval and standard error are computed in the browser from those counts.
            </p>
          )}
          <div className="space-y-1.5">
            <div className={heading}>Trials</div>
            <KeyValues
              rows={[
                ['Successful / total', <span data-testid="simulation-connected">{c.connectedTrials} / {c.trials}</span>],
                ['Standard error (SE)', <span data-testid="simulation-se">&plusmn;{pct(c.standardError, 2)}</span>],
                ['Average components', <span data-testid="simulation-avg-components">{c.averageComponents.toFixed(3)}</span>],
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <div className={heading}>Run</div>
            <KeyValues
              rows={[
                [
                  'Seed used',
                  <span className="break-words" data-testid="simulation-seed">
                    {result.seed}
                    {result.isBatched ? ` (batches: ${result.batches.map((b) => b.seed).join(', ')})` : ''}
                  </span>,
                ],
                [
                  'Most critical link',
                  <span className="break-words" data-testid="simulation-critical-edge">
                    {result.isBatched
                      ? `per batch: ${result.batches.map((b) => b.criticalEdge?.edgeId ?? 'none').join(', ')}`
                      : first.criticalEdge
                        ? `${first.criticalEdge.edgeId} (pivotal in ${pct(first.criticalEdge.share)} of trials)`
                        : 'None (no single link failure decided a trial)'}
                  </span>,
                ],
              ]}
            />
          </div>
          <Explain k={first.explanationKey} />
          {first.criticalEdge && <Explain k={first.criticalEdge.explanationKey} />}
          <div>
            <div className={`${heading} mb-1`}>Assumptions (from the {result.isDemo ? 'demo adapter' : 'backend'})</div>
            {result.isBatched && (
              <p className="text-xs text-text-secondary mb-1" data-testid="simulation-assumptions-batched">
                As reported for batch 1. Every batch used the same model; batch sizes and seeds are listed above and in the export.
              </p>
            )}
            <ul className="text-xs text-text-secondary leading-relaxed list-disc pl-4 space-y-1" data-testid="simulation-assumptions">
              {first.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              <li>Computed in {result.batches.reduce((sum, b) => sum + b.elapsedMs, 0).toFixed(1)} ms of backend time.</li>
            </ul>
          </div>
          <TrialsChart run={result} />
          <HistogramChart run={result} />
        </div>
      )}

      <div className="space-y-3 bg-bg-primary p-4 rounded-[2px] border border-border-subtle">
        <div className={heading}>Reliability sweep</div>
        <div className="grid grid-cols-3 gap-2">
          <NumberField id="sweep-min" label="p from:" value={settings.sweepPMin} step="0.05" range={{ min: 0, max: 1 }} toPatch={(v) => ({ sweepPMin: v ?? Number.NaN })} onError={setSettingError} />
          <NumberField id="sweep-max" label="to:" value={settings.sweepPMax} step="0.05" range={{ min: 0, max: 1 }} toPatch={(v) => ({ sweepPMax: v ?? Number.NaN })} onError={setSettingError} />
          <NumberField id="sweep-points" label="points:" value={settings.sweepPoints} step="1" range={{ min: 1, max: MAX_SWEEP_POINTS, integer: true }} toPatch={(v) => ({ sweepPoints: v ?? Number.NaN })} onError={setSettingError} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" leftIcon={<TrendingDown className="w-3.5 h-3.5" />} isLoading={isSweeping} disabled={nodes.length === 0} onClick={() => void run('sweep')}>
            Run Reliability Sweep
          </Button>
          {isSweeping && (
            <Button variant="outline" size="sm" leftIcon={<Square className="w-3 h-3" />} onClick={() => cancel('sweep')}>
              Cancel
            </Button>
          )}
        </div>
        {isSweeping && <RunProgress startedAt={sweep.startedAt} progress={null} />}
      </div>

      {sweep.error && (
        <ApiErrorBox title="Reliability Sweep Error" error={sweep.error} testId="sweep-error" onRetry={() => void run('sweep')} hint={sweep.error.isTimeout || sweep.error.code === 'TIMEOUT' ? timeoutHint : undefined} />
      )}
      {sweep.result && sweep.stale && <StaleNotice testId="sweep-stale" onRefresh={() => void run('sweep')} isLoading={isSweeping} />}
      {sweep.result && (
        <div className="space-y-2">
          <SweepChart result={sweep.result} />
          <Explain k={sweep.result.explanationKey} />
        </div>
      )}

      {freshAnalysis?.healthy && <CompareChart current={freshAnalysis.current} healthy={freshAnalysis.healthy} />}

      {(result || sweep.result) && (
        <div className="grid grid-cols-2 gap-2" data-testid="simulation-export">
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={() => exportAs('csv')}>
            Download CSV
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={() => exportAs('json')}>
            Download JSON
          </Button>
        </div>
      )}
    </div>
  )
}
