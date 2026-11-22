/// <reference types="vite/client" />

// Variables de entorno de la conexión a Supabase, fijadas al compilar (GitHub Pages).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "muestra": lee tests/fixtures/datos/muestra.json en lugar de Supabase (solo desarrollo y pruebas). */
  readonly VITE_DATOS_LOCAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
