import React from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'
import { Network, ArrowLeft } from 'lucide-react'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="app-page min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <Navbar />

      <main className="flex-1 flex flex-col justify-center">
        <Container size="narrow" className="py-24 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-[2px] bg-bg-surface border border-border-strong flex items-center justify-center text-state-failure mb-4">
            <Network className="w-6 h-6" />
          </div>

          <div className="text-xs font-mono uppercase tracking-widest text-state-failure mb-2">
            Error 404: Unreachable Node
          </div>

          <h1 className="headline-sub text-text-primary mb-3">
            Disconnected Endpoint
          </h1>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed mb-6 max-w-md">
            The requested route does not exist in the NetShield topological graph. Return to the
            homepage or launch the simulator directly.
          </p>

          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="outline" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Return Home
              </Button>
            </Link>
            <Link to="/studio">
              <Button variant="primary" size="md">
                Open Simulator
              </Button>
            </Link>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  )
}

export default NotFoundPage
