import { useMemo } from 'react'
import { useIdentity } from '../lib/identity'
import { useEventData } from '../lib/useEventData'
import { overlapsFor, photosFor, sharedMoment, timeOf } from '../lib/graph'
import { photoUrl } from '../lib/supabase'
import { whatsappUrl } from '../lib/db'
import Avatar from '../components/Avatar'
import Constellation from '../components/Constellation'
import type { Attendee, Photo } from '../lib/types'
import type { Overlap } from '../lib/graph'

/** El climax de la demo: el grafo de esta sala. Data, no LLM. */
export default function Dossier() {
  const { event, me } = useIdentity()
  const { photos, attendees, tags, loading } = useEventData(event?.id)

  const byId = useMemo(
    () => new Map<string, Attendee>(attendees.map((a) => [a.id, a])),
    [attendees],
  )

  const overlaps = useMemo(
    () => (me ? overlapsFor(me.id, tags, byId) : []),
    [me, tags, byId],
  )
  const myPhotos = useMemo(
    () => (me ? photosFor(me.id, tags, photos) : []),
    [me, tags, photos],
  )

  if (!me) return null

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-28">
      <header className="py-6">
        <p className="font-mono text-xs tracking-widest text-signal uppercase">
          {event?.name ?? 'Tonight'}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-bold text-ink">
          Your night&rsquo;s overlap
        </h1>
      </header>

      {loading && tags.length === 0 ? (
        <p className="py-16 text-center font-mono text-sm text-muted">Loading…</p>
      ) : overlaps.length === 0 ? (
        <EmptyGraph claimed={myPhotos.length} />
      ) : (
        <>
          <Constellation me={me} overlaps={overlaps} />

          <p className="mt-4 text-center text-sm text-muted">
            You crossed paths with{' '}
            <span className="font-display font-bold text-ink">{overlaps.length}</span>{' '}
            {overlaps.length === 1 ? 'person' : 'people'} across{' '}
            <span className="font-display font-bold text-ink">{myPhotos.length}</span>{' '}
            {myPhotos.length === 1 ? 'photo' : 'photos'}.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {overlaps.map((o) => (
              <OverlapCard key={o.attendee.id} overlap={o} photos={photos} />
            ))}
          </ul>
        </>
      )}

      {myPhotos.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-ink">Your photos</h2>
          <p className="mt-1 text-sm text-muted">
            {myPhotos.length} {myPhotos.length === 1 ? 'photo' : 'photos'} you&rsquo;re in.
            Long-press to save.
          </p>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {myPhotos.map((p) => (
              <li key={p.id} className="aspect-square overflow-hidden rounded-lg bg-surface">
                <a href={photoUrl(p.storage_path)} target="_blank" rel="noreferrer">
                  <img
                    src={photoUrl(p.storage_path)}
                    alt={p.scene_description ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}

function EmptyGraph({ claimed }: { claimed: number }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border px-5 py-10 text-center">
      <p className="text-sm text-muted">
        {claimed === 0
          ? 'Your constellation lights up once you claim the photos you’re in. Head to the gallery and tap "That’s me".'
          : 'You’ve claimed your photos. Your constellation lights up as soon as someone else claims one of the same shots.'}
      </p>
    </div>
  )
}

function OverlapCard({ overlap, photos }: { overlap: Overlap; photos: Photo[] }) {
  const { attendee, weight, photoIds } = overlap
  const moment = sharedMoment(overlap, photos)
  const evidence = photos.filter((p) => photoIds.includes(p.id)).slice(0, 3)

  return (
    <li className="rounded-2xl bg-surface p-4">
      <div className="flex items-start gap-3">
        <Avatar name={attendee.name} color={attendee.avatar_color} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-bold text-ink">
            {attendee.name}
          </p>
          {attendee.building ? (
            <p className="mt-0.5 truncate text-sm text-muted">{attendee.building}</p>
          ) : null}
        </div>
        <span
          className="shrink-0 rounded-full bg-signal/15 px-2.5 py-1 font-mono text-xs text-signal"
          title={`${weight} shared photo${weight === 1 ? '' : 's'}`}
        >
          ×{weight}
        </span>
      </div>

      {/* El momento compartido real. No inventamos de que hablaron. */}
      {moment ? <p className="mt-3 text-sm text-muted">{moment}</p> : null}

      {evidence.length > 0 ? (
        <ul className="mt-3 flex gap-2">
          {evidence.map((p) => (
            <li key={p.id} className="h-16 w-16 overflow-hidden rounded-lg bg-night">
              <img
                src={photoUrl(p.storage_path)}
                alt={p.scene_description ?? ''}
                loading="lazy"
                title={timeOf(p)}
                className="h-full w-full object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}

      <ConnectRow attendee={attendee} />
    </li>
  )
}

/**
 * "Connect" = abrir su perfil, nada de mensajeria in-app (seccion 2).
 * El primer canal disponible se lleva el dorado; el resto van de contorno.
 * GitHub primero porque el nicho es eventos dev.
 */
function ConnectRow({ attendee }: { attendee: Attendee }) {
  const channels = [
    attendee.github
      ? { key: 'github', label: 'Connect on GitHub', href: `https://github.com/${attendee.github}` }
      : null,
    attendee.whatsapp
      ? { key: 'whatsapp', label: 'WhatsApp', href: whatsappUrl(attendee.whatsapp) }
      : null,
    attendee.linkedin ? { key: 'linkedin', label: 'LinkedIn', href: attendee.linkedin } : null,
  ].filter((c): c is { key: string; label: string; href: string } => c !== null)

  if (channels.length === 0) {
    return <p className="mt-4 font-mono text-xs text-muted">No links shared</p>
  }

  return (
    <div className="mt-4 flex gap-2">
      {channels.map((c, i) => (
        <a
          key={c.key}
          href={c.href}
          target="_blank"
          rel="noreferrer"
          className={[
            'rounded-xl px-4 py-3 text-center font-display text-sm font-bold',
            i === 0
              ? 'flex-1 bg-signal text-night'
              : 'border border-border text-ink',
          ].join(' ')}
        >
          {c.label}
        </a>
      ))}
    </div>
  )
}
