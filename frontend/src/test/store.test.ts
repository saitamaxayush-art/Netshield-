import { describe, it, expect, beforeEach } from 'vitest'
import { useGraphStore } from '../store/graphStore'

describe('Graph Store Reducers & Actions', () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph()
  })

  it('adds a node and selects it', () => {
    const store = useGraphStore.getState()
    store.addNode('router')

    const state = useGraphStore.getState()
    expect(state.nodes.length).toBe(1)
    expect(state.nodes[0].data.nodeType).toBe('router')
    expect(state.selectedNodeId).toBe(state.nodes[0].id)
  })

  it('prevents self-loops on connection', () => {
    const store = useGraphStore.getState()
    store.addNode('server')
    const nodeId = useGraphStore.getState().nodes[0].id

    store.onConnect({ source: nodeId, target: nodeId, sourceHandle: null, targetHandle: null })
    expect(useGraphStore.getState().edges.length).toBe(0)
  })

  it('connects two distinct nodes and prevents duplicate edges', () => {
    const store = useGraphStore.getState()
    store.addNode('router')
    store.addNode('server')
    const [n1, n2] = useGraphStore.getState().nodes

    // First connection
    store.onConnect({ source: n1.id, target: n2.id, sourceHandle: null, targetHandle: null })
    expect(useGraphStore.getState().edges.length).toBe(1)

    // Attempt reverse duplicate edge
    store.onConnect({ source: n2.id, target: n1.id, sourceHandle: null, targetHandle: null })
    expect(useGraphStore.getState().edges.length).toBe(1)
  })

  it('toggles node failure state and stores failedNodeIds', () => {
    const store = useGraphStore.getState()
    store.addNode('firewall')
    const node = useGraphStore.getState().nodes[0]

    store.failNode(node.id)
    let state = useGraphStore.getState()
    expect(state.failedNodeIds).toContain(node.id)
    expect(state.nodes[0].data.status).toBe('failed')

    store.restoreNode(node.id)
    state = useGraphStore.getState()
    expect(state.failedNodeIds).not.toContain(node.id)
    expect(state.nodes[0].data.status).toBe('healthy')
  })

  it('removes incident edges when a node is deleted', () => {
    const store = useGraphStore.getState()
    store.addNode('client')
    store.addNode('router')
    const [n1, n2] = useGraphStore.getState().nodes

    store.onConnect({ source: n1.id, target: n2.id, sourceHandle: null, targetHandle: null })
    expect(useGraphStore.getState().edges.length).toBe(1)

    store.deleteNode(n1.id)
    const state = useGraphStore.getState()
    expect(state.nodes.length).toBe(1)
    expect(state.edges.length).toBe(0)
  })
})

describe('Store analysis integration (no silent fallback)', () => {
  it('a failed analysis shows an error, clears the old result and leaves no highlights', async () => {
    const { apiService, ApiError } = await import('../services/api')
    const { vi } = await import('vitest')
    useGraphStore.getState().loadExample('star')
    const { analyzeResponse } = await import('./fixtures')
    const okResult = {
      data: analyzeResponse({
        articulationPoints: { nodeIds: ['hub_1'], explanationKey: 'articulation_point_definition' },
        bridges: { edgeIds: ['e_hub_srv'], explanationKey: 'bridge_definition' },
      }),
      source: 'backend' as const,
    }
    const spy = vi.spyOn(apiService, 'analyze').mockResolvedValueOnce(okResult)
    await useGraphStore.getState().runAnalysis(null, null)
    expect(useGraphStore.getState().nodes.find((n) => n.id === 'hub_1')?.data.isArticulationPoint).toBe(true)

    spy.mockRejectedValueOnce(new ApiError('network', 'Could not reach the NetShield backend (/api/analyze).'))
    await useGraphStore.getState().runAnalysis(null, null)
    const state = useGraphStore.getState()
    expect(state.analysisResult).toBeNull()
    expect(state.analysisError).toBe('Could not reach the NetShield backend (/api/analyze).')
    expect(state.nodes.some((n) => n.data.isArticulationPoint)).toBe(false)
    expect(state.edges.some((e) => e.data?.isBridge)).toBe(false)
    spy.mockRestore()
  })

  it('builds the contract request: per element failed flags, path only with both ends', async () => {
    const { buildAnalyzeRequest } = await import('../store/graphStore')
    useGraphStore.getState().loadExample('star')
    const { nodes, edges } = useGraphStore.getState()
    const body = buildAnalyzeRequest(nodes, edges, ['hub_1'], ['e_hub_srv'], 'srv_1', null)
    expect(body.nodes.find((n) => n.id === 'hub_1')?.failed).toBe(true)
    expect(body.edges.find((e) => e.id === 'e_hub_srv')?.failed).toBe(true)
    expect(body.startNodeId).toBe('srv_1')
    expect(body.pathSource).toBeUndefined()
    expect(Object.keys(body).sort()).toEqual(['edges', 'nodes', 'startNodeId'])
  })
})
