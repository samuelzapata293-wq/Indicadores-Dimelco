// Fuente de datos del tablero: lee las cinco tablas (Supabase, o la muestra local en desarrollo),
// arma el modelo precalculado una sola vez y lo comparte con todas las páginas.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { prepararModelo, type Modelo } from "../medidas/modelo";
import { useDatosModelo } from "./lectura";
import type { DatosModelo } from "./tipos";

/** Modo local de desarrollo y pruebas: VITE_DATOS_LOCAL=muestra lee tests/fixtures/datos/muestra.json. */
export const MODO_LOCAL = import.meta.env.VITE_DATOS_LOCAL === "muestra";

export interface EstadoModelo {
  cargando: boolean;
  error: Error | null;
  /** Modelo listo para el motor de medidas; null mientras carga o si falló. */
  modelo: Modelo | null;
}

const ESTADO_VACIO: EstadoModelo = { cargando: true, error: null, modelo: null };
const Ctx = createContext<EstadoModelo>(ESTADO_VACIO);

/** Estado de la carga de datos y, cuando hay, el modelo. */
export function useModelo(): EstadoModelo {
  return useContext(Ctx);
}

function estadoDe(datos: DatosModelo | undefined, cargando: boolean, error: Error | null): EstadoModelo {
  return { cargando, error, modelo: datos ? prepararModelo(datos) : null };
}

function ProveedorSupabase({ children }: { children: ReactNode }) {
  const q = useDatosModelo();
  // prepararModelo se ejecuta solo cuando llegan datos nuevos, no al mover un filtro.
  const modelo = useMemo(() => (q.data ? prepararModelo(q.data) : null), [q.data]);
  const valor = useMemo<EstadoModelo>(
    () => ({ cargando: q.isPending, error: q.error ?? null, modelo }),
    [q.isPending, q.error, modelo],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

function ProveedorLocal({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatosModelo | undefined>();
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let vigente = true;
    // Import dinámico y detrás de MODO_LOCAL: la muestra no entra al paquete de producción.
    import("../../tests/fixtures/datos/muestra.json")
      .then((m) => vigente && setDatos((m.default ?? m) as unknown as DatosModelo))
      .catch((e) => vigente && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      vigente = false;
    };
  }, []);
  const modelo = useMemo(() => estadoDe(datos, !datos && !error, error), [datos, error]);
  return <Ctx.Provider value={modelo}>{children}</Ctx.Provider>;
}

export function ModeloProvider({ children }: { children: ReactNode }) {
  return MODO_LOCAL ? <ProveedorLocal>{children}</ProveedorLocal> : <ProveedorSupabase>{children}</ProveedorSupabase>;
}
