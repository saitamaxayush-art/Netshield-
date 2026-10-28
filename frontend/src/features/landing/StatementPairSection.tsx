import React from 'react'
import { PanelWipe } from '@/components/editorial/PanelWipe'
import { ScriptCaps } from '@/components/editorial/ScriptCaps'
import { SplitLines } from '@/components/editorial/SplitLines'
import { ImageFrame } from '@/components/editorial/ImageFrame'
import { TarjanBridgesVisual } from './EditorialGraphVisuals'

/**
 * StatementPairSection:
 * Section 4 & 5 of luxury reference choreography.
 * Uppercase serif lines mixed with small italic script words revealed line-by-line through masks
 * on a clean white background, paired with an offset graph analysis card on one side.
 */
export const StatementPairSection: React.FC = () => {
  return (
    <PanelWipe theme="light" className="py-24 sm:py-32 border-t border-[#0A0B10]/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-16 items-center">
        {/* Left Editorial Statement Text Column */}
        <div className="lg:col-span-7 space-y-6">
          <ScriptCaps
            script="The mathematical certainty of"
            caps="CRITICAL BRIDGES &amp; ARTICULATION POINTS"
            tag="h2"
            scriptClassName="text-[#64748B] text-xl sm:text-3xl"
            capsClassName="headline-chapter text-[#0A0B10]"
          />

          <div className="space-y-4 pt-2">
            <SplitLines
              tag="p"
              className="text-base sm:text-lg text-[#0A0B10] font-serif leading-relaxed"
            >
              When a bridge edge is severed, the connected graph immediately partitions into disjoint subgraphs.
            </SplitLines>

            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-xl">
              Using Tarjan depth-first search in linear time O(|V| + |E|), NetShield identifies
              every articulation vertex whose removal increases the number of connected components.
              Network resilience requires identifying these bottlenecks before hardware degrades.
            </p>
          </div>

          <div className="pt-4 flex items-center gap-6 text-xs font-mono text-[#64748B]">
            <div>
              <span className="text-[#0A0B10] font-semibold text-sm">O(V + E)</span>
              <p className="text-[10px] uppercase">Linear Complexity</p>
            </div>
            <div className="w-[1px] h-8 bg-[#0A0B10]/10" />
            <div>
              <span className="text-state-coral font-semibold text-sm">Tarjan DFS</span>
              <p className="text-[10px] uppercase">Bridge Discovery</p>
            </div>
          </div>
        </div>

        {/* Right Offset Visual Card */}
        <div className="lg:col-span-5">
          <ImageFrame
            aspectRatio="aspect-[4/3]"
            initialInset="inset(6% 8% 6% 8%)"
            expandOnScroll={false}
            className="bg-[#0A0B10] rounded-[3px] border border-[#0A0B10]/15 shadow-xl"
          >
            <div className="w-full h-full p-6 flex flex-col justify-between">
              <div className="flex justify-between items-center text-[10px] font-mono text-white/50 border-b border-white/10 pb-2">
                <span className="text-state-coral uppercase">Vulnerability Inspection</span>
                <span>k = 2 Disjoint Partitions</span>
              </div>

              <div className="flex-1 flex items-center justify-center py-2">
                <TarjanBridgesVisual />
              </div>

              <div className="text-[10px] font-mono text-white/40 pt-2 border-t border-white/5 flex justify-between">
                <span>Critical link between clusters</span>
                <span className="text-state-coral">Severe Partition</span>
              </div>
            </div>
          </ImageFrame>
        </div>
      </div>
    </PanelWipe>
  )
}
