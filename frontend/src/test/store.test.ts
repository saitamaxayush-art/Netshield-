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
