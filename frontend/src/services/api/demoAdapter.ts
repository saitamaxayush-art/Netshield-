import type { SimulateRequestBody, SimulateResponseBody, SweepRequestBody, SweepResponseBody } from './contract'
import { simulateReliability } from '@/lib/graphAlgorithms'

/**
 * Demo adapter: browser side Monte Carlo for the LEGACY simulate and sweep shapes.
 *
 * Used only in explicit demo mode (VITE_USE_DEMO_ADAPTER=true, shown as a banner in the studio, with
 * every result labelled "Demo result"). It is never a fallback for a failed backend call. It does not
 * provide graph analysis: the previous demo analysis returned fabricated values (a fixed diameter and
 * clustering coefficient), so it was removed rather than labelled.
 *
 * Defaults mirror the backend's legacy request defaults.
 */
export class DemoAdapter {
  simulate(req: SimulateRequestBody): SimulateResponseBody {
    const res = simulateReliability(
      req.nodes.map((n) => ({ id: n.id, label: n.label })),
      req.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      req.failed_nodes ?? [],
      req.failed_edges ?? [],
      req.failure_prob ?? 0.1,
      req.trials ?? 500,
      req.fail_target ?? 'edges'
    )
    return {
      trials: res.trials,
      connected_trials: res.connected_trials,
      estimated_reliability: res.estimated_reliability,
      standard_error: res.standard_error,
      confidence_interval_95: res.confidence_interval_95,
      failure_probability: res.failure_probability,
      fail_target: res.fail_target,
      active_components_distribution: res.active_components_distribution,
      execution_time_ms: res.execution_time_ms,
    }
  }

  reliabilitySweep(req: SweepRequestBody): SweepResponseBody {
    const trials = req.trials_per_prob ?? 100
    const failTarget = req.fail_target ?? 'edges'
    const points = req.probs.map((prob) => {
      const res = this.simulate({ ...req, failure_prob: prob, trials, fail_target: failTarget })
      return {
        prob,
        reliability: res.estimated_reliability,
        standard_error: res.standard_error,
        connected_trials: res.connected_trials,
        total_trials: res.trials,
      }
    })
    return { points, trials_per_prob: trials, fail_target: failTarget }
  }
}
