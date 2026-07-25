import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y pega las keys.',
  )
}

// La anon key es publica por diseno. No usamos auth de Supabase: la identidad
// es un device_token en localStorage (seccion 4 del CLAUDE.md).
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const PHOTOS_BUCKET = 'photos'

/** URL publica de una foto a partir de su storage_path. */
export function photoUrl(storagePath: string): string {
  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}
