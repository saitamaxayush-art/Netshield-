import React, { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { clearSavedData, usePersistenceStatus } from '@/store/persistence'
import { Trash2, CheckCircle2 } from 'lucide-react'
import '@/store/bootstrap'

export const PrivacyPage: React.FC = () => {
  const { saveError, loadProblem } = usePersistenceStatus()
  const [cleared, setCleared] = useState(false)

  const handleClear = () => {
    clearSavedData()
    setCleared(true)
    setTimeout(() => setCleared(false), 3000)
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <Navbar />

      <main className="flex-1">
        <Container size="narrow" className="pt-28 pb-16 space-y-8">
        <div className="pb-6 border-b border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="accent">Legal Disclosure</Badge>
            <span className="text-xs text-text-muted font-mono">Real Data Flow</span>
          </div>
          <h1 className="headline-sub text-text-primary">Privacy Policy</h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Transparent disclosure of local browser storage and computational data processing.
          </p>
        </div>

        {/* Working Clear Saved Data Action */}
        <div className="p-5 bg-bg-surface border border-border-strong rounded-[4px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-text-primary mb-1">
              Browser Local Storage Persistence
            </div>
            <p className="text-xs text-text-secondary max-w-lg">
              NetShield stores your active graph vertices, connections, and simulation settings
              exclusively within your local browser storage (`netshield_graph_state_v1`). You can purge this at any time.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            leftIcon={cleared ? <CheckCircle2 className="w-4 h-4 text-state-success" /> : <Trash2 className="w-4 h-4" />}
            onClick={handleClear}
          >
            {cleared ? 'Data Cleared' : 'Clear Saved Data'}
          </Button>
        </div>

        {/* Legal Disclosures */}
        <div className="space-y-6 text-xs text-text-secondary leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              1. Information Processed
            </h2>
            <p>
              NetShield is an educational software project designed for the study of discrete mathematics
              and graph-theoretic reliability. The system processes user-created graph structures,
              specifically nodes (identifiers, labels, and types) and edges (connection pairs, weights,
              and failure flags). No personal identifying information (PII) is required, collected, or stored.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              2. Browser Storage &amp; Persistence
            </h2>
            <p>
              Your graph and simulation settings are saved in this browser only, with the `localStorage` API
              (key `netshield_workspace`), so the studio restores them on your next visit. Analysis and simulation
              results are never saved. No cookies are used for tracking, sessions, or advertising.
            </p>
            {saveError && (
              <p role="alert" data-testid="persistence-save-error" className="text-state-failure">
                {saveError}
              </p>
            )}
            {loadProblem && (
              <p role="status" data-testid="persistence-load-problem" className="text-state-warning">
                Saved data was not loaded. {loadProblem}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              3. Backend Processing &amp; Demo Adapter
            </h2>
            <p>
              When connected to an active FastAPI backend service, graph structures are transmitted via HTTP
              POST requests to compute algorithm results (e.g. Tarjan bridge detection, articulation cuts,
              and Monte Carlo trials). Graphs are processed strictly in-memory during request execution and
              are not retained in any backend database. When the backend service is offline, all computations
              execute locally in the browser through a deterministic demo adapter.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              4. Third-Party Services
            </h2>
            <p>
              The application loads typography assets (Newsreader, Inter, and JetBrains Mono) from Google Fonts
              content delivery networks. No third-party tracking, analytics scripts, or advertising SDKs are installed.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              5. Security Limitations
            </h2>
            <p>
              NetShield is developed as an academic semester demonstration. The application does not provide
              cryptographic storage guarantees or enterprise tenant isolation. Users should not input sensitive,
              proprietary, or production network configurations into the public simulator.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary font-mono">
              6. Developer Contact
            </h2>
            <p>
              For technical queries regarding this academic semester project codebase, please inspect the
              project repository or contact the project instructor.
            </p>
            <div className="inline-block px-2.5 py-1 bg-state-warning-dim border border-state-warning/30 rounded-[2px] text-state-warning text-[10px] font-mono">
              Developer review required: Verify course-specific instructor contact protocol before final deployment.
            </div>
          </section>
        </div>
        </Container>
      </main>

      <Footer />
    </div>
  )
}

export default PrivacyPage
