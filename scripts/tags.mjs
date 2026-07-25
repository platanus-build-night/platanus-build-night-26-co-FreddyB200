#!/usr/bin/env node
/**
 * Curador de tags — atajo de ENTRADA, no de invencion.
 *
 * Normalmente cada persona se etiqueta sola en la galeria ("That's me"). Este
 * script existe para la noche del evento: si no todos alcanzaron a etiquetarse
 * antes del pitch, tu —que estuviste ahi y sabes quien sale en cada foto—
 * declaras los tags en bulk en vez de perseguir a cada uno con el celular.
 *
 * REGLA (seccion 9 del CLAUDE.md): etiqueta SOLO gente que realmente sale en la
 * foto. El grafo es el foso de la demo justamente porque la data es real; un
 * tag inventado convierte el clima de la demo en una mentira sobre una persona
 * de carne y hueso que puede estar en la sala.
 *
 *   node scripts/tags.mjs list    -> imprime fotos + attendees y escribe la plantilla
 *   node scripts/tags.mjs apply   -> aplica supabase/tags.local.json
 *   node scripts/tags.mjs status  -> muestra el grafo que saldria ahora
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const MAPPING_FILE = 'supabase/tags.local.json'
const EVENT_SLUG = process.env.VITE_EVENT_SLUG ?? 'build-night'

// --- env -------------------------------------------------------------------
function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadEnv()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (revisa .env.local)')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// --- helpers ---------------------------------------------------------------
async function loadEvent() {
  const { data, error } = await supabase.from('events').select('*').eq('slug', EVENT_SLUG).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No existe el evento "${EVENT_SLUG}"`)
  return data
}

async function loadAll(eventId) {
  const [photos, attendees, tags] = await Promise.all([
    supabase.from('photos').select('*').eq('event_id', eventId).order('taken_at', { ascending: true, nullsFirst: false }),
    supabase.from('attendees').select('*').eq('event_id', eventId).order('created_at'),
    supabase.from('photo_tags').select('photo_id, attendee_id, photos!inner(event_id)').eq('photos.event_id', eventId),
  ])
  for (const r of [photos, attendees, tags]) if (r.error) throw r.error
  return { photos: photos.data ?? [], attendees: attendees.data ?? [], tags: tags.data ?? [] }
}

const shortTime = (p) =>
  new Date(p.taken_at ?? p.created_at).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

// --- comandos --------------------------------------------------------------
async function list() {
  const event = await loadEvent()
  const { photos, attendees, tags } = await loadAll(event.id)

  console.log(`\nEVENTO: ${event.name} (${event.slug})`)

  console.log(`\nATTENDEES (${attendees.length}) — usa estos nombres exactos:`)
  if (attendees.length === 0) console.log('  (ninguno todavia — nadie se ha registrado)')
  for (const a of attendees) {
    console.log(`  ${a.name}${a.github ? `  @${a.github}` : ''}`)
  }

  const tagged = new Map()
  for (const t of tags) tagged.set(t.photo_id, (tagged.get(t.photo_id) ?? 0) + 1)

  console.log(`\nFOTOS (${photos.length}):`)
  for (const p of photos) {
    const n = tagged.get(p.id) ?? 0
    console.log(`  ${p.id}`)
    console.log(`    ${shortTime(p)}  ·  ${n} tag${n === 1 ? '' : 's'}`)
    if (p.scene_description) console.log(`    "${p.scene_description}"`)
  }

  // Plantilla: no pisa lo que ya escribiste.
  const existing = existsSync(MAPPING_FILE) ? JSON.parse(readFileSync(MAPPING_FILE, 'utf8')) : {}
  const template = {}
  for (const p of photos) template[p.id] = existing[p.id] ?? []
  writeFileSync(MAPPING_FILE, JSON.stringify(template, null, 2) + '\n')

  console.log(`\nPlantilla escrita en ${MAPPING_FILE}`)
  console.log('Llena cada foto con los nombres de quienes REALMENTE salen, luego:')
  console.log('  npm run tags:apply\n')
}

async function apply() {
  if (!existsSync(MAPPING_FILE)) {
    console.error(`No existe ${MAPPING_FILE}. Corre primero: npm run tags:list`)
    process.exit(1)
  }
  const event = await loadEvent()
  const { photos, attendees } = await loadAll(event.id)

  const photoIds = new Set(photos.map((p) => p.id))
  const byName = new Map(attendees.map((a) => [a.name.trim().toLowerCase(), a]))

  const mapping = JSON.parse(readFileSync(MAPPING_FILE, 'utf8'))
  const rows = []
  const problems = []

  for (const [photoId, names] of Object.entries(mapping)) {
    if (!photoIds.has(photoId)) {
      problems.push(`foto desconocida: ${photoId}`)
      continue
    }
    for (const name of names) {
      const person = byName.get(String(name).trim().toLowerCase())
      if (!person) {
        problems.push(`attendee no registrado: "${name}" (foto ${photoId.slice(0, 8)})`)
        continue
      }
      rows.push({ photo_id: photoId, attendee_id: person.id })
    }
  }

  if (problems.length) {
    console.error('\nNo aplico nada. Corrige esto primero:')
    for (const p of problems) console.error(`  - ${p}`)
    console.error('\n(Los nombres deben coincidir con como se registro la persona.)')
    process.exit(1)
  }

  if (rows.length === 0) {
    console.log('La plantilla esta vacia — nada que aplicar.')
    return
  }

  const { error } = await supabase
    .from('photo_tags')
    .upsert(rows, { onConflict: 'photo_id,attendee_id', ignoreDuplicates: true })
  if (error) throw error

  console.log(`\n${rows.length} tags aplicados.`)
  await status()
}

async function status() {
  const event = await loadEvent()
  const { photos, attendees, tags } = await loadAll(event.id)
  const byId = new Map(attendees.map((a) => [a.id, a]))

  // Mismas aristas que src/lib/graph.ts, para ver el grafo real sin abrir la app.
  const cast = new Map()
  for (const t of tags) cast.set(t.photo_id, [...(cast.get(t.photo_id) ?? []), t.attendee_id])

  const edges = new Map()
  for (const ids of cast.values()) {
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]]
        edges.set(`${a}|${b}`, (edges.get(`${a}|${b}`) ?? 0) + 1)
      }
  }

  console.log(`\nGRAFO ACTUAL`)
  console.log(`  ${photos.length} fotos · ${attendees.length} attendees · ${tags.length} tags`)
  console.log(`  ${edges.size} aristas`)
  if (edges.size === 0) {
    console.log('\n  Constelacion vacia: ninguna foto tiene 2+ personas etiquetadas.')
    console.log('  Una arista nace cuando DOS personas estan en la MISMA foto.')
    return
  }
  const sorted = [...edges.entries()].sort((x, y) => y[1] - x[1])
  console.log()
  for (const [pair, weight] of sorted) {
    const [a, b] = pair.split('|')
    console.log(`  ${byId.get(a)?.name} ←→ ${byId.get(b)?.name}   ×${weight}`)
  }
  console.log()
}

const cmd = process.argv[2] ?? 'list'
const commands = { list, apply, status }
if (!commands[cmd]) {
  console.error(`Comando desconocido: ${cmd}. Usa: list | apply | status`)
  process.exit(1)
}
commands[cmd]().catch((err) => {
  console.error('\nError:', err.message ?? err)
  process.exit(1)
})
