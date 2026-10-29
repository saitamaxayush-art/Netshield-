import { useBoxSize } from '../graph/useBoxSize'

export interface ConvergencePoint {
  done: number
  estimate: number
  se: number
}

const M = { l: 36, r: 12, t: 12, b: 26 }
const yTicks = [0, 0.25, 0.5, 0.75, 1]

function Axes({ w, h, xTicks, xFmt }: { w: number; h: number; xTicks: number[]; xFmt: (v: number) => string }) {
  const iw = w - M.l - M.r
  const ih = h - M.t - M.b
  return (
    <g>
      {yTicks.map((t) => {
        const y = M.t + (1 - t) * ih
        return (
          <g key={t}>
            <line x1={M.l} x2={w - M.r} y1={y} y2={y} stroke="var(--c-700)" strokeWidth={1} />
            <text x={M.l - 8} y={y + 3.5} textAnchor="end">
              {t.toFixed(2)}
            </text>
          </g>
        )
      })}
      {xTicks.map((t, i) => {
        const x = M.l + (i / (xTicks.length - 1)) * iw
        return (
          <text key={t} x={x} y={h - 8} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
            {xFmt(t)}
          </text>
        )
      })}
    </g>
  )
}

/** Running estimate against trials, with the 95% band and the exact value as a dashed reference. */
export function ConvergenceChart({ points, trials, exact }: { points: ConvergencePoint[]; trials: number; exact: number | null }) {
  const [ref, size] = useBoxSize<HTMLDivElement>()
  const last = points[points.length - 1]
  return (
    <div ref={ref} style={{ width: '100%', aspectRatio: '16 / 7', minHeight: 180 }}>
      {size && (
        <svg
          className="ns-chart"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          role="img"
          aria-label={
            last
              ? `Running estimate after ${last.done} of ${trials} trials: ${last.estimate.toFixed(3)}.${exact !== null ? ` Exact value ${exact.toFixed(3)}.` : ''}`
              : 'No trials run yet.'
          }
        >
          {(() => {
            const iw = size.w - M.l - M.r
            const ih = size.h - M.t - M.b
            const X = (d: number) => M.l + (d / trials) * iw
            const Y = (v: number) => M.t + (1 - Math.min(1, Math.max(0, v))) * ih
            const band =
              points.length > 1
                ? `M${points.map((p) => `${X(p.done).toFixed(1)},${Y(p.estimate + 1.96 * p.se).toFixed(1)}`).join('L')}L${[...points]
                    .reverse()
                    .map((p) => `${X(p.done).toFixed(1)},${Y(p.estimate - 1.96 * p.se).toFixed(1)}`)
                    .join('L')}Z`
                : ''
            const line = points.length ? `M${points.map((p) => `${X(p.done).toFixed(1)},${Y(p.estimate).toFixed(1)}`).join('L')}` : ''
            return (
              <>
                <Axes w={size.w} h={size.h} xTicks={[0, trials / 2, trials]} xFmt={(v) => `${Math.round(v)}`} />
                {band && <path d={band} fill="var(--s-100)" opacity={0.08} />}
                {exact !== null && <line x1={M.l} x2={size.w - M.r} y1={Y(exact)} y2={Y(exact)} stroke="var(--s-500)" strokeDasharray="4 4" strokeWidth={1} />}
                {line && <path d={line} fill="none" stroke="var(--s-50)" strokeWidth={1.5} strokeLinejoin="round" />}
                {last && <rect x={X(last.done) - 3} y={Y(last.estimate) - 3} width={6} height={6} fill="var(--r-500)" />}
              </>
            )
          })()}
        </svg>
      )}
    </div>
  )
}

export interface SweepPoint {
  p: number
  estimate: number
  se: number
}

/** Reliability against failure probability: Monte Carlo points with 95% bars and the exact curve. */
export function SweepChart({ points, exactCurve, currentP, pMax }: { points: SweepPoint[]; exactCurve: Array<[number, number]>; currentP: number; pMax: number }) {
  const [ref, size] = useBoxSize<HTMLDivElement>()
  return (
    <div ref={ref} style={{ width: '100%', aspectRatio: '16 / 7', minHeight: 180 }}>
      {size && (
        <svg
          className="ns-chart"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          role="img"
          aria-label={`Reliability against link failure probability from ${points.length} Monte Carlo runs. ${points
            .map((p) => `p ${p.p.toFixed(2)}: ${p.estimate.toFixed(2)}`)
            .join(', ')}.`}
        >
          {(() => {
            const iw = size.w - M.l - M.r
            const ih = size.h - M.t - M.b
            const X = (p: number) => M.l + (p / pMax) * iw
            const Y = (v: number) => M.t + (1 - Math.min(1, Math.max(0, v))) * ih
            const curve = exactCurve.length ? `M${exactCurve.map(([p, v]) => `${X(p).toFixed(1)},${Y(v).toFixed(1)}`).join('L')}` : ''
            return (
              <>
                <Axes w={size.w} h={size.h} xTicks={[0, pMax / 2, pMax]} xFmt={(v) => `p ${v.toFixed(2)}`} />
                <line x1={X(currentP)} x2={X(currentP)} y1={M.t} y2={size.h - M.b} stroke="var(--s-500)" strokeDasharray="2 3" />
                {curve && <path d={curve} fill="none" stroke="var(--s-500)" strokeWidth={1} />}
                {points.map((pt) => (
                  <g key={pt.p} className="ns-pop">
                    <line x1={X(pt.p)} x2={X(pt.p)} y1={Y(pt.estimate + 1.96 * pt.se)} y2={Y(pt.estimate - 1.96 * pt.se)} stroke="var(--s-100)" strokeWidth={1} />
                    <rect x={X(pt.p) - 3} y={Y(pt.estimate) - 3} width={6} height={6} fill="var(--s-50)" />
                  </g>
                ))}
              </>
            )
          })()}
        </svg>
      )}
    </div>
  )
}
