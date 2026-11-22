import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

interface Auth {
  session: Session | null;
  esAdmin: boolean;
  cargando: boolean;
  cerrarSesion: () => Promise<void>;
}

const Ctx = createContext<Auth>({
  session: null,
  esAdmin: false,
  cargando: true,
  cerrarSesion: async () => {},
});

// Pregunta a la base si el usuario actual es administrador. Si la llamada falla, no lo es.
async function consultarEsAdmin(cliente: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await cliente.rpc("es_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [sesionLista, setSesionLista] = useState(false);
  // Usuario cuyo rol ya se consultó. Mientras no coincida con la sesión, el rol no se conoce.
  const [adminDe, setAdminDe] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSesionLista(true);
      return;
    }
    const sb = supabase;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSesionLista(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evento, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId || !supabase) {
      setEsAdmin(false);
      setAdminDe(null);
      return;
    }
    let vigente = true;
    consultarEsAdmin(supabase).then((admin) => {
      if (!vigente) return;
      setEsAdmin(admin);
      setAdminDe(userId);
    });
    return () => {
      vigente = false;
    };
  }, [userId]);

  const cargando = !sesionLista || (userId !== null && adminDe !== userId);

  async function cerrarSesion() {
    if (supabase) await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider value={{ session, esAdmin, cargando, cerrarSesion }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
