import { useMemo, useState } from 'react'
import { useIdentity } from '../lib/identity'
import { useEventData } from '../lib/useEventData'
import { overlapsFor } from '../lib/graph'
import Avatar from '../components/Avatar'
import TopBar from '../components/TopBar'
import ConnectRow from '../components/ConnectRow'
import EventGraph from '../components/EventGraph'
import PhotoLightbox from '../components/PhotoLightbox'
import Thumb from '../components/Thumb'
import NightStats from '../components/NightStats'
import { downloadVCards } from '../lib/vcard'
import type { Attendee, Photo, PhotoTag } from '../lib/types'

/**
 * El directorio de la sala. Existe porque el grafo solo muestra a quien ya se
 * tageo en alguna foto — quien se registro pero todavia no aparece en ninguna
 * era invisible, que es justo lo contrario de lo que sirve para hacer
 * networking. Aca esta todo el mundo desde que escanea el QR.
 */
export default function People() {
  const { event, me } = useIdentity()
  const { photos, attendees, tags, likes, loading } = useEventData(event?.id)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null)

  const byId = useMemo(
    () => new Map<string, Attendee>(attendees.map((a) => [a.id, a])),
    [attendees],
  )

  /** attendee_id -> en cuantas fotos sale */
  const appearances = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tags) map.set(t.attendee_id, (map.get(t.attendee_id) ?? 0) + 1)
    return map
  }, [tags])

  /** attendee_id -> cuantas fotos subio */
  const uploads = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of photos) {
      if (!p.uploader_id) continue
      map.set(p.uploader_id, (map.get(p.uploader_id) ?? 0) + 1)
    }
    return map
  }, [photos])

  /** attendee_id -> las fotos donde sale, para mostrarlas en su perfil. */
  const photosOf = useMemo(() => {
    const byPhoto = new Map(photos.map((p) => [p.id, p]))
    const map = new Map<string, Photo[]>()
    for (const t of tags) {
      const photo = byPhoto.get(t.photo_id)
      if (!photo) continue
      const list = map.get(t.attendee_id)
      if (list) list.push(photo)
      else map.set(t.attendee_id, [photo])
    }
    return map
  }, [photos, tags])

  /** photo_id -> quienes salen, para el visor. */
  const cast = useMemo(() => {
    const map = new Map<string, Attendee[]>()
    for (const t of tags) {
      const person = byId.get(t.attendee_id)
      if (!person) continue
      const list = map.get(t.photo_id)
      if (list) list.push(person)
      else map.set(t.photo_id, [person])
    }
    return map
  }, [tags, byId])

  /** Con quien coincidi yo, para poder ordenar y mostrar el peso. */
  const myOverlapWeight = useMemo(() => {
    if (!me) return new Map<string, number>()
    return new Map(overlapsFor(me.id, tags, byId).map((o) => [o.attendee.id, o.weight]))
  }, [me, tags, byId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? attendees.filter((a) =>
          [a.name, a.github, a.building].some((f) => f?.toLowerCase().includes(q)),
        )
      : [...attendees]

    // Con quien coincidiste primero (mas fuerte arriba), despues los demas por
    // llegada mas reciente — asi quien acaba de escanear el QR se ve enseguida.
    return list.sort((x, y) => {
      if (me) {
        if (x.id === me.id) return -1
        if (y.id === me.id) return 1
      }
      const wx = myOverlapWeight.get(x.id) ?? 0
      const wy = myOverlapWeight.get(y.id) ?? 0
      if (wx !== wy) return wy - wx
      return new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
    })
  }, [attendees, query, myOverlapWeight, me])

  const openPhoto = photos.find((p) => p.id === openPhotoId) ?? null

  /** Solo tiene sentido exportar a quien dejo alguna forma de contacto. */
  const contactable = useMemo(
    () => attendees.filter((a) => a.id !== me?.id && (a.github || a.linkedin || a.whatsapp)),
    [attendees, me],
  )

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-2xl px-5 pb-28">
        <header className="py-6">
          <h1 className="font-display text-3xl leading-tight font-medium text-ink">The room</h1>
          <p className="mt-2 text-sm text-muted">
            Everyone who scanned in tonight, and how you all connect. Tap anyone to see what
            they&rsquo;re building and how to reach them.
          </p>
          <div className="mt-3">
            <NightStats
              photos={photos}
              attendees={attendees}
              tags={tags}
              likes={likes.length}
            />
          </div>
        </header>

        {/* El mapa de conexiones es la identidad de esta pantalla, no un extra
            del perfil personal — por eso vive aca y no en "You". */}
        <EventGraph attendees={attendees} tags={tags} meId={me?.id ?? ''} heading={null} />

        {contactable.length > 0 ? (
          <button
            type="button"
            onClick={() => downloadVCards(contactable, event?.name ?? 'the event')}
            className="mt-6 mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-night px-3.5 py-2.5 font-display text-[13px] font-medium text-ink transition-colors hover:border-signal hover:text-signal"
          >
            <span>Save {contactable.length} contacts to my phone</span>
            <span className="font-mono text-[11px] opacity-60">↓</span>
          </button>
        ) : null}

        {attendees.length > 4 ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, @github, what they're building…"
            className="mb-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/30"
          />
        ) : null}

        {loading && attendees.length === 0 ? (
          <p className="py-16 text-center font-mono text-sm text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
            {query ? 'Nobody matches that.' : 'Nobody has scanned in yet.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                isMe={person.id === me?.id}
                inPhotos={appearances.get(person.id) ?? 0}
                uploaded={uploads.get(person.id) ?? 0}
                overlapWeight={myOverlapWeight.get(person.id) ?? 0}
                open={openId === person.id}
                onToggle={() => setOpenId((cur) => (cur === person.id ? null : person.id))}
                attendees={attendees}
                tags={tags}
                photos={photosOf.get(person.id) ?? []}
                onOpenPhoto={setOpenPhotoId}
              />
            ))}
          </ul>
        )}
      </main>

      {openPhoto ? (
        <PhotoLightbox
          photo={openPhoto}
          people={cast.get(openPhoto.id) ?? []}
          onClose={() => setOpenPhotoId(null)}
          uploader={openPhoto.uploader_id ? (byId.get(openPhoto.uploader_id) ?? null) : null}
          allAttendees={attendees}
          allTags={tags}
        />
      ) : null}
    </>
  )
}

