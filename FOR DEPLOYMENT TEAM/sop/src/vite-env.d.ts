/// <reference types="vite/client" />

// Typed env vars this app reads. Vite replaces import.meta.env.* at build time;
// without this declaration TypeScript does not know `env` exists on ImportMeta.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
