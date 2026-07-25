import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/analyze
 * body: { imageUrl: string }  -> URL publica de la foto en Supabase Storage
 * res:  { scene_description: string }
 *
 * La ANTHROPIC_API_KEY vive SOLO aca (env de Vercel). Nunca llega al cliente.
 */

// Alto volumen, barato y rapido (seccion 7 del CLAUDE.md).
const MODEL = 'claude-haiku-4-5'

// La API de Anthropic acepta hasta ~5MB por imagen en base64. El cliente ya
// comprime antes de subir; esto es el cinturon de seguridad.
const MAX_IMAGE_BYTES = 4_500_000

const SYSTEM_PROMPT = [
  'Describe en una frase corta y concreta el momento de esta foto de un evento tech:',
  'que pasa, objetos visibles (whiteboard, laptops con codigo, comida, alguien presentando),',
  'y la energia. NO inventes nombres ni conversaciones. Responde en ingles,',
  'una sola frase, sin comillas ni prefijos.',
].join(' ')

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const SUPPORTED: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function normalizeMediaType(raw: string | null): SupportedMediaType {
  const value = (raw ?? '').split(';')[0].trim().toLowerCase()
  if (value === 'image/jpg') return 'image/jpeg'
  return (SUPPORTED as string[]).includes(value) ? (value as SupportedMediaType) : 'image/jpeg'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no esta configurada' })
  }

  const imageUrl: unknown = req.body?.imageUrl
  if (typeof imageUrl !== 'string' || !/^https?:\/\//.test(imageUrl)) {
    return res.status(400).json({ error: 'Falta imageUrl (URL http/https de la foto)' })
  }

  try {
    const imageRes = await fetch(imageUrl)
    if (!imageRes.ok) {
      return res.status(400).json({ error: `No se pudo descargar la foto (${imageRes.status})` })
    }

    const bytes = Buffer.from(await imageRes.arrayBuffer())
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'La foto es demasiado grande para analizar' })
    }

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: normalizeMediaType(imageRes.headers.get('content-type')),
                data: bytes.toString('base64'),
              },
            },
            { type: 'text', text: 'Describe this moment.' },
          ],
        },
      ],
    })

    if (message.stop_reason === 'refusal') {
      return res.status(200).json({ scene_description: null, refused: true })
    }

    const scene_description = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim()

    return res.status(200).json({ scene_description: scene_description || null })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error desconocido'
    console.error('[api/analyze]', detail)
    return res.status(502).json({ error: 'Fallo el analisis de la foto', detail })
  }
}
