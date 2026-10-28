import React, { useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { generateSeededGraph } from '@/lib/seededGraphGenerator'
import { scrollStore } from '@/lib/useLenisScroll'

interface NetworkModelProps {
  reducedMotion: boolean
  qualityLevel?: 'high' | 'low'
}

const NetworkModel: React.FC<NetworkModelProps> = ({ reducedMotion, qualityLevel = 'high' }) => {
  const groupRef = useRef<THREE.Group>(null)
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const { pointer } = useThree()

  // Generate deterministic graph
  const graph = useMemo(() => generateSeededGraph(42), [])

  // Setup InstancedMesh matrices for nodes
  useEffect(() => {
    if (!instancedMeshRef.current) return
    const mesh = instancedMeshRef.current
    const dummy = new THREE.Object3D()
    const colorSilverLight = new THREE.Color('#E4E8EC')
    const colorSilverMuted = new THREE.Color('#C3CAD2')

    graph.nodes.forEach((node, i) => {
      dummy.position.set(node.x, node.y, node.z)
      dummy.rotation.set(0.78, 0.78, 0) // Subtle 45 degree tilt for architectural diamond look
      const scale = node.cluster === 3 ? 0.12 : 0.08
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, node.cluster === 3 ? colorSilverLight : colorSilverMuted)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [graph])

  // Build merged line segments geometry
  const { regularLinesGeometry, bridgeLinesGeometry } = useMemo(() => {
    const nodeCoords = new Map(graph.nodes.map((n) => [n.id, new THREE.Vector3(n.x, n.y, n.z)]))

    const regPositions: number[] = []
    const bridgePositions: number[] = []

    graph.edges.forEach((edge) => {
      const u = nodeCoords.get(edge.source)
      const v = nodeCoords.get(edge.target)
      if (!u || !v) return

      if (edge.isDeliberateBridge) {
        bridgePositions.push(u.x, u.y, u.z, v.x, v.y, v.z)
      } else {
        regPositions.push(u.x, u.y, u.z, v.x, v.y, v.z)
      }
    })

    const regGeo = new THREE.BufferGeometry()
    regGeo.setAttribute('position', new THREE.Float32BufferAttribute(regPositions, 3))

    const bridgeGeo = new THREE.BufferGeometry()
    bridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(bridgePositions, 3))

    return { regularLinesGeometry: regGeo, bridgeLinesGeometry: bridgeGeo }
  }, [graph])

  // Camera drift and scroll-linked rotation via shared store
  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return

    const t = clock.getElapsedTime()
    // Slow architectural camera drift
    const driftY = Math.sin(t * 0.08) * 0.12
    const driftX = Math.cos(t * 0.06) * 0.05

    // Subtle pointer parallax
    const targetParallaxX = pointer.x * 0.12
    const targetParallaxY = pointer.y * 0.08

    // Read smooth scroll without React state re-render
    const scrollOffset = (scrollStore.scroll || 0) * 0.0006

    groupRef.current.rotation.y = driftY + targetParallaxX + scrollOffset
    groupRef.current.rotation.x = driftX - targetParallaxY
  })

  // Cleanup geometries on unmount
  useEffect(() => {
    return () => {
      regularLinesGeometry.dispose()
      bridgeLinesGeometry.dispose()
    }
  }, [regularLinesGeometry, bridgeLinesGeometry])

  return (
    <group ref={groupRef} position={[1.2, -0.2, 0]}>
      {/* Small precise geometric nodes (InstancedMesh) */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, graph.nodes.length]}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Merged fine regular connection lines */}
      <lineSegments geometry={regularLinesGeometry}>
        <lineBasicMaterial color="#3A3D44" transparent opacity={0.55} />
      </lineSegments>

      {/* Deliberate bridge lines with distinct signal red highlight for rare failing edge */}
      <lineSegments geometry={bridgeLinesGeometry}>
        <lineBasicMaterial color="#E5484D" transparent opacity={0.85} />
      </lineSegments>

      {/* Topographic reference grid plane */}
      {qualityLevel === 'high' && (
        <gridHelper
          args={[16, 16, '#2A2C31', '#1E2024']}
          position={[0, -2.8, 0]}
        />
      )}
    </group>
  )
}

interface Network3DSceneProps {
  reducedMotion?: boolean
  isIntersecting?: boolean
}

export const Network3DScene: React.FC<Network3DSceneProps> = ({
  reducedMotion = false,
  isIntersecting = true,
}) => {
  return (
    <div className="w-full h-full relative" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 9], fov: 45 }}
        dpr={typeof window !== 'undefined' ? Math.min(1.75, window.devicePixelRatio || 1) : 1}
        frameloop={isIntersecting ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <fog attach="fog" args={['#17181B', 6, 17]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <NetworkModel reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}

export default Network3DScene
