import React from 'react'
import { BigWordList, WordItem } from '@/components/editorial/BigWordList'
import { StarTopologyVisual, RingTopologyVisual, MeshTopologyVisual } from './EditorialGraphVisuals'

/**
 * BigWordListSection:
 * Section 5 of precision layout pass (Topologies).
 * Star, Ring, Mesh as large selectable words with a rolling counter,
 * swapping the displayed live graph with a crossfade and slight scale, with a one line explanation each.
 */
export const BigWordListSection: React.FC = () => {
  const items: WordItem[] = [
    {
      id: 'star-word',
      word: 'STAR',
      subtitle: 'Central Hub Topology',
      metric: 'Single Cut Point: |A| = 1',
      description:
        'A single point of failure at the center router disconnects all peripheral leaves into isolated components.',
      visual: <StarTopologyVisual failed theme="light" />,
    },
    {
      id: 'ring-word',
      word: 'RING',
      subtitle: '2-Regular Cycle',
      metric: 'Edge Connectivity: λ = 2',
      description:
        'Symmetric cyclical routing allows communication to persist along the counter-direction when an edge breaks.',
      visual: <RingTopologyVisual severedEdge theme="light" />,
    },
    {
      id: 'mesh-word',
      word: 'MESH',
      subtitle: 'Redundant Backbone',
      metric: 'Algebraic Connectivity: λ₂ > 0',
      description:
        'Dense cross-connectivity guarantees resilient multi-hop communication under severe stochastic breakdowns.',
      visual: <MeshTopologyVisual theme="light" />,
    },
  ]

  return <BigWordList items={items} />
}
