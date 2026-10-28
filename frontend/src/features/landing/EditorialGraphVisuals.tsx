import React from 'react'

/**
 * StarTopologyVisual: Center router hub connected to perimeter leaf nodes.
 * Styled in Charcoal Grey, Moonlit Silver, and Signal Red.
 * Demonstrates high vulnerability to single articulation point failure.
 */
export const StarTopologyVisual: React.FC<{
  failed?: boolean
  className?: string
  theme?: 'dark' | 'light'
}> = ({ failed = false, className = '', theme = 'dark' }) => {
  const center = { x: 150, y: 110 }
  const leaves = [
    { x: 60, y: 50, label: 'L1' },
    { x: 150, y: 30, label: 'L2' },
    { x: 240, y: 50, label: 'L3' },
    { x: 250, y: 160, label: 'L4' },
    { x: 150, y: 190, label: 'L5' },
    { x: 50, y: 160, label: 'L6' },
  ]

  const isLight = theme === 'light'
  const healthyStroke = isLight ? '#5A626C' : '#C3CAD2'
  const nodeFill = isLight ? '#E4E8EC' : '#1E2024'
  const nodeStroke = isLight ? '#2A2C31' : '#E4E8EC'
  const gridDotColor = isLight ? '#C3CAD2' : '#2A2C31'

  return (
    <svg
      viewBox="0 0 300 220"
      className={`w-full h-full max-h-[220px] select-none ${className}`}
      aria-label="Star topology graph diagram"
    >
      <defs>
        <pattern id={`starGrid-${theme}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill={gridDotColor} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#starGrid-${theme})`} opacity="0.4" />

      {/* Radial Edges */}
      {leaves.map((leaf, i) => (
        <line
          key={i}
          x1={center.x}
          y1={center.y}
          x2={leaf.x}
          y2={leaf.y}
          stroke={failed ? '#E5484D' : healthyStroke}
          strokeWidth={failed ? 1.5 : 2}
          strokeDasharray={failed ? '4 3' : undefined}
          strokeOpacity={failed ? 0.6 : 0.85}
        />
      ))}

      {/* Peripheral Leaf Vertices */}
      {leaves.map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x}, ${leaf.y})`}>
          <rect
            x="-8"
            y="-8"
            width="16"
            height="16"
            fill={nodeFill}
            stroke={nodeStroke}
            strokeWidth="1.5"
            transform="rotate(45)"
          />
          <text
            y="18"
            textAnchor="middle"
            fill={isLight ? '#5A626C' : '#8E97A2'}
            className="text-[9px] font-mono select-none"
          >
            {leaf.label}
          </text>
        </g>
      ))}

      {/* Central Hub Node (Articulation Point) */}
      <g transform={`translate(${center.x}, ${center.y})`}>
        {failed && (
          <circle
            r="19"
            fill="none"
            stroke="#E5484D"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            className="animate-ping opacity-50"
          />
        )}
        <rect
          x="-12"
          y="-12"
          width="24"
          height="24"
          fill={failed ? '#2A161E' : nodeFill}
          stroke={failed ? '#E5484D' : nodeStroke}
          strokeWidth="2"
          transform="rotate(45)"
        />
        <text
          y="27"
          textAnchor="middle"
          fill={failed ? '#E5484D' : isLight ? '#17181B' : '#E4E8EC'}
          className="text-[10px] font-mono font-semibold"
        >
          {failed ? 'CUT POINT' : 'CORE HUB'}
        </text>
      </g>
    </svg>
  )
}

/**
 * RingTopologyVisual: 2-regular cycle C_6.
 * Demonstrates 2-edge connectivity where a single severance maintains an alternate route.
 */
export const RingTopologyVisual: React.FC<{
  severedEdge?: boolean
  className?: string
  theme?: 'dark' | 'light'
}> = ({ severedEdge = false, className = '', theme = 'dark' }) => {
  const cx = 150
  const cy = 110
  const r = 70
  const n = 6
  const nodes = Array.from({ length: n }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2
    return {
      id: `r${i + 1}`,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      label: `R${i + 1}`,
    }
  })

  const isLight = theme === 'light'
  const healthyStroke = isLight ? '#5A626C' : '#C3CAD2'
  const nodeFill = isLight ? '#E4E8EC' : '#1E2024'
  const nodeStroke = isLight ? '#2A2C31' : '#E4E8EC'

  return (
    <svg
      viewBox="0 0 300 220"
      className={`w-full h-full max-h-[220px] select-none ${className}`}
      aria-label="Ring topology graph diagram"
    >
      {/* Ring Edges */}
      {nodes.map((u, i) => {
        const v = nodes[(i + 1) % n]
        const isCut = severedEdge && i === 0

        return (
          <line
            key={i}
            x1={u.x}
            y1={u.y}
            x2={v.x}
            y2={v.y}
            stroke={isCut ? '#E5484D' : healthyStroke}
            strokeWidth={isCut ? 2 : 2}
            strokeDasharray={isCut ? '4 3' : undefined}
            strokeOpacity={isCut ? 0.75 : 0.85}
          />
        )
      })}

      {/* Ring Vertices */}
      {nodes.map((node, i) => (
        <g key={i} transform={`translate(${node.x}, ${node.y})`}>
          <rect
            x="-9"
            y="-9"
            width="18"
            height="18"
            fill={nodeFill}
            stroke={nodeStroke}
            strokeWidth="1.5"
            transform="rotate(45)"
          />
          <text
            y="3.5"
            textAnchor="middle"
            fill={isLight ? '#17181B' : '#E4E8EC'}
            className="text-[9px] font-mono select-none"
          >
            {node.label}
          </text>
        </g>
      ))}

      {/* Center Label */}
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        fill={isLight ? '#5A626C' : '#8E97A2'}
        className="text-[10px] font-mono uppercase tracking-wider"
      >
        Cycle C_6
      </text>
      <text
        x={cx}
        y={cy + 13}
        textAnchor="middle"
        fill={severedEdge ? '#E5484D' : isLight ? '#17181B' : '#E4E8EC'}
        className="text-[9px] font-mono font-medium"
      >
        {severedEdge ? 'Cut Edge: Backup Path Active' : '2-Edge Connected'}
      </text>
    </svg>
  )
}

/**
 * MeshTopologyVisual: Full redundant multi-hop graph with cross-links.
 */
export const MeshTopologyVisual: React.FC<{
  className?: string
  theme?: 'dark' | 'light'
}> = ({ className = '', theme = 'dark' }) => {
  const vertices = [
    { x: 50, y: 60, id: 'M1' },
    { x: 150, y: 40, id: 'M2' },
    { x: 250, y: 60, id: 'M3' },
    { x: 250, y: 160, id: 'M4' },
    { x: 150, y: 180, id: 'M5' },
    { x: 50, y: 160, id: 'M6' },
    { x: 150, y: 110, id: 'M0' },
  ]

  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [0, 3], [1, 4],
  ]

  const isLight = theme === 'light'
  const primaryStroke = isLight ? '#2A2C31' : '#E4E8EC'
  const crossStroke = isLight ? '#5A626C' : '#C3CAD2'
  const nodeFill = isLight ? '#E4E8EC' : '#1E2024'
  const nodeStroke = isLight ? '#17181B' : '#E4E8EC'

  return (
    <svg
      viewBox="0 0 300 220"
      className={`w-full h-full max-h-[220px] select-none ${className}`}
      aria-label="Redundant mesh topology diagram"
    >
      {edges.map(([u, v], i) => (
        <line
          key={i}
          x1={vertices[u].x}
          y1={vertices[u].y}
          x2={vertices[v].x}
          y2={vertices[v].y}
          stroke={i >= 6 ? crossStroke : primaryStroke}
          strokeWidth="1.5"
          strokeOpacity={i >= 6 ? 0.45 : 0.85}
        />
      ))}

      {vertices.map((v, i) => (
        <g key={i} transform={`translate(${v.x}, ${v.y})`}>
          <rect
            x="-7"
            y="-7"
            width="14"
            height="14"
            fill={nodeFill}
            stroke={nodeStroke}
            strokeWidth="1.5"
            transform="rotate(45)"
          />
        </g>
      ))}

      <text
        x="150"
        y="130"
        textAnchor="middle"
        fill={isLight ? '#17181B' : '#E4E8EC'}
        className="text-[10px] font-mono font-semibold"
      >
        k-Connected Mesh
      </text>
    </svg>
  )
}

/**
 * TarjanBridgesVisual: Demonstration of Tarjan depth-first search bridge & articulation points.
 */
export const TarjanBridgesVisual: React.FC<{
  className?: string
  theme?: 'dark' | 'light'
}> = ({ className = '', theme = 'dark' }) => {
  const isLight = theme === 'light'
  const compCardFill = isLight ? '#E4E8EC' : '#1E2024'
  const compBorder = isLight ? 'rgba(23,24,27,0.12)' : 'rgba(255,255,255,0.08)'
  const healthyStroke = isLight ? '#2A2C31' : '#C3CAD2'

  return (
    <svg
      viewBox="0 0 360 200"
      className={`w-full h-full select-none ${className}`}
      aria-label="Tarjan bridge detection diagram"
    >
      {/* Partition A */}
      <rect x="25" y="30" width="110" height="140" rx="3" fill={compCardFill} stroke={compBorder} />
      <text x="80" y="50" textAnchor="middle" fill={isLight ? '#5A626C' : '#8E97A2'} className="text-[10px] font-mono">
        COMPONENT 1
      </text>

      {/* Partition B */}
      <rect x="225" y="30" width="110" height="140" rx="3" fill={compCardFill} stroke={compBorder} />
      <text x="280" y="50" textAnchor="middle" fill={isLight ? '#5A626C' : '#8E97A2'} className="text-[10px] font-mono">
        COMPONENT 2
      </text>

      {/* Internal Edges Comp 1 */}
      <line x1="55" y1="80" x2="105" y2="80" stroke={healthyStroke} strokeWidth="2" strokeOpacity="0.8" />
      <line x1="55" y1="130" x2="105" y2="130" stroke={healthyStroke} strokeWidth="2" strokeOpacity="0.8" />
      <line x1="55" y1="80" x2="55" y2="130" stroke={healthyStroke} strokeWidth="2" strokeOpacity="0.8" />
      <line x1="105" y1="80" x2="105" y2="130" stroke={healthyStroke} strokeWidth="2" strokeOpacity="0.8" />

      {/* Critical Bridge Connection between components (Signal Red + Dashed) */}
      <line x1="105" y1="105" x2="255" y2="105" stroke="#E5484D" strokeWidth="2.5" strokeDasharray="5 3" />
      <text x="180" y="95" textAnchor="middle" fill="#E5484D" className="text-[10px] font-mono font-semibold">
        BRIDGE (u, v)
      </text>

      {/* Internal Edges Comp 2 */}
      <line x1="255" y1="80" x2="305" y2="80" stroke={healthyStroke} strokeWidth="2" strokeOpacity="0.8" />
      <line x1="255" y1="130" x2="305" y2="130" stroke={healthyStroke} strokeWidth="2" strokeOpacity="0.8" />
      <line x1="255" y1="80" x2="255" y2="130" stroke={healthyStroke} strokeWidth="2" strokeOpacity="0.8" />
      <line x1="305" y1="80" x2="305" y2="130" stroke={healthyStroke} strokeWidth="2" strokeOpacity="0.8" />

      {/* Bridge Cut Vertices (Dual encoded: Signal Red + Diamond + Pulse) */}
      <circle cx="105" cy="105" r="12" fill="none" stroke="#E5484D" strokeWidth="1.5" className="animate-pulse" />
      <rect x="99" y="99" width="12" height="12" fill="#E5484D" transform="rotate(45 105 105)" />

      <circle cx="255" cy="105" r="12" fill="none" stroke="#E5484D" strokeWidth="1.5" className="animate-pulse" />
      <rect x="249" y="99" width="12" height="12" fill="#E5484D" transform="rotate(45 255 105)" />
    </svg>
  )
}
