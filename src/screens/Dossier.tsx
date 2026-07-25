import { useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useIdentity } from '../lib/identity'
import { useEventData } from '../lib/useEventData'
import { formatSpan, overlapsFor, photosFor, sharedRange, timeOf, timeRange } from '../lib/graph'
import { photoUrl } from '../lib/supabase'
import { whatsappUrl } from '../lib/db'
import Avatar from '../components/Avatar'
import TopBar from '../components/TopBar'
import PhotoLightbox from '../components/PhotoLightbox'
import type { Attendee, Photo } from '../lib/types'
import type { Overlap } from '../lib/graph'

const STRIP_CARD_W = 220
const STRIP_OVERLAP = 44

/** El climax de la demo: el recap de esta noche. Data, no LLM. */
export default function Dossier() {
  const { event, me } = useIdentity()
  const { photos, attendees, tags, loading } = useEventData(event?.id)
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null)

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
  const chronological = useMemo(
    () =>
      [...myPhotos].sort(
        (a, b) =>
          new Date(a.taken_at ?? a.created_at).getTime() -
          new Date(b.taken_at ?? b.created_at).getTime(),
      ),
    [myPhotos],
  )

  /** photo_id -> attendees que salen en ella, para el lightbox. */
  const cast = useMemo(() => {
    const map = new Map<string, Attendee[]>()
    for (const tag of tags) {
      const person = byId.get(tag.attendee_id)
      if (!person) continue
      const list = map.get(tag.photo_id)
      if (list) list.push(person)
      else map.set(tag.photo_id, [person])
    }
    return map
  }, [tags, byId])

  if (!me) return null

  const openPhoto = photos.find((p) => p.id === openPhotoId) ?? null

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-2xl pb-28">
        {loading && tags.length === 0 ? (
          <p className="py-16 text-center font-mono text-sm text-muted">Loading…</p>
        ) : myPhotos.length === 0 ? (
          <EmptyRecap />
        ) : (
          <>
            <Hero photos={myPhotos} overlapCount={overlaps.length} />
            <PhotoStrip photos={chronological} onOpen={setOpenPhotoId} />
            {overlaps.length > 0 ? (
              <PeopleSection overlaps={overlaps} photos={photos} onOpenPhoto={setOpenPhotoId} />
            ) : (
              <NoOverlapsYet />
            )}
            <Footer mine={myPhotos.length} total={photos.length} />
          </>
        )}
      </main>

      {openPhoto ? (
        <PhotoLightbox
          photo={openPhoto}
          people={cast.get(openPhoto.id) ?? []}
          onClose={() => setOpenPhotoId(null)}
        />
      ) : null}
    </>
  )
}

function Hero({ photos, overlapCount }: { photos: Photo[]; overlapCount: number }) {
  const span = formatSpan(timeRange(photos))
  const parts = [
    span,
    `${overlapCount} ${overlapCount === 1 ? 'person' : 'people'} who ended up in frame with you`,
  ].filter((p): p is string => Boolean(p))

  return (
    <div className="px-5 pt-8 pb-5" style={{ animation: 'ov-rise 0.6s cubic-bezier(0.2,0.7,0.2,1) both' }}>
      <p className="mb-3.5 font-mono text-[10px] tracking-[0.16em] text-muted uppercase">Your recap</p>
      <h1 className="text-pretty font-display text-[44px] leading-[0.98] font-medium tracking-[-0.035em] text-ink">
        You&rsquo;re in <span className="text-signal">{photos.length}</span>{' '}
        {photos.length === 1 ? 'photo' : 'photos'}
      </h1>
      {parts.length > 0 ? (
        <p className="mt-3 max-w-[300px] text-sm leading-relaxed text-muted">{parts.join(', ')}.</p>
      ) : null}
    </div>
  )
}

