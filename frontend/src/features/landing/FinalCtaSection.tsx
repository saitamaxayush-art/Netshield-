import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/layout/Container'

export const FinalCtaSection: React.FC = () => {
  return (
    <section className="py-24 border-t border-border-subtle bg-bg-surface relative overflow-hidden">
      {/* Subtle architectural background grid */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#2F364E 1px, transparent 1px), linear-gradient(90deg, #2F364E 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />

      {/* Decorative hairline circuit trace */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-accent-teal/60 to-transparent pointer-events-none" />

      <Container size="content" className="relative text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-bg-primary border border-border-strong rounded-[2px] mb-6">
          <Terminal className="w-3.5 h-3.5 text-accent-teal" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
            Interactive Laboratory
          </span>
        </div>

        <h2 className="headline-sub text-text-primary mb-4">
          Begin Network Reliability Simulation
        </h2>

        <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed mb-8">
          Launch the Network Studio to model custom graphs, simulate component breakdowns,
          and calculate Monte Carlo connectivity metrics.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/studio">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Open Simulator
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="lg">
              View Metrics Dashboard
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  )
}
