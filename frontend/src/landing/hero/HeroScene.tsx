import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { pointerState, scheduleRefresh, scrollState } from '../motion/engine'
import { poseFor, type HeroModel } from './heroModel'

const SILVER = new THREE.Color('#C3CAD2')
const SILVER_LIT = new THREE.Color('#F3F5F7')
const CYCLE = 9 // seconds between failures
const scratch = new THREE.Vector3()
const matrix = new THREE.Matrix4()

export interface HeroSceneProps {
  model: HeroModel
  hovered: string | null
  visible: React.RefObject<boolean>
  /** Screen positions written every rendered frame for picking and tooltips. */
  screen: React.RefObject<Map<string, [number, number]>>
  onFirstFrame: () => void
  onFrame: () => void
  onDowngrade: () => void
  dprCap: number
}

/**
 * WebGL hero: merged LineSegments for links, one InstancedMesh for nodes,
 * charcoal fog, slow drift, damped pointer parallax and a scheduled link
 * failure whose reroute pulse follows the detour computed by the shared
 * shortest path routine. Rendered from the shared gsap ticker, skipped when
 * offscreen or hidden, quality stepped down when frames are slow.
 * Plain three.js (no R3F): R3F always constructs the deprecated THREE.Clock,
 * which logs a console warning on three r183 and later.
 */