function PhotoStrip({ photos, onOpen }: { photos: Photo[]; onOpen: (id: string) => void }) {
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  function onScroll() {
    const el = ref.current
    if (!el) return
    const step = STRIP_CARD_W - STRIP_OVERLAP
    const i = Math.max(0, Math.min(photos.length - 1, Math.round(el.scrollLeft / step)))
    setIndex(i)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between px-5 pb-3 font-mono text-[11px] text-muted">
        <span>
          {String(index + 1).padStart(2, '0')} / {photos.length} in view
        </span>
        <span className="tracking-[0.1em] uppercase">Swipe</span>
      </div>

      <div
        ref={ref}
        onScroll={onScroll}
        className="flex items-start overflow-x-auto overflow-y-hidden px-5 pb-3.5 [-webkit-overflow-scrolling:touch] [scroll-snap-type:x_mandatory] [scrollbar-width:none]"
      >
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(photo.id)}
            className="relative shrink-0 border-0 bg-transparent p-0 [scroll-snap-align:center]"
            style={{
              marginLeft: i === 0 ? 0 : -STRIP_OVERLAP,
              zIndex: photos.length - i,
              transform: `rotate(${i % 2 === 0 ? -1.1 : 1.4}deg)`,
              animation: 'ov-rise 0.7s cubic-bezier(0.2,0.7,0.2,1) both',
              animationDelay: `${0.12 + i * 0.07}s`,
            }}
          >
            <div className="relative overflow-hidden rounded-sm border border-border bg-surface shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
              <img
                src={photoUrl(photo.storage_path)}
                alt={photo.scene_description ?? ''}
                loading="lazy"
                className="block h-[290px] w-[220px] object-cover"
              />
              <div
                className="absolute inset-x-0 bottom-0 px-3 py-2.5 pt-6"
                style={{ background: 'linear-gradient(to top, rgba(12,11,14,0.82), rgba(12,11,14,0))' }}
              >
                <span className="font-mono text-[10px] tracking-[0.08em] text-ink">{timeOf(photo)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 px-5 pt-3.5">
        {photos.map((_, i) => (
          <span
            key={i}
            className="h-0.5 flex-1 rounded-full"
            style={{ background: i === index ? 'var(--color-signal)' : 'var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Unifica lo que antes eran dos secciones ("Who you overlapped with" +
 * "Your matches"): el riel de caras es el indice, tocar una la expande inline.
 */
function PeopleSection({
  overlaps,
  photos,
  onOpenPhoto,
}: {
  overlaps: Overlap[]
  photos: Photo[]
  onOpenPhoto: (id: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const active = overlaps.find((o) => o.attendee.id === openId) ?? null

  return (
    <section className="mt-9 border-t border-border pt-7">
      <div className="px-5">
        <h2 className="font-display text-[21px] font-medium tracking-[-0.02em] text-ink">
          Who you overlapped with
        </h2>
        <p className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          Sorted by shared photos
        </p>
      </div>

      <div className="flex gap-3.5 overflow-x-auto px-5 pt-4 pb-1.5 [scrollbar-width:none]">
        {overlaps.map((o) => {
          const isOpen = o.attendee.id === openId
          return (
            <button
              key={o.attendee.id}
              type="button"
              onClick={() => setOpenId(isOpen ? null : o.attendee.id)}
              className="w-[68px] shrink-0 border-0 bg-transparent p-0 text-center"
            >
              <div className="relative mx-auto mb-2 h-16 w-16">
                <Avatar name={o.attendee.name} color={o.attendee.avatar_color} size={64} />
                {isOpen ? (
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-signal ring-offset-2 ring-offset-night" />
                ) : null}
              </div>
              <div className="truncate font-display text-xs font-medium text-ink">
                {firstName(o.attendee.name)}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-muted">
                {o.weight} {o.weight === 1 ? 'photo' : 'photos'}
              </div>
            </button>
          )
        })}
      </div>

      {active ? <ExpandedCard overlap={active} photos={photos} onOpenPhoto={onOpenPhoto} /> : null}
    </section>
  )
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

function ExpandedCard({
  overlap,
  photos,
  onOpenPhoto,
}: {
  overlap: Overlap
  photos: Photo[]
  onOpenPhoto: (id: string) => void
}) {
  const { attendee, weight, photoIds } = overlap
  const shared = photos.filter((p) => photoIds.includes(p.id))
  const range = sharedRange(overlap, photos)

  return (
    <div
      className="mx-5 mt-2 rounded-[10px] border border-border bg-surface p-3.5"
      style={{ animation: 'ov-fade 0.35s ease both' }}
    >
      <div className="flex items-start gap-3">
        <Avatar name={attendee.name} color={attendee.avatar_color} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-medium tracking-[-0.01em] text-ink">
            {attendee.name}
          </p>
          {attendee.github ? (
            <p className="mt-0.5 font-mono text-[11px] text-muted">@{attendee.github}</p>
          ) : null}
        </div>
      </div>

      {attendee.building ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink">{attendee.building}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-b border-border pb-3 font-mono text-[11px] text-muted">
        <span className="text-signal">{weight}</span>
        <span>{weight === 1 ? 'photo' : 'photos'} together</span>
        <span className="flex-1" />
        {range ? <span>{range}</span> : null}
      </div>

      {shared.length > 0 ? (
        <div className="mt-3.5 flex items-start">
          {shared.slice(0, 6).map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenPhoto(p.id)}
              className="relative block shrink-0 border-0 bg-transparent p-0"
              style={{ marginLeft: i === 0 ? 0 : -16, zIndex: 10 - i }}
            >
              <img
                src={photoUrl(p.storage_path)}
                alt={p.scene_description ?? ''}
                loading="lazy"
                className="block h-[116px] w-[92px] rounded-sm border border-border object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <ConnectRow attendee={attendee} />
    </div>
  )
}

/**
 * "Connect" = abrir su perfil, nada de mensajeria in-app (seccion 2 del
 * CLAUDE.md). GitHub es el canal primario, siempre visible (o el fallback si
 * no lo compartio). LinkedIn/WhatsApp son botones-icono secundarios, y solo
 * aparecen si esa persona los agrego en el onboarding.
 */
function ConnectRow({ attendee }: { attendee: Attendee }) {
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

function EmptyRecap() {
  return (
    <div className="mx-5 mt-6 rounded-2xl border border-dashed border-border px-5 py-10 text-center">
      <p className="text-sm text-muted">
        Your recap fills in once you claim the photos you&rsquo;re in. Head to the gallery and tap
        &ldquo;That&rsquo;s me&rdquo;.
      </p>
    </div>
  )
}

function NoOverlapsYet() {
  return (
    <div className="mx-5 mt-9 rounded-2xl border border-dashed border-border px-5 py-10 text-center">
      <p className="text-sm text-muted">
        You&rsquo;ve claimed your photos. This fills in as soon as someone else claims one of the
        same shots.
      </p>
    </div>
  )
}

function Footer({ mine, total }: { mine: number; total: number }) {
  return (
    <div className="mt-7 flex items-center gap-2 px-5 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
      <span className="h-px flex-1 bg-border" />
      <span>
        {mine} / {total} photos
      </span>
    </div>
  )
}
