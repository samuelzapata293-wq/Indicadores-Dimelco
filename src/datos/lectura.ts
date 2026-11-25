// Lectura de las cinco tablas desde Supabase y conversión a los tipos de src/datos/tipos.ts.
// PostgREST devuelve como máximo 1000 filas por consulta: se cuenta con head:true y las páginas
// se piden en paralelo.

import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import type { Configuracion } from "./periodos";
import { clienteSupabase } from "../lib/supabase";
import type { DatosModelo, Equipo, Meta, Paro, Responsable, TipoMantto } from "./tipos";

const PAGINA = 1000;

// ---------- conversión de tipos (bigint y numeric llegan como number o string; null como null) ----------

type Crudo = Record<string, unknown>;

export function aTexto(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export function aNumero(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function aNumeroONulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = aNumero(v);
  return Number.isFinite(n) ? n : null;
}

/** "aaaa-mm-dd" (columna date) → "dd/mm/aaaa", el formato de Meta.mes. */
export function isoADmy(v: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(aTexto(v));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : aTexto(v);
}

export const convertirEquipo = (f: Crudo): Equipo => ({
  id_equipo: aNumero(f.id_equipo),
  descripcion: aTexto(f.descripcion),
  familia: aTexto(f.familia),
});

export const convertirResponsable = (f: Crudo): Responsable => ({
  id_responsable: aTexto(f.id_responsable),
  denominacion: aTexto(f.denominacion),
  responsable: aTexto(f.responsable),
  disponibilidad: aTexto(f.disponibilidad),
});

export const convertirTipoMantto = (f: Crudo): TipoMantto => ({
  id_tipo_mantto: aTexto(f.id_tipo_mantto),
  descripcion: aTexto(f.descripcion),
});

export const convertirMeta = (f: Crudo): Meta => ({
  mes: isoADmy(f.mes),
  equipo_descripcion: aTexto(f.equipo_descripcion),
  meta_disp: aNumero(f.meta_disp),
  meta_mttr: aNumeroONulo(f.meta_mttr),
  meta_mtbf: aNumeroONulo(f.meta_mtbf),
  meta_conf: aNumeroONulo(f.meta_conf),
});

/** Las horas se guardan como texto; si vinieran como "hh:mm" se completan a "hh:mm:ss". */
function hora(v: unknown): string {
  const t = aTexto(v);
  return /^\d{1,2}:\d{2}$/.test(t) ? `${t}:00` : t;
}

export const convertirParo = (f: Crudo): Paro => ({
  id_equipo: aNumero(f.id_equipo),
  aviso: aNumero(f.aviso),
  fecha_inicio: aTexto(f.fecha_inicio).slice(0, 10),
  hora_inicio: hora(f.hora_inicio),
  fecha_fin: aTexto(f.fecha_fin).slice(0, 10),
  hora_fin: hora(f.hora_fin),
  duracion_min: aNumeroONulo(f.duracion_min),
  desc_paro: aTexto(f.desc_paro),
  id_responsable: aTexto(f.id_responsable),
  cod_falla: aTexto(f.cod_falla),
  texto_falla: aTexto(f.texto_falla),
  id_tipo_mantto: aTexto(f.id_tipo_mantto),
  tipo_paro_pp_npi: aTexto(f.tipo_paro_pp_npi),
  resumen: aTexto(f.resumen),
});

// ---------- consulta paginada ----------

interface Tabla<T> {
  nombre: string;
  columnas: string;
  /** Orden estable para que las páginas no se solapen. */
  orden: string;
  convertir: (f: Crudo) => T;
}

async function traerTabla<T>(cliente: SupabaseClient, t: Tabla<T>): Promise<T[]> {
  const conteo = await cliente.from(t.nombre).select("*", { count: "exact", head: true });
  if (conteo.error) throw new Error(`No se pudo leer ${t.nombre}: ${conteo.error.message}`);
  const total = conteo.count ?? 0;
  const paginas = Math.ceil(total / PAGINA);
  const resultados = await Promise.all(
    Array.from({ length: paginas }, async (_, i) => {
      const { data, error } = await cliente
        .from(t.nombre)
        .select(t.columnas)
        .order(t.orden)
        .range(i * PAGINA, (i + 1) * PAGINA - 1);
      if (error) throw new Error(`No se pudo leer ${t.nombre}: ${error.message}`);
      return (data ?? []) as unknown as Crudo[];
    }),
  );
  return resultados.flat().map(t.convertir);
}

const TABLAS = {
  equipos: { nombre: "equipos", columnas: "id_equipo,descripcion,familia", orden: "id_equipo", convertir: convertirEquipo },
  responsables: {
    nombre: "responsables",
    columnas: "id_responsable,denominacion,responsable,disponibilidad",
    orden: "id_responsable",
    convertir: convertirResponsable,
  },
  tipos_mantto: { nombre: "tipos_mantto", columnas: "id_tipo_mantto,descripcion", orden: "id_tipo_mantto", convertir: convertirTipoMantto },
  metas: {
    nombre: "metas",
    columnas: "mes,equipo_descripcion,meta_disp,meta_mttr,meta_mtbf,meta_conf",
    orden: "id",
    convertir: convertirMeta,
  },
  paros: {
    nombre: "paros",
    columnas:
      "aviso,id_equipo,fecha_inicio,hora_inicio,fecha_fin,hora_fin,duracion_min,desc_paro,id_responsable,cod_falla,texto_falla,id_tipo_mantto,tipo_paro_pp_npi,resumen",
    orden: "id",
    convertir: convertirParo,
  },
} as const;

export async function leerDatosModelo(cliente: SupabaseClient): Promise<DatosModelo> {
  const [equipos, responsables, tipos_mantto, metas, paros] = await Promise.all([
    traerTabla<Equipo>(cliente, TABLAS.equipos),
    traerTabla<Responsable>(cliente, TABLAS.responsables),
    traerTabla<TipoMantto>(cliente, TABLAS.tipos_mantto),
    traerTabla<Meta>(cliente, TABLAS.metas),
    traerTabla<Paro>(cliente, TABLAS.paros),
  ]);
  return { equipos, responsables, tipos_mantto, metas, paros };
}

// ---------- cargas ----------

export interface Carga {
  id: number;
  fecha_carga: string;
  archivo: string | null;
  fecha_min: string | null;
  fecha_max: string | null;
  filas: Record<string, number>;
}

export function convertirCarga(f: Crudo): Carga {
  const filas: Record<string, number> = {};
  if (f.filas && typeof f.filas === "object") {
    for (const [k, v] of Object.entries(f.filas as Record<string, unknown>)) filas[k] = aNumero(v);
  }
  return {
    id: aNumero(f.id),
    fecha_carga: aTexto(f.fecha_carga),
    archivo: f.archivo === null || f.archivo === undefined ? null : String(f.archivo),
    fecha_min: f.fecha_min ? aTexto(f.fecha_min) : null,
    fecha_max: f.fecha_max ? aTexto(f.fecha_max) : null,
    filas,
  };
}

export async function leerCargas(cliente: SupabaseClient, limite = 10): Promise<Carga[]> {
  const { data, error } = await cliente
    .from("cargas")
    .select("id,fecha_carga,archivo,fecha_min,fecha_max,filas")
    .order("fecha_carga", { ascending: false })
    .order("id", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`No se pudo leer el historial de cargas: ${error.message}`);
  return ((data ?? []) as unknown as Crudo[]).map(convertirCarga);
}

// ---------- hooks ----------

const CINCO_MIN = 5 * 60 * 1000;

export const CLAVE_DATOS = ["datos-modelo"] as const;
export const CLAVE_CARGAS = ["cargas"] as const;

export function useDatosModelo() {
  return useQuery({
    queryKey: CLAVE_DATOS,
    queryFn: () => leerDatosModelo(clienteSupabase()),
    staleTime: CINCO_MIN,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useCargas(limite = 10) {
  return useQuery({
    queryKey: [...CLAVE_CARGAS, limite],
    queryFn: () => leerCargas(clienteSupabase(), limite),
    staleTime: CINCO_MIN,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Última carga: fecha_carga, fecha_min, fecha_max, filas, archivo. */
export function useUltimaCarga() {
  const q = useQuery({
    queryKey: [...CLAVE_CARGAS, 1],
    queryFn: () => leerCargas(clienteSupabase(), 1),
    staleTime: CINCO_MIN,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return { ...q, data: q.data?.[0] ?? null };
}

// ---------- configuración (período compartido) ----------

export const CLAVE_CONFIGURACION = ["configuracion"] as const;

const fechaONula = (v: unknown): string | null => (v ? aTexto(v).slice(0, 10) : null);

export function convertirConfiguracion(f: Crudo): Configuracion {
  return {
    periodo_ini: fechaONula(f.periodo_ini),
    periodo_fin: fechaONula(f.periodo_fin),
    mensual_ini: fechaONula(f.mensual_ini),
    mensual_fin: fechaONula(f.mensual_fin),
  };
}

/** Fila única de configuracion, o null si todavía no se guardó nada. */
export async function leerConfiguracion(cliente: SupabaseClient): Promise<Configuracion | null> {
  const { data, error } = await cliente
    .from("configuracion")
    .select("periodo_ini,periodo_fin,mensual_ini,mensual_fin")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la configuración: ${error.message}`);
  return data ? convertirConfiguracion(data as unknown as Crudo) : null;
}

export interface PeriodoAGuardar {
  /** Un par en null no se cambia. */
  periodoIni?: string | null;
  periodoFin?: string | null;
  mensualIni?: string | null;
  mensualFin?: string | null;
}

/** Guarda el período (solo el administrador; la base lo exige). */
export async function guardarPeriodo(cliente: SupabaseClient, p: PeriodoAGuardar): Promise<void> {
  const { error } = await cliente.rpc("guardar_periodo", {
    p_periodo_ini: p.periodoIni ?? null,
    p_periodo_fin: p.periodoFin ?? null,
    p_mensual_ini: p.mensualIni ?? null,
    p_mensual_fin: p.mensualFin ?? null,
  });
  if (error) throw new Error(`No se pudo guardar el período: ${error.message}`);
}

// Modo local (VITE_DATOS_LOCAL=muestra): no hay base, así que no hay configuración.
const SIN_BASE = import.meta.env.VITE_DATOS_LOCAL === "muestra";

export function useConfiguracion() {
  return useQuery({
    queryKey: CLAVE_CONFIGURACION,
    queryFn: async (): Promise<Configuracion | null> => (SIN_BASE ? null : leerConfiguracion(clienteSupabase())),
    staleTime: CINCO_MIN,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
