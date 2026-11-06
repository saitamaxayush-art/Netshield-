import React, { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { clearSavedData, usePersistenceStatus } from '@/store/persistence'
import { Trash2, CheckCircle2 } from 'lucide-react'
import '@/store/bootstrap'

const h2 = 'text-sm font-semibold uppercase tracking-wider text-text-primary font-mono'
const review = 'inline-block px-2.5 py-1 bg-state-warning-dim border border-state-warning/30 rounded-[2px] text-state-warning text-[10px] font-mono'

export const PrivacyPage: React.FC = () => {
  const { saveError, loadProblem } = usePersistenceStatus()
  const [cleared, setCleared] = useState(false)

  const handleClear = () => {
    clearSavedData()
    setCleared(true)
    setTimeout(() => setCleared(false), 3000)
  }

  return (
    <div className="app-page min-h-screen flex flex-col bg-bg-primary text-text-primary">
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
            <div className="text-sm font-semibold text-text-primary mb-1">Saved in this browser</div>
            <p className="text-xs text-text-secondary max-w-lg">
              Your graph, canvas view and settings are saved under the <code>netshield_workspace</code> key in this browser&apos;s
              local storage. Clearing removes it and resets the studio to the star example.
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

        <div className="space-y-6 text-xs text-text-secondary leading-relaxed">
          <section className="space-y-2">
            <h2 className={h2}>1. What NetShield works with</h2>
            <p>
              NetShield is an educational project for studying graph reliability. It works only with the networks you build: node ids,
              labels and types, links with their optional weights and failure probabilities, which elements you marked failed, and your
              analysis and simulation settings. It does not ask for an account, a name or an email address.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>2. Stored in your browser</h2>
            <p>
              The graph, the canvas pan and zoom, and the settings are saved in <code>localStorage</code> under <code>netshield_workspace</code>
              (a versioned format; an older <code>netshield_graph_state_v1</code> entry is converted once and removed). Analysis and simulation
              results are never saved. Nothing is shared between browsers or devices. Use the button above, or Import or export, then Clear
              saved data in the studio tools, to remove it.
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

          <section className="space-y-2" data-testid="privacy-backend">
            <h2 className={h2}>3. Sent to the analysis server</h2>
            <p>
              The studio and dashboard send the whole current graph, including node labels, to the NetShield analysis server (a FastAPI
              application) each time they analyze it, which happens automatically shortly after every change, and when you run a
              simulation or a reliability sweep. App pages also check the server&apos;s health (a request with no graph data) when they open
              and when the window regains focus. Graphs are sent only to the server this app is configured to use (by default the same address that serves the app).
            </p>
            <p>
              The server computes the result in memory and returns it. It has no database and does not keep the graph after answering.
            </p>
          </section>

          <section className="space-y-2" data-testid="privacy-logging">
            <h2 className={h2}>4. What the server logs</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                One line per request, written to the server&apos;s standard error: time, a random request id, method, path (for example
                <code> /api/analyze</code>), status code, duration and request size in bytes. It never contains graph contents, labels or
                results.
              </li>
              <li>For an unexpected server error: the error type and the code locations involved, without the error text, which could contain data.</li>
              <li>
                The web server (uvicorn) also writes its own access line per request, which includes the client IP address and port, method,
                path and status code.
              </li>
            </ul>
            <div className={review}>
              Developer review required: how long these logs are kept, and who can read them, depends on where the server is hosted. State
              the hosting provider and retention period before deployment.
            </div>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>5. Demo mode</h2>
            <p>
              Demo mode starts only when you choose &quot;Use demo mode&quot; (or the app is built with it switched on). Results are then
              computed in your browser and labelled Demo result, and no graph is sent to the server. The health check described above still
              runs, so the app can tell you when the server is back.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>6. Third parties</h2>
            <p>
              Every page loads fonts (Inter, JetBrains Mono, Newsreader, Cormorant Garamond) from Google Fonts, so your browser contacts
              Google&apos;s font servers, which receive your IP address and browser details under Google&apos;s own policy. The landing page
              also ships local copies of its fonts. There are no cookies, analytics, tracking or advertising scripts.
            </p>
            <div className={review}>Developer review required: confirm that loading Google Fonts is acceptable for the intended audience, or self host all fonts.</div>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>7. Security limits</h2>
            <p>
              NetShield is an academic demonstration. It offers no accounts, encryption at rest or tenant isolation. Do not enter sensitive or
              production network details.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>8. Contact</h2>
            <p>For questions about this project, see the project repository or contact the course instructor.</p>
            <div className={review}>Developer review required: add the course specific contact details before deployment.</div>
          </section>
        </div>
        </Container>
      </main>

      <Footer />
    </div>
  )
}

export default PrivacyPage
