import { whatsappUrl } from '../lib/db'
import type { Attendee } from '../lib/types'
import type { ReactElement } from 'react'

/**
 * "Connect" = abrir su perfil, nada de mensajeria in-app (seccion 2 del
 * CLAUDE.md). GitHub es el canal primario, siempre visible (o el fallback si
 * no lo compartio). LinkedIn/WhatsApp son botones-icono secundarios, y solo
 * aparecen si esa persona los agrego en el onboarding.
 */
export default function ConnectRow({ attendee }: { attendee: Attendee }) {
  const secondary = [
    attendee.linkedin
      ? { key: 'linkedin', href: attendee.linkedin, label: 'LinkedIn', icon: <LinkedinIcon /> }
      : null,
    attendee.whatsapp
      ? { key: 'whatsapp', href: whatsappUrl(attendee.whatsapp), label: 'WhatsApp', icon: <WhatsappIcon /> }
      : null,
  ].filter((c): c is { key: string; href: string; label: string; icon: ReactElement } => c !== null)

  return (
    <div className="mt-4">
      {attendee.github ? (
        <a
          href={`https://github.com/${attendee.github}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-night px-3.5 py-2.5 font-display text-[13px] font-medium tracking-[-0.005em] text-ink transition-colors hover:border-signal hover:text-signal"
        >
          <span>Connect on GitHub</span>
          <span className="font-mono text-[11px] opacity-60">↗</span>
        </a>
      ) : (
        <p className="font-mono text-xs text-muted">No GitHub shared</p>
      )}

      {secondary.length > 0 ? (
        <div className="mt-2 flex gap-2">
          {secondary.map((c) => (
            <a
              key={c.key}
              href={c.href}
              target="_blank"
              rel="noreferrer"
              aria-label={c.label}
              title={c.label}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-signal hover:text-signal"
            >
              {c.icon}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function LinkedinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.13 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V23h-4V8.5zM8.5 8.5h3.83v1.98h.05c.53-1 1.84-2.06 3.79-2.06 4.06 0 4.81 2.67 4.81 6.14V23h-4v-6.5c0-1.55-.03-3.54-2.16-3.54-2.16 0-2.49 1.69-2.49 3.43V23h-4V8.5z" />
    </svg>
  )
}

function WhatsappIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.12-2.9-6.99A9.82 9.82 0 0 0 12.04 2zm5.78 14.13c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11a15.6 15.6 0 0 1-1.62-.6c-2.85-1.23-4.7-4.1-4.85-4.29-.14-.19-1.16-1.55-1.16-2.96 0-1.4.74-2.09 1-2.38.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.81 2 .88 2.15.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.45.12.61-.07.17-.19.7-.82.89-1.1.19-.28.38-.23.63-.14.26.09 1.66.79 1.94.93.28.14.47.21.54.33.07.12.07.68-.17 1.36z" />
    </svg>
  )
}
