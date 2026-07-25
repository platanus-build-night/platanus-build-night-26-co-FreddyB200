import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * OJO: las VITE_* se hornean en el bundle al BUILDEAR, no al correr. Si las
 * configuras en Vercel despues del primer deploy, hay que redesplegar.
 *
 * Si faltan, no lanzamos aca: un throw durante el import mata el modulo antes
 * de que React monte y el usuario ve una pantalla en blanco sin explicacion.
 * En vez de eso marcamos la bandera y App muestra que falta.
 */
export const supabaseConfigured = Boolean(url && anonKey)

// La anon key es publica por diseno. No usamos auth de Supabase: la identidad
// es un device_token en localStorage (seccion 4 del CLAUDE.md).
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export const PHOTOS_BUCKET = 'photos'

/** URL publica de una foto a partir de su storage_path. */
export function photoUrl(storagePath: string): string {
  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}