export default function HeroScene({ model, hovered, visible, screen, onFirstFrame, onFrame, onDowngrade, dprCap }: HeroSceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{ setHovered: (id: string | null) => void } | null>(null)
  const callbacks = useRef({ onFirstFrame, onFrame, onDowngrade })
  useEffect(() => {
    callbacks.current = { onFirstFrame, onFrame, onDowngrade }
  })

  useEffect(() => {
    const el = host.current
    if (!el) return
    const g = model.graph
    const index = new Map(g.nodes.map((n, i) => [n.id, i]))

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      callbacks.current.onDowngrade()
      return
    }
    const levels = [dprCap, 1.25, 1].filter((v, i, a) => a.indexOf(v) === i && v <= dprCap)
    let level = 0
    renderer.setPixelRatio(Math.min(levels[0], window.devicePixelRatio || 1))
    renderer.setClearColor('#17181B')
    renderer.domElement.style.display = 'block'
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog('#17181B', 10, 21)
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60)
    camera.position.set(0, 0, 13)
    const group = new THREE.Group()
    scene.add(group)

    // Healthy links: one merged buffer, one draw call.
    const original = new Float32Array(g.edges.length * 6)
    g.edges.forEach((e, i) => {
      const a = g.nodes[index.get(e.source)!]
      const b = g.nodes[index.get(e.target)!]
      original.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6)
    })
    const baseGeo = new THREE.BufferGeometry()
    const basePos = new THREE.BufferAttribute(original.slice(), 3)
    baseGeo.setAttribute('position', basePos)
    const baseMat = new THREE.LineBasicMaterial({ color: '#8E97A2', transparent: true, opacity: 0.42 })
    group.add(new THREE.LineSegments(baseGeo, baseMat))

    const detourGeo = new THREE.BufferGeometry()
    const detourMat = new THREE.LineBasicMaterial({ color: '#E4E8EC', transparent: true, opacity: 0, fog: false })
    group.add(new THREE.LineSegments(detourGeo, detourMat))

    const failedGeo = new THREE.BufferGeometry()
    const failedMat = new THREE.LineDashedMaterial({ color: '#E5484D', dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0, fog: false })
    const failedLine = new THREE.LineSegments(failedGeo, failedMat)
    group.add(failedLine)

    const litGeo = new THREE.BufferGeometry()
    const litMat = new THREE.LineBasicMaterial({ color: '#F3F5F7', transparent: true, opacity: 0.95, fog: false })
    group.add(new THREE.LineSegments(litGeo, litMat))

    const nodeGeo = new THREE.SphereGeometry(0.055, 10, 8)
    const nodeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' })
    const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, g.nodes.length)
    group.add(nodes)

    const pulseGeo = new THREE.SphereGeometry(0.085, 12, 10)
    const pulseMat = new THREE.MeshBasicMaterial({ color: '#F3F5F7', fog: false })
    const pulse = new THREE.Mesh(pulseGeo, pulseMat)
    pulse.visible = false
    group.add(pulse)

    const setHovered = (id: string | null) => {
      const near = id ? model.neighbours.get(id) : null
      g.nodes.forEach((n, i) => {
        const on = n.id === id || Boolean(near?.has(n.id))
        const s = n.id === id ? 1.9 : on ? 1.4 : 1
        matrix.makeScale(s, s, s).setPosition(n.x, n.y, n.z)
        nodes.setMatrixAt(i, matrix)
        nodes.setColorAt(i, on ? SILVER_LIT : SILVER)
      })
      nodes.instanceMatrix.needsUpdate = true
      if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true
      const pts: number[] = []
      if (id) {
        const a = g.nodes[index.get(id)!]
        for (const nb of near ?? []) {
          const b = g.nodes[index.get(nb)!]
          pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
      litGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    }
    setHovered(null)
    api.current = { setHovered }

    // Failure cycle.
    const cycle = { n: -1, failing: false, path: [] as THREE.Vector3[], lengths: [] as number[], total: 0 }
    const restoreBase = () => {
      ;(basePos.array as Float32Array).set(original)
      basePos.needsUpdate = true
    }
    const startFailure = (n: number) => {
      restoreBase()
      const id = model.failureOrder[n % model.failureOrder.length]
      const ei = g.edges.findIndex((e) => e.id === id)
      const e = g.edges[ei]
      const a = g.nodes[index.get(e.source)!]
      const b = g.nodes[index.get(e.target)!]
      // Collapse the failed link out of the healthy buffer and draw it dashed red.
      ;(basePos.array as Float32Array).fill(0, ei * 6, ei * 6 + 6)
      basePos.needsUpdate = true
      failedGeo.setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)])
      failedLine.computeLineDistances()
      const path = (model.detour(id) ?? []).map((nid) => {
        const p = g.nodes[index.get(nid)!]
        return new THREE.Vector3(p.x, p.y, p.z)
      })
      const seg: number[] = []
      for (let i = 1; i < path.length; i++) seg.push(path[i - 1].x, path[i - 1].y, path[i - 1].z, path[i].x, path[i].y, path[i].z)
      detourGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
      const lengths = path.slice(1).map((p, i) => p.distanceTo(path[i]))
      Object.assign(cycle, { n, failing: true, path, lengths, total: lengths.reduce((s, l) => s + l, 0) })
    }

    let w = 0
    let h = 0
    const resize = () => {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      w = r.width
      h = r.height
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = `${w}px`
      renderer.domElement.style.height = `${h}px`
      const pose = poseFor(w)
      camera.fov = pose.fov
      camera.position.z = pose.camZ
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const parallax = { x: 0, y: 0 }
    const start = performance.now()
    let first = true
    let frames = 0
    let sum = 0
    let last = 0
    let lost = false

    const render = (now: number) => {
      const t = (now - start) / 1000
      const pose = poseFor(w)
      const px = pointerState.fine ? pointerState.nx : 0
      const py = pointerState.fine ? pointerState.ny : 0
      parallax.x += (px * 0.09 - parallax.x) * 0.045
      parallax.y += (py * 0.05 - parallax.y) * 0.045
      const scrollT = Math.min(1, scrollState.y / Math.max(1, h))
      group.rotation.set(pose.rx + parallax.y + Math.sin(t * 0.05) * 0.03 + scrollT * 0.12, pose.ry + parallax.x + Math.sin(t * 0.04) * 0.08, 0)
      group.position.set(pose.gx, pose.gy + scrollT * 0.8, 0)

      // Fail at the start of each cycle, pulse along the detour, restore after 4.6s.
      const n = Math.floor((t + 3) / CYCLE)
      const local = (t + 3) % CYCLE
      if (n !== cycle.n) startFailure(n)
      const failOn = local < 4.6
      failedMat.opacity = failOn ? Math.min(1, local / 0.3) : 0
      if (!failOn && cycle.failing) {
        restoreBase()
        cycle.failing = false
      }
      const travel = (local - 0.7) / 1.8
      detourMat.opacity = travel > 0 && failOn ? Math.min(0.9, travel * 2) * (local > 4 ? (4.6 - local) / 0.6 : 1) : 0
      pulse.visible = travel > 0 && travel < 1 && cycle.total > 0
      if (pulse.visible) {
        let d = travel * cycle.total
        let i = 0
        while (i < cycle.lengths.length - 1 && d > cycle.lengths[i]) d -= cycle.lengths[i++]
        pulse.position.lerpVectors(cycle.path[i], cycle.path[i + 1], Math.min(1, d / (cycle.lengths[i] || 1)))
      }

      renderer.render(scene, camera)
      window.__nsHeroFrames = (window.__nsHeroFrames ?? 0) + 1

      group.updateMatrixWorld()
      const map = screen.current
      for (const node of g.nodes) {
        scratch.set(node.x, node.y, node.z).applyMatrix4(group.matrixWorld).project(camera)
        map.set(node.id, [((scratch.x + 1) / 2) * w, ((1 - scratch.y) / 2) * h])
      }
      if (first) {
        first = false
        callbacks.current.onFirstFrame()
        scheduleRefresh()
      }
      callbacks.current.onFrame()
    }

    const tick = (time: number) => {
      if (lost || !visible.current || document.hidden || w === 0) {
        last = 0
        return
      }
      const now = time * 1000
      render(performance.now())
      // Adaptive quality: average frame interval after warm up; step DPR down, then fall back to SVG.
      if (last) {
        frames++
        if (frames > 90) sum += now - last
        if (frames > 150) {
          const avg = sum / 60
          frames = 90
          sum = 0
          if (avg > 24) {
            if (level < levels.length - 1) {
              renderer.setPixelRatio(Math.min(levels[++level], window.devicePixelRatio || 1))
              resize()
            } else if (avg > 30) callbacks.current.onDowngrade()
          }
        }
      }
      last = now
    }
    gsap.ticker.add(tick)

    const onLost = (e: Event) => {
      e.preventDefault()
      lost = true
      callbacks.current.onDowngrade()
    }
    renderer.domElement.addEventListener('webglcontextlost', onLost)

    return () => {
      gsap.ticker.remove(tick)
      ro.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      api.current = null
      ;[baseGeo, detourGeo, failedGeo, litGeo, nodeGeo, pulseGeo].forEach((x) => x.dispose())
      ;[baseMat, detourMat, failedMat, litMat, nodeMat, pulseMat].forEach((x) => x.dispose())
      nodes.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [model, dprCap, visible, screen])

  useEffect(() => {
    api.current?.setHovered(hovered)
  }, [hovered])

  return <div ref={host} style={{ position: 'absolute', inset: 0 }} data-hero-renderer="webgl" />
}
