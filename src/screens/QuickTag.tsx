import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIdentity } from '../lib/identity'
import { useEventData } from '../lib/useEventData'
import { tagPerson, tagSelf } from '../lib/db'
import { photoUrl } from '../lib/supabase'
import { isVideoPath } from '../lib/media'
import { timeOf } from '../lib/graph'
import { markSeen } from '../lib/seen'
import Avatar from '../components/Avatar'
import TopBar from '../components/TopBar'
import type { Attendee } from '../lib/types'

/**
 * El bucle de tageo, aislado.
 *
 * Taggearse desde la galeria son cuatro toques (grid -> abrir -> taggear ->
 * cerrar) y hay que decidir en cual foto entrar. Medido en vivo: 23 de 31
 * fotos sin nadie. Aca la decision es una sola y siempre la misma — "¿estas
 * en esta?" — con la foto grande y el siguiente que entra solo.
 */
export default function QuickTag() {
  const navigate = useNavigate()
  const { event, me } = useIdentity()
  const { photos, attendees, tags, loading, refresh } = useEventData(event?.id)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [picking, setPicking] = useState(false)

  const byId = useMemo(() => new Map(attendees.map((a) => [a.id, a])), [attendees])

  /** photo_id -> quienes ya estan tageados */
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

  /** La cola: fotos donde no sale nadie todavia, mas viejas primero (orden real
   * de la noche). Las que ya resolviste en esta sesion salen de la cola. */
  const queue = useMemo(() => {
    return photos
      .filter((p) => (cast.get(p.id) ?? []).length === 0 && !skipped.has(p.id))
      .sort(
        (a, b) =>
          new Date(a.taken_at ?? a.created_at).getTime() -
          new Date(b.taken_at ?? b.created_at).getTime(),
      )
  }, [photos, cast, skipped])

  const photo = queue[index] ?? queue[0] ?? null
  const untaggedTotal = useMemo(
    () => photos.filter((p) => (cast.get(p.id) ?? []).length === 0).length,
    [photos, cast],
  )

  function skip() {
    if (!photo) return
    setSkipped((prev) => new Set(prev).add(photo.id))
    setIndex(0)
    setPicking(false)
  }

  async function claim() {
    if (!photo || !me || busy) return
    setBusy(true)
    try {
      await tagSelf(photo.id, me.id)
      markSeen(event?.slug ?? '')
      setSkipped((prev) => new Set(prev).add(photo.id))
      setIndex(0)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function addPerson(attendeeId: string) {
    if (!photo || busy) return
    setBusy(true)
    try {
      await tagPerson(photo.id, attendeeId)
      await refresh()
    } finally {
      setBusy(false)
      setPicking(false)
    }
  }

  if (!me) return null

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />

      <div className="flex items-center justify-between px-5 py-3">
        <p className="font-mono text-[11px] text-muted">
          {untaggedTotal > 0 ? (
            <>
              <span className="text-signal">{untaggedTotal}</span> still unnamed
            </>
          ) : (
            'All done'
          )}
        </p>
        <button
          type="button"
          onClick={() => navigate('/gallery')}
          className="font-mono text-[11px] text-muted"
        >
          Done
        </button>
      </div>

      {loading && photos.length === 0 ? (
        <p className="py-16 text-center font-mono text-sm text-muted">Loading…</p>
      ) : !photo ? (
        <AllCaught onDone={() => navigate('/gallery')} />
      ) : (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center px-5">
            {isVideoPath(photo.storage_path) ? (
              <video
                src={photoUrl(photo.storage_path)}
                className="max-h-[52vh] max-w-full rounded-sm border border-border object-contain"
                controls
                playsInline
                muted
              />
            ) : (
              <img
                src={photoUrl(photo.storage_path)}
                alt=""
                className="max-h-[52vh] max-w-full rounded-sm border border-border object-contain"
              />
            )}
          </div>

          <div className="mx-auto w-full max-w-2xl px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <p className="font-mono text-[11px] text-muted/70">
              {timeOf(photo)}
              {photo.uploader_id && byId.get(photo.uploader_id)
                ? ` · Uploaded by ${byId.get(photo.uploader_id)!.name}`
                : null}
            </p>

            <h1 className="mt-2 font-display text-[22px] font-medium tracking-[-0.02em] text-ink">
              Are you in this one?
            </h1>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void claim()}
                disabled={busy}
                className="min-h-12 flex-1 rounded-xl bg-signal px-5 py-3 font-display text-[15px] font-medium text-night transition-opacity disabled:opacity-40"
              >
                Yes, that&rsquo;s me
              </button>
              <button
                type="button"
                onClick={skip}
                disabled={busy}
                className="min-h-12 rounded-xl border border-border px-5 py-3 font-display text-[15px] font-medium text-muted transition-opacity disabled:opacity-40"
              >
                Skip
              </button>
            </div>

            {picking ? (
              <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center justify-between pb-2">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
                    Who else is in this?
                  </p>
                  <button
                    type="button"
                    onClick={() => setPicking(false)}
                    className="font-mono text-[11px] text-muted"
                  >
                    Cancel
                  </button>
                </div>
                <ul className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {attendees
                    .filter((a) => !(cast.get(photo.id) ?? []).some((p) => p.id === a.id))
                    .map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void addPerson(a.id)}
                          className="flex items-center gap-2 rounded-full bg-night py-1 pr-3 pl-1 text-ink transition-opacity disabled:opacity-40"
                        >
                          <Avatar name={a.name} color={a.avatar_color} size={22} />
                          <span className="text-sm">{a.name}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="mt-2 min-h-11 w-full rounded-lg border border-dashed border-border px-3.5 py-2.5 font-display text-[13px] font-medium text-muted transition-colors hover:border-signal hover:text-signal"
              >
                + Someone else is in it
              </button>
            )}

            <TaggedSoFar people={cast.get(photo.id) ?? []} />
          </div>
        </>
      )}
    </div>
  )
}

function TaggedSoFar({ people }: { people: Attendee[] }) {
  if (people.length === 0) return null
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {people.map((a) => (
        <li
          key={a.id}
          className="flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1"
        >
          <Avatar name={a.name} color={a.avatar_color} size={22} />
          <span className="text-sm text-ink">{a.name}</span>
        </li>
      ))}
    </ul>
  )
}

function AllCaught({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <p className="font-display text-[22px] font-medium text-ink">Nothing left to name</p>
      <p className="mt-2 text-sm text-muted">
        Every photo in the pool has someone tagged. That&rsquo;s the whole graph, filled in.
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-6 min-h-11 rounded-xl bg-signal px-6 py-3 font-display text-[15px] font-medium text-night"
      >
        Back to the pool
      </button>
    </div>
  )
}
