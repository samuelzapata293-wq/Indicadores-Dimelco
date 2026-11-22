// Subida del Excel al bucket «excel», llamada a cargar_datos y comparación con los datos actuales.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosModelo, Paro } from "./tipos";

/** Error de la base tal como viene: mensaje y detalle por separado. */
export class ErrorCarga extends Error {
  detalle: string;
  etapa: "subida" | "carga";
  constructor(etapa: "subida" | "carga", mensaje: string, detalle = "") {
    super(mensaje);
    this.name = "ErrorCarga";
    this.etapa = etapa;
    this.detalle = detalle;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Ruta en el bucket: aaaa/mm/dd-hhmmss_nombre.xlsx (hora local). El nombre se limpia para que sea una clave válida. */
export function rutaStorage(nombreArchivo: string, ahora = new Date()): string {
  const base = nombreArchivo
    .replace(/\.xlsx$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "libro";
  const f = ahora;
  return `${f.getFullYear()}/${pad(f.getMonth() + 1)}/${pad(f.getDate())}-${pad(f.getHours())}${pad(f.getMinutes())}${pad(f.getSeconds())}_${base}.xlsx`;
}

/** Sube el libro y luego carga los datos. Si la subida falla no se carga. Devuelve el id de carga. */
export async function subirYCargar(cliente: SupabaseClient, archivo: File, datos: DatosModelo): Promise<number> {
  const ruta = rutaStorage(archivo.name);
  const subida = await cliente.storage.from("excel").upload(ruta, archivo, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: false,
  });
  if (subida.error) throw new ErrorCarga("subida", subida.error.message);

  const { data, error } = await cliente.rpc("cargar_datos", { datos, archivo: archivo.name, ruta_storage: ruta });
  if (error) {
    const e = error as { message: string; details?: string | null; hint?: string | null };
    throw new ErrorCarga("carga", e.message, [e.details, e.hint].filter(Boolean).join(" · "));
  }
  return Number(data);
}

// ---------- comparación ----------

export interface DiferenciaTabla {
  tabla: string;
  /** Filas en la base (0 si no hay datos actuales). */
  actual: number;
  nuevo: number;
  nuevas: number;
  quitadas: number;
}

export interface ComparacionParos extends DiferenciaTabla {
  rangoActual: { min: string; max: string } | null;
  rangoNuevo: { min: string; max: string } | null;
  /** Avisos que no existen en la base y cuyo inicio cae en los 30 días anteriores a la última fecha del libro nuevo. */
  avisosNuevos30d: number;
}

export interface Comparacion {
  hayActual: boolean;
  tablas: DiferenciaTabla[];
  paros: ComparacionParos;
}

function contar<T>(filas: T[], clave: (f: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of filas) {
    const k = clave(f);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function diferencia<T>(tabla: string, nuevo: T[], actual: T[], clave: (f: T) => string): DiferenciaTabla {
  const a = contar(actual, clave);
  const n = contar(nuevo, clave);
  let nuevas = 0;
  let quitadas = 0;
  for (const [k, c] of n) nuevas += Math.max(0, c - (a.get(k) ?? 0));
  for (const [k, c] of a) quitadas += Math.max(0, c - (n.get(k) ?? 0));
  return { tabla, actual: actual.length, nuevo: nuevo.length, nuevas, quitadas };
}

function rango(paros: Paro[]): { min: string; max: string } | null {
  if (paros.length === 0) return null;
  let min = paros[0].fecha_inicio;
  let max = min;
  for (const p of paros) {
    if (p.fecha_inicio < min) min = p.fecha_inicio;
    if (p.fecha_inicio > max) max = p.fecha_inicio;
  }
  return { min, max };
}

function restarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d - dias));
  return `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`;
}

/** Una fila de paros se identifica por aviso, equipo y momento de inicio (el aviso puede repetirse). */
const clave = (p: Paro) => `${p.aviso}|${p.id_equipo}|${p.fecha_inicio}|${p.hora_inicio}`;

export function compararConActual(nuevo: DatosModelo, actual: DatosModelo | undefined): Comparacion {
  const act: DatosModelo = actual ?? { equipos: [], responsables: [], tipos_mantto: [], metas: [], paros: [] };
  const tablas = [
    diferencia("equipos", nuevo.equipos, act.equipos, (f) => String(f.id_equipo)),
    diferencia("responsables", nuevo.responsables, act.responsables, (f) => f.id_responsable),
    diferencia("tipos_mantto", nuevo.tipos_mantto, act.tipos_mantto, (f) => f.id_tipo_mantto),
    diferencia("metas", nuevo.metas, act.metas, (f) => `${f.mes}|${f.equipo_descripcion.trim().toLowerCase()}`),
  ];
  const dp = diferencia("paros", nuevo.paros, act.paros, clave);
  const rangoNuevo = rango(nuevo.paros);
  let avisosNuevos30d = 0;
  if (rangoNuevo) {
    const desde = restarDias(rangoNuevo.max, 30);
    const existentes = new Set(act.paros.map((p) => p.aviso));
    const vistos = new Set<number>();
    for (const p of nuevo.paros) {
      if (p.fecha_inicio >= desde && !existentes.has(p.aviso) && !vistos.has(p.aviso)) {
        vistos.add(p.aviso);
        avisosNuevos30d++;
      }
    }
  }
  return {
    hayActual: actual !== undefined && (act.paros.length > 0 || act.equipos.length > 0),
    tablas: [...tablas, dp],
    paros: { ...dp, rangoActual: rango(act.paros), rangoNuevo, avisosNuevos30d },
  };
}
