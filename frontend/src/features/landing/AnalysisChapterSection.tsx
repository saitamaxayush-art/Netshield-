import React, { useState } from 'react'
import { PanelWipe } from '@/components/editorial/PanelWipe'
import { SegmentProgress } from '@/components/editorial/SegmentProgress'
import { ScriptCaps } from '@/components/editorial/ScriptCaps'
import { TarjanBridgesVisual } from './EditorialGraphVisuals'
import { ArrowLeft, ArrowRight } from 'lucide-react'

/**
 * AnalysisChapterSection:
 * Section 13 of luxury reference choreography (NetShield adaptation of map chapter).
 * Dark analysis visual with labelled markers, paginated text block on right, and a 4-segment progress bar.
 */
export const AnalysisChapterSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(1)

  const steps = [
    {
      num: '01',
      title: 'Graph Adjacency Matrix',
      badge: 'Input Phase',
      statement: 'Active components are transformed into an undirected symmetric adjacency matrix.',
      details:
        'Nodes and active edges are ingested into memory. Vertices maintain label attributes, and edges verify that neither incident vertex has suffered an active outage.',
    },
    {
      num: '02',
      title: 'Independent Component Failure',
      badge: 'Stochastic Phase',
      statement: 'Bernoulli random trials simulate simultaneous hardware degradation.',
      details:
        'Each vertex or edge fails with probability p. Failure events are assumed identically and independently distributed (i.i.d.) for baseline discrete mathematics evaluation.',
    },
    {
      num: '03',
      title: 'Monte Carlo Iterations',
      badge: 'Simulation Phase',
      statement: 'Repeated pseudo-random trials test connectivity at high scale.',
      details:
        'The simulation executes N trials (typically 100 to 1,000 iterations). Each iteration calculates connected components using Breadth-First Search to verify if a single connected component spans the graph.',
    },
    {
      num: '04',
      title: 'Statistical Reliability Metric',
      badge: 'Output Phase',
      statement: 'The estimated reliability R is the fraction of trials remaining connected.',
      details:
        'R_est = Connected Runs / Total Trials. Confidence intervals (95%) and standard error are computed through normal approximation to guarantee mathematical rigor.',
    },
  ]

  const current = steps[activeStep - 1]

  return (
    <PanelWipe id="analysis" theme="dark" className="py-28 sm:py-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 space-y-12">
        <ScriptCaps
          script="Empirical Simulation Framework"
          caps="RELIABILITY ANALYSIS CHAPTER"
          tag="h2"
          scriptClassName="text-accent-teal/90 text-xl sm:text-3xl"
          capsClassName="headline-chapter text-white"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Dark Analysis Visual with Labelled Markers */}
          <div className="lg:col-span-7 bg-[#121520] border border-white/10 rounded-[3px] p-6 sm:p-8 relative overflow-hidden shadow-2xl min-h-[360px] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 text-xs font-mono">
              <span className="text-white/60 uppercase">Telemetry Marker Analysis</span>
              <span className="text-accent-teal">N = 1,000 Sample Trials</span>
            </div>

            <div className="flex-1 flex items-center justify-center py-6">
              <TarjanBridgesVisual />
            </div>

            {/* Bottom Labelled Markers */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5 text-[10px] font-mono text-white/50 text-center">
              <div className="p-1.5 bg-white/5 rounded-[2px]">
                <span className="text-state-coral block font-semibold">Cut Vertices</span>
                <span>Critical Hubs</span>
              </div>
              <div className="p-1.5 bg-white/5 rounded-[2px]">
                <span className="text-accent-teal block font-semibold">Connected</span>
                <span>k = 1 Single Partition</span>
              </div>
              <div className="p-1.5 bg-white/5 rounded-[2px]">
                <span className="text-accent-cyan block font-semibold">Reliability R</span>
                <span>95% Confidence</span>
              </div>
            </div>
          </div>

          {/* Right: Paginated Text Block with 4-Segment Progress Bar */}
          <div className="lg:col-span-5 bg-[#121520]/80 border border-white/10 rounded-[3px] p-6 sm:p-8 space-y-6 flex flex-col justify-between h-full min-h-[360px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-accent-teal font-semibold">
                  Phase {current.num} &bull; {current.badge}
                </span>
                <span className="text-xs font-mono text-white/40">
                  {activeStep} of {steps.length}
                </span>
              </div>

              <h3 className="headline-sub text-white">{current.title}</h3>

              <p className="text-xs sm:text-sm font-serif text-white/90 leading-relaxed">
                {current.statement}
              </p>

              <p className="text-xs text-text-secondary leading-relaxed">
                {current.details}
              </p>
            </div>

            {/* Segmented Progress Controls */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <SegmentProgress
                totalSegments={steps.length}
                activeSegment={activeStep}
                onSelectSegment={(idx) => setActiveStep(idx)}
              />

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
                  disabled={activeStep === 1}
                  className="flex items-center gap-1.5 text-xs font-mono uppercase text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep((s) => Math.min(steps.length, s + 1))}
                  disabled={activeStep === steps.length}
                  className="flex items-center gap-1.5 text-xs font-mono uppercase text-accent-teal hover:text-accent-teal-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Next Phase</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PanelWipe>
  )
}
