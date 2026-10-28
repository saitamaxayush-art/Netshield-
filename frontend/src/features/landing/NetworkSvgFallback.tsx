import React from 'react'
import { generateSeededGraph } from '@/lib/seededGraphGenerator'

interface NetworkSvgFallbackProps {
  seed?: number
  className?: string
}

export const NetworkSvgFallback: React.FC<NetworkSvgFallbackProps> = ({
  seed = 42,
  className = '',
}) => {
  const graph = generateSeededGraph(seed)

  // Map 3D coordinates (x: -5..5, y: -3..3) to SVG viewBox (0..1000, 0..600)
  const mapX = (x: number) => 500 + x * 75
  const mapY = (y: number) => 300 - y * 65

  // Map node positions
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, { x: mapX(n.x), y: mapY(n.y), cluster: n.cluster }]))

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-bg-primary select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1000 600"
        className="w-full h-full opacity-80"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="bridgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E5484D" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#F0666A" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#E5484D" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E4E8EC" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#E4E8EC" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Topographic architectural background grid */}
        <g stroke="#2A2C31" strokeWidth="0.5" strokeDasharray="3 6" opacity="0.5">
          <line x1="100" y1="0" x2="100" y2="600" />
          <line x1="300" y1="0" x2="300" y2="600" />
          <line x1="500" y1="0" x2="500" y2="600" />
          <line x1="700" y1="0" x2="700" y2="600" />
          <line x1="900" y1="0" x2="900" y2="600" />
          <line x1="0" y1="150" x2="1000" y2="150" />
          <line x1="0" y1="300" x2="1000" y2="300" />
          <line x1="0" y1="450" x2="1000" y2="450" />
        </g>

        {/* Regular Edges */}
        <g stroke="#3A3D44" strokeWidth="1" opacity="0.6">
          {graph.edges
            .filter((e) => !e.isDeliberateBridge)
            .map((edge) => {
              const u = nodeMap.get(edge.source)
              const v = nodeMap.get(edge.target)
              if (!u || !v) return null
              return (
                <line
                  key={edge.id}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke="#3A3D44"
                />
              )
            })}
        </g>

        {/* Deliberate Bridge Edges (Signal Red) */}
        <g stroke="url(#bridgeGradient)" strokeWidth="1.5" strokeDasharray="4 2">
          {graph.edges
            .filter((e) => e.isDeliberateBridge)
            .map((edge) => {
              const u = nodeMap.get(edge.source)
              const v = nodeMap.get(edge.target)
              if (!u || !v) return null
              return (
                <line
                  key={edge.id}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                />
              )
            })}
        </g>

        {/* Nodes (Silver) */}
        {graph.nodes.map((node) => {
          const pos = nodeMap.get(node.id)
          if (!pos) return null
          const isHub = node.cluster === 3
          return (
            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
              {isHub && <circle r="12" fill="url(#nodeGlow)" />}
              <rect
                x="-3"
                y="-3"
                width="6"
                height="6"
                fill={isHub ? '#E4E8EC' : '#C3CAD2'}
                stroke="#17181B"
                strokeWidth="1"
                transform="rotate(45)"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
