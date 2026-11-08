/**
 * The guided tour: one entry per step. `targets` are tried in order and the first visible one is
 * highlighted (the phone layout keeps tools and panels in sheets, so it has its own fallbacks).
 * `prepare` puts the app in the state the step talks about (a panel tab, a section, the details sheet).
 */
import type { AnalysisSection, PanelTab } from '@/store/studioViewStore'

export type MascotPose = 'wave' | 'point'

export interface TourStep {
  id: string
  route: '/studio' | '/dashboard'
  title: string
  /** One or two plain sentences. */
  text: string
  /** CSS selectors, first visible wins; none means a centred message. */
  targets: string[]
  pose: MascotPose
  prepare?: { panelTab?: PanelTab; section?: AnalysisSection; details?: boolean }
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    route: '/studio',
    title: 'Hi, I am Netbot',
    text: 'I will show you around NetShield in a few short steps. You can skip at any time with Escape.',
    targets: [],
    pose: 'wave',
    prepare: { details: false },
  },
  {
    id: 'canvas',
    route: '/studio',
    title: 'The network canvas',
    text: 'This is your network. Drag nodes to move them, and drag from the small square on one node to another to connect them.',
    targets: ['[data-testid="studio-canvas"]'],
    pose: 'point',
    prepare: { details: false },
  },
  {
    id: 'add-nodes',
    route: '/studio',
    title: 'Add nodes',
    text: 'Add a router, server, client or firewall here. Click to place it in the middle, or drag it onto the canvas.',
    targets: ['[data-tour="add-nodes"]', '[data-tour="tools"]'],
    pose: 'point',
    prepare: { details: false },
  },
  {
    id: 'presets',
    route: '/studio',
    title: 'Example networks',
    text: 'Star, Ring, Mesh and Campus load ready made examples, labelled Example. Campus shows every panel at once.',
    targets: ['[data-tour="presets"]', '[data-tour="tools"]'],
    pose: 'point',
    prepare: { details: false },
  },
  {
    id: 'failures',
    route: '/studio',
    title: 'Fail and restore',
    text: 'Select a node or link, then fail it here to see what breaks. Fail random picks one for you from a seed.',
    targets: ['[data-testid="failure-controls"]'],
    pose: 'point',
    prepare: { panelTab: 'properties', details: true },
  },
  {
    id: 'analysis',
    route: '/studio',
    title: 'Analysis sections',
    text: 'The server analyzes the network after every change. Each section shows one result with a short explanation of the maths.',
    targets: ['[aria-label="Analysis sections"]', '[data-testid="panel-tabs"]'],
    pose: 'point',
    prepare: { panelTab: 'analysis', section: 'overview', details: true },
  },
  {
    id: 'critical',
    route: '/studio',
    title: 'Weak spots',
    text: 'Critical lists bridges and cut vertices: single links or nodes whose failure splits the network. Click one to find it on the canvas.',
    targets: ['[data-testid="section-critical"]', '[aria-label="Analysis sections"]'],
    pose: 'point',
    prepare: { panelTab: 'analysis', section: 'critical', details: true },
  },
  {
    id: 'paths',
    route: '/studio',
    title: 'Paths and traversals',
    text: 'Pick two nodes to see the shortest path drawn on the canvas. Traversal plays breadth and depth first search step by step.',
    targets: ['[data-testid="section-paths"]', '[aria-label="Analysis sections"]'],
    pose: 'point',
    prepare: { panelTab: 'analysis', section: 'paths', details: true },
  },
  {
    id: 'simulation',
    route: '/studio',
    title: 'Reliability simulation',
    text: 'Set how likely each link is to fail and run thousands of random trials. You get an estimate of how often the network stays connected, with charts.',
    targets: ['[data-tour="simulation"]'],
    pose: 'point',
    prepare: { panelTab: 'simulation', details: true },
  },
  {
    id: 'import-export',
    route: '/studio',
    title: 'Save and share',
    text: 'Import or export your graph as a file, or save a picture of the canvas. Your work is also saved in this browser.',
    targets: ['[data-tour="import-export"]', '[data-tour="tools"]'],
    pose: 'point',
    prepare: { details: false },
  },
  {
    id: 'help',
    route: '/studio',
    title: 'Help is here',
    text: 'This button replays the tour whenever you like. The keyboard shortcuts are right next to it.',
    targets: ['[data-tour="help"]', '[data-tour="tools"]'],
    pose: 'point',
    prepare: { details: false },
  },
  {
    id: 'dashboard',
    route: '/dashboard',
    title: 'The dashboard',
    text: 'A summary of your current network: every number comes from the latest analysis. Click a card to jump to the matching panel.',
    targets: ['[data-tour="metrics"]', '[data-testid="dashboard-empty"]'],
    pose: 'point',
  },
  {
    id: 'done',
    route: '/dashboard',
    title: 'You are all set',
    text: 'That is the tour. Open the studio and try failing the busiest node first.',
    targets: [],
    pose: 'wave',
  },
]
