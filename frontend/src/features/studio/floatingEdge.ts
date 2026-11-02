/**
 * Where an undirected link meets its two node boxes: on the straight line between the box centres.
 * Links carry no handle ids, so any side can connect and the line always takes the short way.
 */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

function borderPoint(from: Box, toward: { x: number; y: number }) {
  const cx = from.x + from.width / 2
  const cy = from.y + from.height / 2
  const dx = toward.x - cx
  const dy = toward.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scale = Math.min(dx === 0 ? Infinity : from.width / 2 / Math.abs(dx), dy === 0 ? Infinity : from.height / 2 / Math.abs(dy))
  return { x: cx + dx * scale, y: cy + dy * scale }
}

export function floatingEnds(a: Box, b: Box) {
  const ca = { x: a.x + a.width / 2, y: a.y + a.height / 2 }
  const cb = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  return { source: borderPoint(a, cb), target: borderPoint(b, ca) }
}