function PersonCard({
  person,
  isMe,
  inPhotos,
  uploaded,
  overlapWeight,
  open,
  onToggle,
  attendees,
  tags,
  photos,
  onOpenPhoto,
}: {
  person: Attendee
  isMe: boolean
  inPhotos: number
  uploaded: number
  overlapWeight: number
  open: boolean
  onToggle: () => void
  attendees: Attendee[]
  tags: PhotoTag[]
  photos: Photo[]
  onOpenPhoto: (id: string) => void
}) {
  return (
    <li className="overflow-hidden rounded-[10px] border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <Avatar name={person.name} color={person.avatar_color} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-[15px] font-medium tracking-[-0.01em] text-ink">
              {person.name}
            </span>
            {isMe ? (
              <span className="shrink-0 rounded-full bg-signal/15 px-2 py-0.5 font-mono text-[10px] text-signal">
                you
              </span>
            ) : null}
          </span>
          {person.github ? (
            <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">
              @{person.github}
            </span>
          ) : person.building ? (
            <span className="mt-0.5 block truncate text-[12px] text-muted">{person.building}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-right font-mono text-[10px] text-muted">
          {overlapWeight > 0 && !isMe ? (
            <span className="block text-signal">
              ×{overlapWeight} with you
            </span>
          ) : null}
          <span className="block">{inPhotos} in frame</span>
        </span>
      </button>

      {open ? (
        <div className="px-3.5 pb-3.5" style={{ animation: 'ov-fade 0.3s ease both' }}>
          {person.building ? (
            <p className="text-[13px] leading-relaxed text-ink">{person.building}</p>
          ) : (
            <p className="text-[13px] text-muted">Hasn&rsquo;t said what they&rsquo;re building.</p>
          )}

          <div className="mt-3 flex items-center gap-3 border-b border-border pb-3 font-mono text-[11px] text-muted">
            <span>
              <span className="text-signal">{inPhotos}</span> in frame
            </span>
            <span>
              <span className="text-signal">{uploaded}</span> uploaded
            </span>
          </div>

          {photos.length > 0 ? (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenPhoto(p.id)}
                  className="block h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-night"
                >
                  <Thumb photo={p} />
                </button>
              ))}
            </div>
          ) : null}

          {isMe ? null : <ConnectRow attendee={person} />}

          {inPhotos > 0 ? (
            <EventGraph attendees={attendees} tags={tags} meId={person.id} embedded />
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-4 text-center font-mono text-[11px] text-muted">
              Not tagged in any photo yet — no connections to show.
            </p>
          )}
        </div>
      ) : null}
    </li>
  )
}
