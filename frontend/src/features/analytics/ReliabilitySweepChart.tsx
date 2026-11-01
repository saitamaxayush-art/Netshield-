import React, { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { SweepPoint } from '@/services/api/contract'
import type { ResultSource } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Table, Eye } from 'lucide-react'

interface ReliabilitySweepChartProps {
  points: SweepPoint[]
  source: ResultSource
}

export const ReliabilitySweepChart: React.FC<ReliabilitySweepChartProps> = ({
  points,
  source,
}) => {
  const [showTable, setShowTable] = useState(false)

  const chartData = points.map((pt) => ({
    prob: (pt.prob * 100).toFixed(0) + '%',
    probVal: pt.prob,
    reliability: Number((pt.reliability * 100).toFixed(1)),
    ciLow: Number((Math.max(0, pt.reliability - 1.96 * pt.standard_error) * 100).toFixed(1)),
    ciHigh: Number((Math.min(1, pt.reliability + 1.96 * pt.standard_error) * 100).toFixed(1)),
    connected: pt.connected_trials,
    total: pt.total_trials,
  }))

  const first = points[0]
  const last = points[points.length - 1]
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`

  return (
    <div className="space-y-3">
      {first && last && (
        <p className="text-[10px] font-mono text-text-muted" data-testid="sweep-summary" data-source={source}>
          {points.length} points from {source === 'demo' ? 'the demo adapter' : 'the FastAPI backend'}: R = {pct(first.reliability)} at p ={' '}
          {pct(first.prob)} to R = {pct(last.reliability)} at p = {pct(last.prob)}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono text-text-muted uppercase">
          Reliability vs. Failure Probability {source === 'demo' && '(Demo result)'}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-[11px] py-1 px-2 h-auto"
          leftIcon={showTable ? <Eye className="w-3 h-3" /> : <Table className="w-3 h-3" />}
          onClick={() => setShowTable(!showTable)}
        >
          {showTable ? 'View Chart' : 'View Data Table'}
        </Button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto border border-border-subtle rounded-[2px]">
          <table className="w-full text-left font-mono text-[10px]">
            <thead className="bg-bg-primary text-text-muted border-b border-border-subtle">
              <tr>
                <th className="p-2">Fail Prob (p)</th>
                <th className="p-2">Reliability R(p)</th>
                <th className="p-2">Connected / Total</th>
                <th className="p-2">95% CI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {chartData.map((d, i) => (
                <tr key={i} className="hover:bg-bg-surface-hover">
                  <td className="p-2 text-text-primary">{d.prob}</td>
                  <td className="p-2 text-accent-teal font-semibold">{d.reliability}%</td>
                  <td className="p-2 text-text-secondary">
                    {d.connected} / {d.total}
                  </td>
                  <td className="p-2 text-text-muted">
                    [{d.ciLow}%, {d.ciHigh}%]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-48 w-full bg-bg-primary p-2 rounded-[2px] border border-border-subtle">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#222638" strokeDasharray="3 3" />
              <XAxis
                dataKey="prob"
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={10}
                domain={[0, 100]}
                unit="%"
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#181B28',
                  borderColor: '#2F364E',
                  borderRadius: '2px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#E9ECEE',
                }}
                formatter={(value: unknown) => {
                  const num = typeof value === 'number' ? value : Number(value) || 0
                  return [`${num.toFixed(1)}%`, 'Reliability']
                }}
              />
              <Line
                type="monotone"
                dataKey="reliability"
                stroke="#2DD4BF"
                strokeWidth={2}
                dot={{ fill: '#2DD4BF', r: 3 }}
                activeDot={{ r: 5, fill: '#38BDF8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-[10px] text-text-muted leading-tight">
        Monte Carlo curve over varying independent failure rates. Shows percolation degradation
        threshold where the network fragments with high probability.
      </p>
    </div>
  )
}
