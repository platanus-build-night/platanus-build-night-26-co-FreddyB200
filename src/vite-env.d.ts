/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Slug del evento al que apunta el QR. Default: "build-night". */
  readonly VITE_EVENT_SLUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
