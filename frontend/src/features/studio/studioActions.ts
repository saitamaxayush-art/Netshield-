/** Editing actions shared by the toolbar, the empty canvas state and the canvas. */
import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useGraphStore } from '@/store/graphStore'
import { useToastStore } from '@/store/toastStore'
import type { NodeType, Position } from '@/types/graph'

export const NODE_WIDTH = 176
export const NODE_HEIGHT = 84
/** Tight margins so phones use their width; capped so a small graph is not oversized on a desktop. */
export const FIT_OPTIONS = { padding: 0.1, maxZoom: 1.1 }

/** Add a link, or explain in a toast why it is refused (self loop, duplicate). */
export function connectOrExplain(source: string, target: string): boolean {
  const result = useGraphStore.getState().addEdge({ source, target })
  if (result.ok) useToastStore.getState().dismiss()
  else useToastStore.getState().show(result.error)
  return result.ok
}

export function addNodeOrExplain(nodeType: NodeType, position: Position): void {
  const result = useGraphStore.getState().addNode({ nodeType, position })
  if (!result.ok) useToastStore.getState().show(result.error)
}

/** Add a node near the centre of the visible canvas, on a small grid so repeated adds do not overlap. */
export function useAddNodeAtCentre(): (nodeType: NodeType) => void {
  const { screenToFlowPosition } = useReactFlow()
  return useCallback(
    (nodeType) => {
      const rect = document.querySelector('[data-testid="studio-canvas"]')?.getBoundingClientRect()
      const centre = rect ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) : { x: 0, y: 0 }
      const count = useGraphStore.getState().nodes.length
      const column = (count % 3) * (NODE_WIDTH + 60) - (NODE_WIDTH + 60)
      const row = (Math.floor(count / 3) % 3) * (NODE_HEIGHT + 50) - (NODE_HEIGHT + 50)
      addNodeOrExplain(nodeType, { x: Math.round(centre.x - NODE_WIDTH / 2 + column), y: Math.round(centre.y - NODE_HEIGHT / 2 + row) })
    },
    [screenToFlowPosition]
  )
}
