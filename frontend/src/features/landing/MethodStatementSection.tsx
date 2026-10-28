import React, { useState } from 'react'
import { PanelWipe } from '@/components/editorial/PanelWipe'
import { Container } from '@/components/layout/Container'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

interface MethodPage {
  step: number
  title: string
  subtitle: string
  formula: string
  explanation: string
  sampleMetricLabel: string
  sampleMetricValue: string
  metricDetail: string
}

/**
 * MethodStatementSection:
 * Section 7 of precision layout pass.
 * Moonlit Silver theme (#F3F5F7 background, #FFFFFF cards, #17181B text, #5A626C muted).
 * Plain, honest explanation of how reliability is estimated:
 * (graph, independent failures, Monte Carlo trials, estimate and uncertainty).
 * Paginated 1 to 3 with segment progress in Signal Red (#E5484D).
 * Numbers clearly labelled as illustrative examples computed from the example graph.
 */
export const MethodStatementSection: React.FC = () => {
  const [activePage, setActivePage] = useState<number>(1)

  const pages: MethodPage[] = [
    {
      step: 1,
      title: 'Graph & Independent Failure Model',
      subtitle: 'Bernoulli state decomposition over vertex and edge sets',
      formula: 'Pr(e_i \\text{ operational}) = p_e, \\quad Pr(v_j \\text{ operational}) = p_v',
      explanation:
        'A network is formalized as an undirected graph G = (V, E). Each component is treated as an independent stochastic variable that remains functional with probability p. Failures are uncoupled, providing a foundational baseline for structural stress testing.',
      sampleMetricLabel: 'Example Topology Baseline',
      sampleMetricValue: '|V| = 7, |E| = 9',
      metricDetail: 'Computed on default research graph with uniform operational p = 0.90.',
    },
    {
      step: 2,
      title: 'Monte Carlo State Sampling',
      subtitle: 'Iterative pseudo-random topological state generation',
      formula: 'G^{(k)} \\sim \\text{Bernoulli}(p), \\quad k = 1, 2, \\dots, N',
      explanation:
        'Because exact combinatorial reliability computation is NP-hard for arbitrary network graphs, NetShield generates N repeated state trials. For each trial, active edges and vertices are sampled and passed to a linear-time Tarjan DFS engine to verify overall component reachability.',
      sampleMetricLabel: 'Simulation Sample Size',
      sampleMetricValue: 'N = 10,000 trials',
      metricDetail: 'Example trial batch executing pseudo-random deterministic seeding.',
    },
    {
      step: 3,
      title: 'Reliability Estimate & Uncertainty Bound',
      subtitle: 'Unbiased point estimation with normal confidence bounds',
      formula: '\\hat{R} = \\frac{1}{N} \\sum_{k=1}^N \\mathbb{I}(G^{(k)} \\text{ is connected}) \\pm 1.96 \\sqrt{\\frac{\\hat{R}(1-\\hat{R})}{N}}',
      explanation:
        'The estimated overall network reliability is the proportion of trials where the network remained connected. Normal approximation bounds quantify statistical margin of error at a 95% confidence level, clearly distinguishing simulation variance from structural vulnerability.',
      sampleMetricLabel: 'Illustrative Example Result',
      sampleMetricValue: 'R̂ ≈ 0.814 ± 0.007',
      metricDetail: 'Example computed from example graph using exact app algorithm.',
    },
  ]

  const currentPage = pages[activePage - 1]

  return (
    <PanelWipe id="methodology" theme="light" className="py-24 sm:py-32 bg-[#F3F5F7] text-[#17181B] select-none">
      <Container size="wide" className="space-y-12">
        {/* Section Header */}
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#5A626C]">
              Formal Methodology
            </span>
          </div>

          <h2 className="headline-chapter text-[#17181B]">
            How Reliability is Estimated
          </h2>

          <p className="text-sm sm:text-base text-[#5A626C] leading-relaxed max-w-2xl text-pretty">
            A plain, mathematically honest disclosure of algorithms, simulation bounds, and statistical
            uncertainty estimation implemented in NetShield.
          </p>
        </div>

        {/* 3-Segment Progress Bar in Signal Red */}
        <div className="w-full max-w-md flex items-center gap-2" aria-label="Methodology step progress">
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                stepNum <= activePage ? 'bg-[#E5484D]' : 'bg-[#2A2C31]/15'
              }`}
            />
          ))}
        </div>

        {/* Main Content Box: Paginated 1 to 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Step Card Details (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-[#2A2C31]/15 rounded-[3px] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-[#17181B]/10">
              <span className="text-xs font-mono uppercase tracking-wider text-[#E5484D] font-semibold">
                Phase 0{currentPage.step} of 03
              </span>
              <span className="text-[11px] font-mono text-[#5A626C]">
                {currentPage.subtitle}
              </span>
            </div>

            <div className="space-y-3">
              <h3 className="headline-sub text-[#17181B]">
                {currentPage.title}
              </h3>

              {/* Mathematical Formula Display */}
              <div className="p-3.5 bg-[#F3F5F7] border border-[#2A2C31]/10 rounded-[2px] font-mono text-xs sm:text-sm text-[#17181B] overflow-x-auto">
                <code>{currentPage.formula}</code>
              </div>

              <p className="text-xs sm:text-sm text-[#5A626C] leading-relaxed pt-2 text-pretty">
                {currentPage.explanation}
              </p>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-6 border-t border-[#17181B]/10 text-xs font-mono">
              <button
                type="button"
                disabled={activePage <= 1}
                onClick={() => setActivePage((prev) => Math.max(1, prev - 1))}
                className="h-10 px-4 border border-[#2A2C31]/20 rounded-[2px] text-[#5A626C] hover:text-[#17181B] hover:border-[#17181B] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>

              <button
                type="button"
                disabled={activePage >= 3}
                onClick={() => setActivePage((prev) => Math.min(3, prev + 1))}
                className="h-10 px-4 bg-[#E5484D] hover:bg-[#F0666A] active:bg-[#C93A3F] text-white rounded-[2px] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer transition-colors font-semibold"
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Example Computed Values Disclosure (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 bg-white border border-[#2A2C31]/15 rounded-[3px] space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#E5484D]" />
                <span className="font-semibold text-xs font-mono uppercase tracking-wider text-[#17181B]">
                  Illustrative Simulation Example
                </span>
              </div>

              <div className="p-4 bg-[#F3F5F7] border border-[#2A2C31]/10 rounded-[2px]">
                <span className="text-[10px] font-mono text-[#5A626C] uppercase block">
                  {currentPage.sampleMetricLabel}
                </span>
                <span className="text-xl font-mono font-bold text-[#17181B] mt-1 block">
                  {currentPage.sampleMetricValue}
                </span>
                <span className="text-[11px] font-mono text-[#8E97A2] mt-1 block">
                  {currentPage.metricDetail}
                </span>
              </div>

              {/* Explicit Educational Disclosure */}
              <p className="text-xs text-[#5A626C] leading-relaxed border-t border-[#17181B]/10 pt-3">
                Notice: All metrics presented in this section are illustrative benchmark examples computed
                from the research graph by the same Tarjan and Monte Carlo algorithms utilized in the Network Studio,
                never claims of real-world physical protection.
              </p>
            </div>

            <div className="p-4 bg-white/70 border border-[#2A2C31]/10 rounded-[2px] flex items-center justify-between text-xs font-mono text-[#5A626C]">
              <span>Complexity: O(|V| + |E|) per trial</span>
              <span className="text-[#E5484D] font-medium">Tarjan DFS</span>
            </div>
          </div>
        </div>
      </Container>
    </PanelWipe>
  )
}
