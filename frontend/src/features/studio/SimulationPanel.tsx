import React, { useState } from 'react'
import { useGraphStore } from '@/store/graphStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { MAX_SEED, MAX_TRIALS, useSettingsStore, type Settings } from '@/store/settingsStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Activity, Play, TrendingDown, Info, Square } from 'lucide-react'
import { ReliabilitySweepChart } from '@/features/analytics/ReliabilitySweepChart'
import { ApiErrorBox, SourceBadge, StaleNotice } from './ResultStatus'

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`
const field = 'w-full px-2 py-1.5 bg-bg-surface border border-border-strong rounded-[2px] text-text-primary text-xs focus:border-accent-teal focus:outline-none'

/** Number input that commits on blur and shows the store's reason when a value is refused. */
const SettingNumber: React.FC<{
  id: string
  label: string
  value: number | null
  step: string
  placeholder?: string
  toPatch: (value: number | null) => Partial<Settings>
  onError: (error: string | null) => void
}> = ({ id, label, value, step, placeholder, toPatch, onError }) => {
  const update = useSettingsStore((s) => s.update)
  const [text, setText] = useState(value === null ? '' : String(value))
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] text-text-muted mb-1 font-mono">
        {label}
      </label>
      <input
        id={id}
        type="number"
        step={step}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const result = update(toPatch(text.trim() === '' ? null : Number(text)))
          onError(result.ok ? null : result.error)
          if (!result.ok) setText(value === null ? '' : String(value))
        }}
        className={`${field} font-mono`}
      />
    </div>
  )
}

export const SimulationPanel: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const settings = useSettingsStore()
  const simulate = useAnalysisStore((s) => s.simulate)
  const sweep = useAnalysisStore((s) => s.sweep)
  const run = useAnalysisStore((s) => s.run)
  const cancel = useAnalysisStore((s) => s.cancel)
  const [settingError, setSettingError] = useState<string | null>(null)

  const sim = simulate.result
  const isSimulating = simulate.status === 'loading'
  const isSweeping = sweep.status === 'loading'
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id
  const twoTerminal = settings.mode === 'two-terminal'

  return (
    <div className="p-5 space-y-6 text-xs text-text-primary">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-cyan" />
          <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">Failure Simulator</span>
        </div>
        {sim && <SourceBadge isDemo={sim.isDemo} testId="simulation-source" backendLabel="FastAPI Backend" />}
      </div>

      <div className="space-y-4 bg-bg-primary p-4 rounded-[2px] border border-border-subtle">
        <div className="text-[11px] font-mono text-text-muted uppercase">Monte Carlo Configuration</div>

        <div>
          <div className="flex justify-between text-[11px] font-mono mb-1.5">
            <label htmlFor="edge-p" className="text-text-muted">
              Link failure probability (p):
            </label>
            <span className="text-accent-teal font-semibold">{pct(settings.edgeFailureProbability, 0)}</span>
          </div>
          <input
            id="edge-p"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.edgeFailureProbability}
            onChange={(e) => settings.update({ edgeFailureProbability: Number(e.target.value) })}
            className="w-full accent-accent-teal cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-mono mb-1.5">
            <label htmlFor="node-p" className="text-text-muted">
              Node failure probability:
            </label>
            <span className="text-accent-teal font-semibold">{pct(settings.nodeFailureProbability, 0)}</span>
          </div>
          <input
            id="node-p"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.nodeFailureProbability}
            onChange={(e) => settings.update({ nodeFailureProbability: Number(e.target.value) })}
            className="w-full accent-accent-teal cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SettingNumber
            id="trials"
            label={`Trials N (1 to ${MAX_TRIALS}):`}
            value={settings.trials}
            step="1"
            toPatch={(v) => ({ trials: v ?? Number.NaN })}
            onError={setSettingError}
          />
          <SettingNumber
            id="seed"
            label="Seed (optional):"
            value={settings.seed}
            step="1"
            placeholder={`0 to ${MAX_SEED}`}
            toPatch={(seed) => ({ seed })}
            onError={setSettingError}
          />
        </div>

        <div>
          <label htmlFor="mode" className="block text-[10px] text-text-muted mb-1 font-mono">
            Success means:
          </label>
          <select
            id="mode"
            value={settings.mode}
            onChange={(e) => settings.update({ mode: e.target.value === 'two-terminal' ? 'two-terminal' : 'all-terminal' })}
            className={`${field} cursor-pointer`}
          >
            <option value="all-terminal">All surviving nodes connected (all-terminal)</option>
            <option value="two-terminal">Two chosen nodes connected (two-terminal)</option>
          </select>
          {twoTerminal && (
            <div className="grid grid-cols-2 gap-2 mt-2" data-testid="simulation-terminals">
              {(['terminalSource', 'terminalTarget'] as const).map((key) => (
                <div key={key}>
                  <label htmlFor={key} className="block text-[10px] text-text-muted mb-1 font-mono">
                    {key === 'terminalSource' ? 'Terminal s:' : 'Terminal t:'}
                  </label>
                  <select
                    id={key}
                    value={settings[key] ?? ''}
                    onChange={(e) => settings.update({ [key]: e.target.value || null })}
                    className={`${field} cursor-pointer`}
                  >
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

        <div className="pt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
              isLoading={isSimulating}
              disabled={nodes.length === 0}
              onClick={() => void run('simulate')}
            >
              Run Monte Carlo Simulation
            </Button>
            {isSimulating && (
              <Button variant="outline" size="sm" leftIcon={<Square className="w-3 h-3" />} onClick={() => cancel('simulate')}>
                Cancel
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SettingNumber id="sweep-min" label="Sweep p from:" value={settings.sweepPMin} step="0.05" toPatch={(v) => ({ sweepPMin: v ?? Number.NaN })} onError={setSettingError} />
            <SettingNumber id="sweep-max" label="to:" value={settings.sweepPMax} step="0.05" toPatch={(v) => ({ sweepPMax: v ?? Number.NaN })} onError={setSettingError} />
            <SettingNumber id="sweep-points" label="points:" value={settings.sweepPoints} step="1" toPatch={(v) => ({ sweepPoints: v ?? Number.NaN })} onError={setSettingError} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              leftIcon={<TrendingDown className="w-3.5 h-3.5" />}
              isLoading={isSweeping}
              disabled={nodes.length === 0}
              onClick={() => void run('sweep')}
            >
              Run Reliability Sweep
            </Button>
            {isSweeping && (
              <Button variant="outline" size="sm" leftIcon={<Square className="w-3 h-3" />} onClick={() => cancel('sweep')}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle flex items-start gap-2 text-[11px] text-text-secondary leading-relaxed">
        <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-text-primary">Failed elements stay failed:</span> nodes and links you marked failed are
          failed in every trial, and a link whose endpoint fails is unavailable in that trial. A link with its own failure probability
          uses it instead of p.
        </div>
      </div>

      {simulate.error && (
        <ApiErrorBox title="Simulation Execution Error" error={simulate.error} testId="simulation-error" onRetry={() => void run('simulate')} />
      )}

      {sim && simulate.stale && <StaleNotice testId="simulation-stale" onRefresh={() => void run('simulate')} isLoading={isSimulating} />}

      {sim && (
        <div className="p-4 bg-bg-surface-elevated rounded-[2px] border border-border-subtle space-y-3" data-testid="simulation-results">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="text-[11px] font-mono uppercase text-text-muted">Estimated Reliability R&#770;</span>
            <Badge variant="accent" size="md" data-testid="simulation-reliability">
              {pct(sim.estimate)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2 bg-bg-primary rounded-[2px] border border-border-subtle">
              <div className="text-[10px] text-text-muted">Successful Trials:</div>
              <div className="text-sm font-semibold text-text-primary mt-0.5" data-testid="simulation-connected">
                {sim.connectedTrials} / {sim.trials}
              </div>
            </div>
            <div className="p-2 bg-bg-primary rounded-[2px] border border-border-subtle">
              <div className="text-[10px] text-text-muted">Standard Error (SE):</div>
              <div className="text-sm font-semibold text-text-primary mt-0.5" data-testid="simulation-se">
                &plusmn;{pct(sim.standardError, 2)}
              </div>
            </div>
          </div>

          <div className="p-2 bg-bg-primary rounded-[2px] border border-border-subtle font-mono text-[10px] text-text-secondary flex justify-between">
            <span>95% Wilson interval:</span>
            <span className="text-text-primary font-semibold" data-testid="simulation-ci">
              [{pct(sim.wilson95.low)}, {pct(sim.wilson95.high)}]
            </span>
          </div>

          <div className="p-2 bg-bg-primary rounded-[2px] border border-border-subtle font-mono text-[10px] text-text-secondary space-y-1">
            <div className="flex justify-between">
              <span>Average components:</span>
              <span className="text-text-primary" data-testid="simulation-avg-components">
                {sim.averageComponents.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Most critical link:</span>
              <span className="text-text-primary" data-testid="simulation-critical-edge">
                {sim.criticalEdge
                  ? `${sim.criticalEdge.edgeId} (pivotal in ${pct(sim.criticalEdge.share)} of trials)`
                  : 'None (no single link failure decided a trial)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Seed:</span>
              <span className="text-text-primary" data-testid="simulation-seed">
                {sim.seed}
              </span>
            </div>
          </div>

          <ul className="text-[10px] text-text-muted leading-tight list-disc pl-4 space-y-0.5" data-testid="simulation-assumptions">
            {sim.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
            <li>Computed in {sim.elapsedMs} ms.</li>
          </ul>
        </div>
      )}

      {sweep.error && <ApiErrorBox title="Reliability Sweep Error" error={sweep.error} testId="sweep-error" onRetry={() => void run('sweep')} />}

      {sweep.result && sweep.stale && <StaleNotice testId="sweep-stale" onRefresh={() => void run('sweep')} isLoading={isSweeping} />}

      {sweep.result && (
        <div className="pt-2 border-t border-border-subtle">
          <ReliabilitySweepChart result={sweep.result} />
        </div>
      )}
    </div>
  )
}
