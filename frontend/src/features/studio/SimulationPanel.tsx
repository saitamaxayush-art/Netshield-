import React from 'react'
import { useGraphStore } from '@/store/graphStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Activity,
  Play,
  TrendingDown,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { ReliabilitySweepChart } from '@/features/analytics/ReliabilitySweepChart'

export const SimulationPanel: React.FC = () => {
  const {
    simulationConfig,
    setSimulationConfig,
    runSimulation,
    simulationResult,
    isSimulating,
    simulationError,
    runSweep,
    sweepResult,
    isSweeping,
  } = useGraphStore()

  return (
    <div className="p-5 space-y-6 text-xs text-text-primary">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-cyan" />
          <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">
            Failure Simulator
          </span>
        </div>
        {simulationResult && (
          <Badge variant={simulationResult.is_demo ? 'outline' : 'accent'} size="sm">
            {simulationResult.is_demo ? 'Demo Adapter' : 'FastAPI Backend'}
          </Badge>
        )}
      </div>

      {/* Simulator Parameters */}
      <div className="space-y-4 bg-bg-primary p-4 rounded-[2px] border border-border-subtle">
        <div className="text-[11px] font-mono text-text-muted uppercase">
          Monte Carlo Configuration
        </div>

        {/* Failure Probability Slider */}
        <div>
          <div className="flex justify-between text-[11px] font-mono mb-1.5">
            <span className="text-text-muted">Component Failure Rate (p):</span>
            <span className="text-accent-teal font-semibold">
              {(simulationConfig.failureProb * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={simulationConfig.failureProb}
            onChange={(e) =>
              setSimulationConfig({ failureProb: parseFloat(e.target.value) })
            }
            className="w-full accent-accent-teal cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-text-muted mt-1">
            <span>0% (Resilient)</span>
            <span>50%</span>
            <span>100% (Severed)</span>
          </div>
        </div>

        {/* Trial Count Selector */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-text-muted mb-1 font-mono">
              Trial Iterations (N):
            </label>
            <select
              value={simulationConfig.trials}
              onChange={(e) =>
                setSimulationConfig({ trials: parseInt(e.target.value, 10) })
              }
              className="w-full px-2 py-1.5 bg-bg-surface border border-border-strong rounded-[2px] text-text-primary text-xs focus:border-accent-teal focus:outline-none cursor-pointer"
            >
              <option value="100">100 trials (Fast)</option>
              <option value="500">500 trials (Standard)</option>
              <option value="1000">1,000 trials (High accuracy)</option>
              <option value="2000">2,000 trials (Precise)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-text-muted mb-1 font-mono">
              Failure Target:
            </label>
            <select
              value={simulationConfig.failTarget}
              onChange={(e) =>
                setSimulationConfig({
                  failTarget: e.target.value as 'nodes' | 'edges' | 'both',
                })
              }
              className="w-full px-2 py-1.5 bg-bg-surface border border-border-strong rounded-[2px] text-text-primary text-xs focus:border-accent-teal focus:outline-none cursor-pointer"
            >
              <option value="edges">Links Only (Edges)</option>
              <option value="nodes">Nodes Only (Vertices)</option>
              <option value="both">Both Links and Nodes</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-2">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            isLoading={isSimulating}
            onClick={runSimulation}
          >
            Run Monte Carlo Simulation
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            leftIcon={<TrendingDown className="w-3.5 h-3.5" />}
            isLoading={isSweeping}
            onClick={runSweep}
          >
            Run Reliability Sweep (0% &rarr; 75%)
          </Button>
        </div>
      </div>

      {/* Incident Edge Semantics Note */}
      <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle flex items-start gap-2 text-[11px] text-text-secondary leading-relaxed">
        <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-text-primary">Incident Edge Semantic:</span>{' '}
          When a node fails, all its incident connections are treated as unavailable for graph
          connectivity, while each connection preserves its stored state upon node restoration.
        </div>
      </div>

      {/* Error Display */}
      {simulationError && (
        <div className="p-3 bg-state-failure-dim border border-state-failure/40 rounded-[2px] text-state-failure">
          <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Simulation Execution Error</span>
          </div>
          <p className="text-[11px]">{simulationError}</p>
        </div>
      )}

      {/* Single Simulation Results */}
      {simulationResult && (
        <div className="p-4 bg-bg-surface-elevated rounded-[2px] border border-border-subtle space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="text-[11px] font-mono uppercase text-text-muted">
              Estimated Reliability R&#770;
            </span>
            <Badge variant="accent" size="md">
              {(simulationResult.estimated_reliability * 100).toFixed(1)}%
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2 bg-bg-primary rounded-[2px] border border-border-subtle">
              <div className="text-[10px] text-text-muted">Connected Trials:</div>
              <div className="text-sm font-semibold text-text-primary mt-0.5">
                {simulationResult.connected_trials} / {simulationResult.trials}
              </div>
            </div>

            <div className="p-2 bg-bg-primary rounded-[2px] border border-border-subtle">
              <div className="text-[10px] text-text-muted">Standard Error (SE):</div>
              <div className="text-sm font-semibold text-text-primary mt-0.5">
                &plusmn;{(simulationResult.standard_error * 100).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="p-2 bg-bg-primary rounded-[2px] border border-border-subtle font-mono text-[10px] text-text-secondary flex justify-between">
            <span>95% Confidence Interval:</span>
            <span className="text-text-primary font-semibold">
              [{(simulationResult.confidence_interval_95[0] * 100).toFixed(1)}%,{' '}
              {(simulationResult.confidence_interval_95[1] * 100).toFixed(1)}%]
            </span>
          </div>

          <div className="text-[10px] text-text-muted leading-tight pt-1">
            Assumptions: Independent Bernoulli trials per element at rate p ={' '}
            {simulationResult.failure_probability}, evaluated over {simulationResult.trials} sample
            states in {simulationResult.execution_time_ms}ms.
          </div>
        </div>
      )}

      {/* Sweep Chart Result */}
      {sweepResult && (
        <div className="pt-2 border-t border-border-subtle">
          <ReliabilitySweepChart points={sweepResult.points} isDemo={sweepResult.is_demo} />
        </div>
      )}
    </div>
  )
}
