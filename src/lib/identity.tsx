import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { EVENT_SLUG, getAttendeeByToken, getEvent, registerAttendee } from './db'
import type { Attendee, Event, OnboardInput } from './types'

/**
 * Identidad sin auth (seccion 4 del CLAUDE.md), ahora por-evento.
 * El evento activo se resuelve de la URL (/e/:slug); si no hay slug en la
 * ruta, cae al ultimo evento usado y despues al EVENT_SLUG de siempre. Cada
 * evento tiene su propio device_token en localStorage, asi el mismo celular
 * puede estar registrado en varios eventos sin pisarse.
 */
const ACTIVE_SLUG_KEY = 'overlap.active_slug'
/** Key global de antes del multi-evento — un attendee ya vive ahi para el evento default. */
const LEGACY_TOKEN_KEY = 'overlap.device_token'

function tokenKeyFor(slug: string): string {
  return `overlap.device_token.${slug}`
}

function slugFromPath(pathname: string): string | null {
  const match = /^\/e\/([^/]+)/.exec(pathname)
  return match ? decodeURIComponent(match[1]) : null
}

function readActiveSlug(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SLUG_KEY)
  } catch {
    return null
  }
}

function writeActiveSlug(slug: string): void {
  try {
    localStorage.setItem(ACTIVE_SLUG_KEY, slug)
  } catch {
    // modo privado / storage bloqueado: la sesion dura lo que dure la pestana
  }
}

function readToken(slug: string): string | null {
  try {
    const scoped = localStorage.getItem(tokenKeyFor(slug))
    if (scoped) return scoped
    // Compat: la sesion de antes del multi-evento vivia en una key global y
    // siempre era del evento default. No perder ese registro.
    return slug === EVENT_SLUG ? localStorage.getItem(LEGACY_TOKEN_KEY) : null
  } catch {
    return null
  }
}

function writeToken(slug: string, token: string): void {
  try {
    localStorage.setItem(tokenKeyFor(slug), token)
  } catch {
    // modo privado / storage bloqueado: la sesion dura lo que dure la pestana
  }
}

function clearToken(slug: string): void {
  try {
    localStorage.removeItem(tokenKeyFor(slug))
    if (slug === EVENT_SLUG) localStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    /* no-op */
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
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [me, setMe] = useState<Attendee | null>(null)

  const slug = useMemo(
    () => slugFromPath(location.pathname) ?? readActiveSlug() ?? EVENT_SLUG,
    [location.pathname],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const ev = await getEvent(slug)
        if (cancelled) return
        setEvent(ev)

        const token = readToken(slug)
        if (token) {
          const attendee = await getAttendeeByToken(token)
          if (cancelled) return
          setMe(attendee)
        } else {
          setMe(null)
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
  }, [slug])

  const register = useCallback(
    async (input: OnboardInput) => {
      if (!event) throw new Error('El evento todavia no cargo')
      const attendee = await registerAttendee(event.id, input)
      writeToken(slug, attendee.device_token)
      writeActiveSlug(slug)
      setMe(attendee)
      return attendee
    },
    [event, slug],
  )

  const signOut = useCallback(() => {
    clearToken(slug)
    setMe(null)
  }, [slug])

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
