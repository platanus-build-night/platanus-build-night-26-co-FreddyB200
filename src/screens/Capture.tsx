import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useIdentity } from '../lib/identity'
import { listPhotos, uploadPhoto } from '../lib/db'
import { photoUrl } from '../lib/supabase'
import Avatar from '../components/Avatar'
import type { Photo } from '../lib/types'

type Pending = {
  key: string
  name: string
  previewUrl: string
  status: 'uploading' | 'failed'
  error?: string
}

export default function Capture() {
  const { event, me, signOut } = useIdentity()
  const inputRef = useRef<HTMLInputElement>(null)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!event) return
    try {
      setPhotos(await listPhotos(event.id))
    } finally {
      setLoading(false)
    }
  }, [event])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Los object URLs de las previews se revocan al desmontar.
  useEffect(() => {
    return () => {
      setPending((current) => {
        current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
        return []
      })
    }
  }, [])

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!event || !me || files.length === 0) return

    const entries: Pending[] = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
    }))
    setPending((prev) => [...entries, ...prev])

    // Secuencial a proposito: en el wifi de un evento, 8 subidas en paralelo
    // se pisan entre si y ninguna termina.
    for (let i = 0; i < files.length; i++) {
      const entry = entries[i]
      try {
        const photo = await uploadPhoto(event.id, me.id, files[i])
        setPhotos((prev) => [photo, ...prev])
        setPending((prev) => prev.filter((p) => p.key !== entry.key))
        URL.revokeObjectURL(entry.previewUrl)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setPending((prev) =>
          prev.map((p) => (p.key === entry.key ? { ...p, status: 'failed', error: message } : p)),
        )
      }
    }
  }

  const isEmpty = !loading && photos.length === 0 && pending.length === 0

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-32">
      <header className="flex items-center gap-3 py-6">
        {me ? <Avatar name={me.name} color={me.avatar_color} size={44} /> : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-ink">{me?.name}</p>
          <p className="truncate font-mono text-xs text-muted">
            {me?.github ? `@${me.github}` : (event?.name ?? '')}
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
        >
          Not you?
        </button>
      </header>

      <h1 className="font-display text-3xl leading-tight font-bold text-ink">
        Drop tonight&rsquo;s photos in
      </h1>
      <p className="mt-2 text-sm text-muted">
        Everyone&rsquo;s photos land in one pool. You&rsquo;ll pick yourself out of them next.
      </p>

      {isEmpty ? (
        <p className="mt-10 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-muted">
          No photos yet — be the first to add one.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pending.map((p) => (
            <li
              key={p.key}
              className="relative aspect-square overflow-hidden rounded-xl bg-surface"
            >
              <img
                src={p.previewUrl}
                alt=""
                className={`h-full w-full object-cover ${p.status === 'failed' ? 'opacity-30' : 'opacity-50'}`}
              />
              <span className="absolute inset-x-0 bottom-0 bg-night/80 px-2 py-1.5 text-center font-mono text-[10px] text-muted">
                {p.status === 'failed' ? (p.error ?? 'Failed') : 'Uploading…'}
              </span>
            </li>
          ))}
          {photos.map((photo) => (
            <li key={photo.id} className="aspect-square overflow-hidden rounded-xl bg-surface">
              <img
                src={photoUrl(photo.storage_path)}
                alt={photo.scene_description ?? ''}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </li>
          ))}
        </ul>
      )}

      {/* Barra de accion fija: en el cel es el unico boton que importa. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-night/95 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onFiles}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl bg-signal px-5 py-4 font-display text-base font-bold text-night"
          >
            Add photos
          </button>
        </div>
      </div>
    </main>
  )
}
