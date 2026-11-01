import { memo } from 'react'
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
  EdgeLabelRenderer,
} from '@xyflow/react'
import type { EditorEdge } from '@/types/graph'
import { useIsBridge } from '@/store/selectors'

export const NetShieldCustomEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  }: EdgeProps<EditorEdge>) => {
    const isFailed = data?.failed ?? false
    // From the latest up to date analysis result (analysisStore), never computed here.
    const isBridge = useIsBridge(id) && !isFailed

    const [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    })

    const strokeColor = isFailed
      ? '#F43F5E'
      : selected
      ? '#38BDF8'
      : isBridge
      ? '#2DD4BF'
      : '#2F364E'

    const strokeWidth = selected ? 2.5 : isBridge ? 2 : 1.5
    const strokeDasharray = isFailed ? '5 5' : isBridge ? '6 3' : undefined

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: strokeColor,
            strokeWidth,
            strokeDasharray,
            opacity: isFailed ? 0.45 : 1,
            transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
          }}
        />

        {isBridge && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
              }}
              className="px-1.5 py-0.5 bg-bg-surface border border-accent-teal/40 text-accent-teal text-[9px] font-mono uppercase tracking-tight rounded-[2px] shadow-sm select-none"
            >
              Bridge
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    )
  }
)

NetShieldCustomEdge.displayName = 'NetShieldCustomEdge'
