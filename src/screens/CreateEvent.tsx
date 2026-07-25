import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import QRCode from 'qrcode'
import { createEvent } from '../lib/db'
import Field from '../components/Field'
import TopBar from '../components/TopBar'
import type { Event } from '../lib/types'

/** Organizador: crea un evento y se lleva el QR para compartir en la puerta. */
export default function CreateEvent() {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Event | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return

    setSaving(true)
    setError(null)
    try {
      setCreated(await createEvent(name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  if (created) return <EventReady event={created} />

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar label="New event" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <header className="mb-8">
          <h1 className="font-display text-4xl leading-tight font-medium text-ink">
            Name your event
          </h1>
          <p className="mt-3 text-sm text-muted">
            You&rsquo;ll get a QR code to share at the door — anyone who scans it joins this
            event.
          </p>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field
            label="Event name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hack the Loop '26"
            autoComplete="off"
            required
            autoFocus
          />

          {error ? (
            <p role="alert" className="rounded-xl bg-signal/10 px-4 py-3 text-sm text-signal">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="mt-2 rounded-xl bg-signal px-5 py-4 font-display text-base font-medium text-night transition-opacity disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create event'}
          </button>
        </form>
      </main>
    </div>
  )
}

function EventReady({ event }: { event: Event }) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const joinUrl = `${window.location.origin}/e/${event.slug}`

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#16151A', light: '#EFEBE2' },
    })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {
        /* si falla, queda el link de abajo para copiar a mano */
      })
    return () => {
      cancelled = true
    }
  }, [joinUrl])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard bloqueado (permiso/http) — el link ya esta visible para copiar a mano
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar label={event.name} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
          Event ready
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-medium text-ink">
          {event.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Scan to join — this is what goes on the door tonight.
        </p>

        <div className="mt-6 h-[220px] w-[220px] overflow-hidden rounded-lg border border-border bg-surface p-3">
          {qr ? (
            <img src={qr} alt={`QR code linking to ${joinUrl}`} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">
              Generating…
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={copyLink}
          className="mt-5 w-full truncate rounded-xl border border-border bg-night px-4 py-3 font-mono text-xs text-ink transition-colors hover:border-signal hover:text-signal"
        >
          {copied ? 'Copied!' : joinUrl}
        </button>

        <a
          href={`/e/${event.slug}`}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-signal px-5 py-4 font-display text-base font-medium text-night"
        >
          I&rsquo;m attending too →
        </a>
      </main>
    </div>
  )
}
