/// <reference types="vite/client" />

// Variables de entorno de la conexión a Supabase, fijadas al compilar (GitHub Pages).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
