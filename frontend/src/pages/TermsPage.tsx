import React from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Container } from '@/components/layout/Container'
import { Badge } from '@/components/ui/Badge'

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <Navbar />

      <main className="flex-1">
        <Container size="narrow" className="pt-28 pb-16 space-y-8">
        <div className="pb-6 border-b border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="accent">Legal Disclosure</Badge>
            <span className="text-xs text-text-muted font-mono">Academic Framework</span>
          </div>
          <h1 className="headline-sub text-text-primary">Terms of Use</h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Usage guidelines and mathematical simulation boundaries for the NetShield project.
          </p>
        </div>

        <div className="space-y-6 text-xs text-text-secondary leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              1. Educational Scope
            </h2>
            <p>
              NetShield is an academic semester project created for educational coursework in Discrete
              Mathematics and Computer Science. The application provides an interactive visualization
              platform for graph-theoretic algorithms (including connected components, bridges, and cut
              vertices). It is provided free of charge for study, instruction, and academic demonstration.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              2. Simulation Assumptions &amp; Limitations
            </h2>
            <p>
              All reliability metrics and Monte Carlo calculations produced by NetShield rely on formal
              mathematical abstractions. Specifically, component failures are modeled as independent Bernoulli
              trials with uniform or user-specified probabilities. Real computer networks involve complex
              physical correlation, cascading electrical failures, protocol routing delays, and asymmetric
              traffic loads that are deliberately abstracted away in this educational discrete graph model.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              3. No Guarantee of Real-World Security
            </h2>
            <p>
              NetShield is not a commercial cybersecurity suite, vulnerability scanner, or critical infrastructure
              firewall. Output metrics, bridge identifications, and estimated reliability curves must not be used
              as safety-critical architectural guarantees for live production systems, industrial control
              networks, or emergency communications.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              4. Acceptable Use
            </h2>
            <p>
              Users agree to utilize NetShield solely for lawful educational and investigative purposes.
              Users must not attempt to disrupt the web service, flood the API endpoints with automated denial-of-service
              traffic, or reverse-engineer backend servers beyond acceptable academic evaluation.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              5. Intellectual Property
            </h2>
            <p>
              Code and interface design remain the academic property of the project student developers,
              submitted in fulfillment of university coursework. The source code may be subject to open-source
              educational licensing as documented in the repository.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              6. Service Availability &amp; Disclaimer of Liability
            </h2>
            <p>
              The application is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without
              warranty of any kind, whether express, implied, or statutory. The developers assume no liability
              for any direct, indirect, incidental, or consequential loss arising from the use or inability to use
              this experimental educational tool.
            </p>
            <div className="inline-block px-2.5 py-1 bg-state-warning-dim border border-state-warning/30 rounded-[2px] text-state-warning text-[10px] font-mono">
              Developer review required: Verify course-specific legal disclaimers and submission deadlines.
            </div>
          </section>
        </div>
        </Container>
      </main>

      <Footer />
    </div>
  )
}

export default TermsPage
