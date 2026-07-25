import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useIdentity } from './lib/identity'
import Onboard from './screens/Onboard'
import Capture from './screens/Capture'

function Splash({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <div>{children}</div>
    </main>
  )
}

export default function App() {
  const { loading, error, me } = useIdentity()

  if (loading) {
    return (
      <Splash>
        <p className="font-mono text-sm text-muted">Loading…</p>
      </Splash>
    )
  }

  if (error) {
    return (
      <Splash>
        <h1 className="font-display text-2xl font-bold text-ink">Can&rsquo;t reach the event</h1>
        <p className="mt-3 font-mono text-sm text-muted">{error}</p>
      </Splash>
    )
  }

  return (
    <Routes>
      <Route path="/" element={me ? <Navigate to="/add" replace /> : <Onboard />} />
      <Route path="/add" element={me ? <Capture /> : <Navigate to="/" replace />} />
      {/* Capas 2 y 3 (galeria + auto-tag, grafo + dossier) se montan aca despues. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
