import { useMemo, useRef, useState } from 'react'
import { useIdentity } from '../lib/identity'
import { useEventData } from '../lib/useEventData'
import { formatSpan, overlapsFor, photosFor, sharedRange, timeOf, timeRange } from '../lib/graph'
import { photoUrl } from '../lib/supabase'
import { likePhoto, myPhotosZipUrl, unlikePhoto } from '../lib/db'
import Avatar from '../components/Avatar'
import TopBar from '../components/TopBar'
import PhotoLightbox from '../components/PhotoLightbox'
import ConnectRow from '../components/ConnectRow'
import EventGraph from '../components/EventGraph'
import type { Attendee, Photo } from '../lib/types'
import type { Overlap } from '../lib/graph'

const STRIP_CARD_W = 220
const STRIP_OVERLAP = 44

/** El climax de la demo: el recap de esta noche. Data, no LLM. */
export default function Dossier() {
  const { event, me } = useIdentity()
  const { photos, attendees, tags, likes, loading, refresh } = useEventData(event?.id)
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null)
  const [likeBusy, setLikeBusy] = useState(false)

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

  /** photo_id -> attendees que le dieron like. */
  const likers = useMemo(() => {
    const map = new Map<string, Attendee[]>()
    for (const like of likes) {
      const person = byId.get(like.attendee_id)
      if (!person) continue
      const list = map.get(like.photo_id)
      if (list) list.push(person)
      else map.set(like.photo_id, [person])
    }
    return map
  }, [likes, byId])

  async function toggleLike(photo: Photo) {
    if (!me || likeBusy) return
    const likedIt = (likers.get(photo.id) ?? []).some((a) => a.id === me.id)
    setLikeBusy(true)
    try {
      if (likedIt) await unlikePhoto(photo.id, me.id)
      else await likePhoto(photo.id, me.id)
      await refresh()
    } finally {
      setLikeBusy(false)
    }
  }

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
            <SaveButton attendeeId={me.id} />
            <EventGraph attendees={attendees} tags={tags} meId={me.id} />
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
          likedBy={likers.get(openPhoto.id) ?? []}
          liked={(likers.get(openPhoto.id) ?? []).some((a) => a.id === me.id)}
          likeBusy={likeBusy}
          onToggleLike={() => void toggleLike(openPhoto)}
          uploader={openPhoto.uploader_id ? (byId.get(openPhoto.uploader_id) ?? null) : null}
          allAttendees={attendees}
          allTags={tags}
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
        className="flex items-start overflow-x-auto overflow-y-hidden px-5 pb-3.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [touch-action:pan-x]"
      >
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(photo.id)}
            className="relative shrink-0 border-0 bg-transparent p-0"
            style={{
              marginLeft: i === 0 ? 0 : -STRIP_OVERLAP,
              zIndex: photos.length - i,
              transform: `rotate(${i % 2 === 0 ? -1.1 : 1.4}deg)`,
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
 * ZIP con todas tus fotos, armado server-side (api/download.ts). Es un <a
 * download> plano a proposito — dejamos que el navegador maneje la descarga,
 * es lo unico confiable en movil.
 */
function SaveButton({ attendeeId }: { attendeeId: string }) {
  return (
    <div className="px-5 pb-2">
      <a
        href={myPhotosZipUrl(attendeeId)}
        download
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-night px-3.5 py-2.5 font-display text-[13px] font-medium text-ink transition-colors hover:border-signal hover:text-signal"
      >
        <span>Save my photos</span>
        <span className="font-mono text-[11px] opacity-60">↓</span>
      </a>
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
