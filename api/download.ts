import type { VercelRequest, VercelResponse } from '@vercel/node'
// La extension .js es obligatoria: Vercel compila estas funciones a ESM, y en
// ESM los imports relativos no resuelven sin extension (falla en runtime, no en
// build). TypeScript mapea el .js al _zip.ts de al lado.
import { ZipWriter } from './_zip.js'

/**
 * GET /api/download?attendee=<uuid>[&kind=tags|likes]
 * -> ZIP con las fotos donde esa persona esta etiquetada (kind=tags, default)
 *    o las que le gustaron (kind=likes).
 *
 * Es "Download all my photos" sin OAuth ni Google: la promesa del pozo
 * ("subes las tuyas, recibes las tuyas") cerrada de la forma mas simple.
 *
 * Server-side a proposito: el front solo necesita un <a href>. Zipear en el
 * browser obligaria a cargar una libreria y a armar un blob de decenas de MB
 * en memoria, que es justo donde Safari movil falla.
 *
 * Se envia en streaming (res.write por foto) en vez de armar el buffer completo:
 * asi la memoria queda plana y no chocamos con el limite de respuesta buffereada
 * de las funciones serverless.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

// Techo de seguridad: una funcion serverless tiene tiempo y memoria acotados.
const MAX_PHOTOS = 200
// Descargas en paralelo. Suficiente para que no tarde una eternidad, sin
// reventar el rate limit de Storage.
const CONCURRENCY = 6

type PhotoRow = { id: string; storage_path: string; taken_at: string | null; created_at: string }

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** overlap-0214-a1b2c3d4.jpg — hora real primero, para que ordene cronologico.
 * La extension sale del storage_path (no siempre es jpg: tambien hay video). */
function fileNameFor(photo: PhotoRow): string {
  const when = new Date(photo.taken_at ?? photo.created_at)
  const stamp = `${pad(when.getMonth() + 1)}${pad(when.getDate())}-${pad(when.getHours())}${pad(when.getMinutes())}`
  const ext = photo.storage_path.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'jpg'
  return `overlap-${stamp}-${photo.id.slice(0, 8)}.${safeExt}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY' })
  }

  const attendee = req.query.attendee
  const attendeeId = Array.isArray(attendee) ? attendee[0] : attendee
  if (!attendeeId || !/^[0-9a-f-]{36}$/i.test(attendeeId)) {
    return res.status(400).json({ error: 'Falta ?attendee=<uuid>' })
  }

  const kindParam = Array.isArray(req.query.kind) ? req.query.kind[0] : req.query.kind
  const likesMode = kindParam === 'likes'
  // Misma forma de fila en las dos tablas, asi que el resto del handler no cambia.
  const table = likesMode ? 'photo_likes' : 'photo_tags'

  try {
    const rows = await fetchJson<{ photos: PhotoRow | null }[]>(
      `${SUPABASE_URL}/rest/v1/${table}` +
        `?select=photos(id,storage_path,taken_at,created_at)` +
        `&attendee_id=eq.${attendeeId}`,
    )

    const photos = rows
      .map((r) => r.photos)
      .filter((p): p is PhotoRow => p !== null)
      .sort(
        (a, b) =>
          new Date(a.taken_at ?? a.created_at).getTime() -
          new Date(b.taken_at ?? b.created_at).getTime(),
      )
      .slice(0, MAX_PHOTOS)

    if (photos.length === 0) {
      return res.status(404).json({
        error: likesMode ? "You haven't liked any photos yet" : "You're not tagged in any photos yet",
      })
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${likesMode ? 'overlap-liked' : 'overlap-photos'}.zip"`,
    )
    res.setHeader('Cache-Control', 'no-store')

    const zip = new ZipWriter((chunk) => {
      res.write(chunk)
    })

    // Descargamos en lotes pero escribimos en orden: el zip es secuencial.
    for (let i = 0; i < photos.length; i += CONCURRENCY) {
      const batch = photos.slice(i, i + CONCURRENCY)
      const downloaded = await Promise.all(
        batch.map(async (photo) => {
          const url = `${SUPABASE_URL}/storage/v1/object/public/photos/${photo.storage_path}`
          const r = await fetch(url)
          if (!r.ok) return null // una foto rota no debe tumbar el zip entero
          return { photo, data: Buffer.from(await r.arrayBuffer()) }
        }),
      )
      for (const item of downloaded) {
        if (!item) continue
        zip.addFile(fileNameFor(item.photo), item.data, new Date(item.photo.taken_at ?? item.photo.created_at))
      }
    }

    zip.finish()
    return res.end()
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error desconocido'
    console.error('[api/download]', detail)
    // Si ya empezamos a escribir el zip no podemos mandar JSON: cortamos.
    if (res.headersSent) return res.end()
    return res.status(502).json({ error: 'No se pudo armar el zip', detail })
  }
}
