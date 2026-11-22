import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// La conexión viene de las variables de compilación. Sin ellas no hay cliente:
// la app muestra un aviso en lugar de fallar.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const conexionConfigurada = Boolean(url && anonKey);

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

// Para las pantallas que solo se muestran con la conexión configurada.
export function clienteSupabase(): SupabaseClient {
  if (!supabase) throw new Error("Falta configurar la conexión a Supabase");
  return supabase;
}
