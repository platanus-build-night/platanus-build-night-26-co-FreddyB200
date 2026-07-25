import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getAttendeeByToken, getEvent, registerAttendee } from './db'
import type { Attendee, Event, OnboardInput } from './types'

/**
 * Identidad sin auth (seccion 4 del CLAUDE.md).
 * El device_token vive en localStorage. En este browser el usuario "es" ese
 * attendee para siempre. Sin email, sin password, sin recuperacion.
 */
const TOKEN_KEY = 'overlap.device_token'

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // modo privado / storage bloqueado: la sesion dura lo que dure la pestana
  }
}

type IdentityState = {
  loading: boolean
  error: string | null
  event: Event | null
  me: Attendee | null
  register: (input: OnboardInput) => Promise<Attendee>
  signOut: () => void
}

const IdentityContext = createContext<IdentityState | null>(null)

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [me, setMe] = useState<Attendee | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const ev = await getEvent()
        if (cancelled) return
        setEvent(ev)

        const token = readToken()
        if (token) {
          const attendee = await getAttendeeByToken(token)
          if (cancelled) return
          setMe(attendee)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const register = useCallback(
    async (input: OnboardInput) => {
      if (!event) throw new Error('El evento todavia no cargo')
      const attendee = await registerAttendee(event.id, input)
      writeToken(attendee.device_token)
      setMe(attendee)
      return attendee
    },
    [event],
  )

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* no-op */
    }
    setMe(null)
  }, [])

  const value = useMemo<IdentityState>(
    () => ({ loading, error, event, me, register, signOut }),
    [loading, error, event, me, register, signOut],
  )

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
}

export function useIdentity(): IdentityState {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity debe usarse dentro de <IdentityProvider>')
  return ctx
}
