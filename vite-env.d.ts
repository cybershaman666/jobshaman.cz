/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_KEY: string
  readonly VITE_BACKEND_URL?: string
  readonly VITE_SEARCH_BACKEND_URL?: string
  readonly VITE_SEARCH_V2_ENABLED?: string
  readonly VITE_ENABLE_VERCEL_ANALYTICS?: string
  readonly GEMINI_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
