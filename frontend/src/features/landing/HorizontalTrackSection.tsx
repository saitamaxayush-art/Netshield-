import React from 'react'
import { HorizontalTrack, HorizontalSlide } from '@/components/editorial/HorizontalTrack'
import { ScriptCaps } from '@/components/editorial/ScriptCaps'
import { StarTopologyVisual, RingTopologyVisual, MeshTopologyVisual } from './EditorialGraphVisuals'

/**
 * HorizontalTrackSection:
 * Section 8 of luxury reference choreography.
 * Title with italic script above uppercase serif ("The structural foundations of" / "THREE NETWORK TOPOLOGIES"),
 * pinned section with wide graph frames travelling horizontally with edge curvature and step counter.
 */
export const HorizontalTrackSection: React.FC = () => {
  const slides: HorizontalSlide[] = [
    {
      id: 'star-topology',
      number: '01',
      title: 'Star Network',
      subtitle: 'Tree Structure T_n',
      badge: 'High Vulnerability',
      description:
        'All peripheral client nodes connect exclusively through a central hub router. While wiring cost is minimal O(|V|), the central hub constitutes an immediate articulation point whose severance disconnects all endpoints.',
      visual: <StarTopologyVisual failed />,
    },
    {
      id: 'ring-topology',
      number: '02',
      title: 'Ring Network',
      subtitle: 'Hamiltonian Cycle C_n',
      badge: '2-Edge Connected',
      description:
        'Every node is connected to exactly two neighbours forming a 2-regular simple cycle. A single broken connection does not disconnect the graph, as traffic reverses along the remaining path.',
      visual: <RingTopologyVisual severedEdge />,
    },
    {
      id: 'mesh-topology',
      number: '03',
      title: 'Mesh Network',
      subtitle: 'k-Connected Topology',
      badge: 'High Redundancy',
      description:
        'Multiple redundant links span between routers and gateways. Menger theorems guarantee that k node-disjoint paths must be severed before communication between any arbitrary pair can be interrupted.',
      visual: <MeshTopologyVisual />,
    },
  ]

  const heading = (
    <ScriptCaps
      script="The structural foundations of"
      caps="THREE NETWORK TOPOLOGIES"
      tag="h2"
      scriptClassName="text-accent-teal/90 text-xl sm:text-3xl"
      capsClassName="headline-chapter text-white"
    />
  )

  return <HorizontalTrack id="topologies" slides={slides} sectionHeading={heading} />
}
