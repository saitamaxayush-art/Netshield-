/**
 * The canvas as a standalone SVG (and PNG drawn from it), built from the store, not by copying the DOM.
 * All text is XML escaped. Component colours come from the latest up to date analysis, if any.
 */
import type { EditorGraph } from '@/types/graph'
import { TOKENS } from '@/lib/tokens'
import { NODE_HEIGHT, NODE_WIDTH } from './studioActions'

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c)
}

const truncate = (text: string, max: number) => ([...text].length > max ? `${[...text].slice(0, max - 1).join('')}…` : text)

export function graphSvg(graph: EditorGraph, componentOf: Record<string, number | null> | null): string {
  const pad = 40
  const xs = graph.nodes.map((n) => n.position.x)
  const ys = graph.nodes.map((n) => n.position.y)
  const minX = (xs.length ? Math.min(...xs) : 0) - pad
  const minY = (ys.length ? Math.min(...ys) : 0) - pad
  const width = (xs.length ? Math.max(...xs) : 0) + NODE_WIDTH + pad - minX
  const height = (ys.length ? Math.max(...ys) : 0) + NODE_HEIGHT + pad - minY
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const palette = TOKENS.colors.components.palette
  const centre = (id: string) => {
    const n = byId.get(id)
    return n ? { x: n.position.x + NODE_WIDTH / 2, y: n.position.y + NODE_HEIGHT / 2 } : null
  }
  const lines = graph.edges.map((e) => {
    const a = centre(e.source)
    const b = centre(e.target)
    if (!a || !b) return ''
    const down = (e.data?.failed ?? false) || (byId.get(e.source)?.data.failed ?? false) || (byId.get(e.target)?.data.failed ?? false)
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${e.data?.failed ? '#F43F5E' : down ? '#64748B' : '#3D4663'}" stroke-width="2"${down ? ' stroke-dasharray="6 5"' : ''}/>`
  })
  const boxes = graph.nodes.map((n) => {
    const index = componentOf?.[n.id] ?? null
    const stripe = !n.data.failed && index !== null ? `<rect x="${n.position.x}" y="${n.position.y}" width="4" height="${NODE_HEIGHT}" fill="${palette[index % palette.length]}"/>` : ''
    return [
      `<g data-node-id="${escapeXml(n.id)}">`,
      `<rect x="${n.position.x}" y="${n.position.y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="3" fill="${n.data.failed ? '#2A1520' : '#181B28'}" stroke="${n.data.failed ? '#F43F5E' : '#2F364E'}"${n.data.failed ? ' stroke-dasharray="5 4" stroke-width="2"' : ''}/>`,
      stripe,
      `<text x="${n.position.x + 14}" y="${n.position.y + 30}" font-size="13" font-weight="600" fill="${n.data.failed ? '#F43F5E' : '#E9ECEE'}">${escapeXml(truncate(n.data.label, 20))}</text>`,
      `<text x="${n.position.x + 14}" y="${n.position.y + 50}" font-size="10" fill="#94A3B8" font-family="monospace">${escapeXml(n.data.nodeType.toUpperCase())}${n.data.failed ? ' - FAILED' : ''}</text>`,
      '</g>',
    ].join('')
  })
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${Math.round(width)}" height="${Math.round(height)}" font-family="Inter, system-ui, sans-serif">`,
    `<title>NetShield network: ${graph.nodes.length} nodes, ${graph.edges.length} links</title>`,
    `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#13151F"/>`,
    ...lines,
    ...boxes,
    '</svg>',
  ].join('\n')
}

/** Draw the SVG onto a canvas and return PNG bytes. Browser only. */
export function svgToPng(svg: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas drawing is not available.'))
        return
      }
      context.scale(scale, scale)
      context.drawImage(image, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the PNG.'))), 'image/png')
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not draw the network image.'))
    }
    image.src = url
  })
}
