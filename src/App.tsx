import type { ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useIdentity } from './lib/identity'
import { supabaseConfigured } from './lib/supabase'
import Nav from './components/Nav'
import Onboard from './screens/Onboard'
import CreateEvent from './screens/CreateEvent'
import Capture from './screens/Capture'
import Gallery from './screens/Gallery'
import Dossier from './screens/Dossier'

function Splash({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <div>{children}</div>
    </main>
  )
}

export default function App() {
  const { loading, error, me } = useIdentity()
  const location = useLocation()

  // Falla explicita en vez de pantalla en blanco: las VITE_* se hornean al
  // buildear, asi que esto casi siempre significa "faltan en el env de Vercel".
  if (!supabaseConfigured) {
    return (
      <Splash>
        <h1 className="font-display text-2xl font-medium text-ink">Not configured</h1>
        <p className="mt-3 max-w-xs font-mono text-sm text-muted">
          Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build time. Set them in the
          Vercel env and redeploy.
        </p>
      </Splash>
    )
  }

  // Crear evento no depende de la identidad del evento activo — vive fuera
  // del resto del flujo (organizador != necesariamente asistente todavia).
  if (location.pathname === '/new') {
    return <CreateEvent />
  }

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
        <h1 className="font-display text-2xl font-medium text-ink">Can&rsquo;t reach the event</h1>
        <p className="mt-3 font-mono text-sm text-muted">{error}</p>
      </Splash>
    )
  }

  // Sin identidad no hay app: el onboarding es la unica puerta.
  if (!me) {
    return (
      <Routes>
        <Route path="*" element={<Onboard />} />
      </Routes>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/add" element={<Capture />} />
        <Route path="/you" element={<Dossier />} />
        {/* Sin Navigate a proposito: justo despues de registrarse, `me` pasa a
            truthy en un render donde la URL todavia no cambio (Onboard llama
            a navigate('/add') recien en el siguiente tick). Un <Navigate>
            aca dispara SU PROPIA navegacion y le gana la carrera al replace
            de Onboard, dejando al usuario varado en /gallery. Renderizar
            Gallery inline (sin tocar el history) evita la carrera. */}
        <Route path="*" element={<Gallery />} />
      </Routes>
      <Nav />
    </>
  )
}
