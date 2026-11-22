// Contexto de filtro del motor de medidas (contrato, sección 2) y utilidades de fechas.
//
// Las fechas del contexto son texto ISO "aaaa-mm-dd" (inclusivas en ambos extremos). Internamente
// el motor las pasa a número de día serial de Excel con `fechaASerial` (src/datos/derivados.ts).
// Todo el calendario se calcula en UTC para no depender de la zona horaria de la máquina.

import { fechaASerial } from "../datos/derivados";

export type HorasDisp = 18 | 24;
export type HorasConf = 12 | 18 | 24;

export interface Contexto {
  /** Primer día del periodo (inclusive), "aaaa-mm-dd". */
  ini: string;
  /** Último día del periodo (inclusive), "aaaa-mm-dd". */
  fin: string;
  /** id_equipo en contexto (filtro de página, fila de tabla, columna del gráfico o familia). */
  equipos: number[];
  /** Valores elegidos en DISP. GLOBAL ("Mecánica", "Operacional", ...). Vacío = sin filtro. */
  disp: string[];
  /** Horas programadas por día ("Var t: Disp"). */
  hDisp: HorasDisp;
  /** Horizonte de confiabilidad en horas ("Var t: Conf."). */
  tConf: HorasConf;
}

// ---------------------------------------------------------------------------------------------
// Constantes del reporte (contrato, sección 4)
// ---------------------------------------------------------------------------------------------

/** Equipos por página de familia y por tabla de resumen. */
export const EQUIPOS_POR_PAGINA = {
  simba: [618487, 100618, 100660],
  jumbo: [618269, 100636, 620903],
  sostenimiento: [618321, 100647, 618320, 621321],
  st35: [100362, 618486],
  st1030: [618270, 100615, 100635, 100655, 100656, 100657],
} as const;

/** Los 18 equipos de Resumen Disp. y de Disp Mensual (este último sin 100361, que no está aquí). */
export const EQUIPOS_RESUMEN: readonly number[] = [
  ...EQUIPOS_POR_PAGINA.simba,
  ...EQUIPOS_POR_PAGINA.jumbo,
  ...EQUIPOS_POR_PAGINA.sostenimiento,
  ...EQUIPOS_POR_PAGINA.st35,
  ...EQUIPOS_POR_PAGINA.st1030,
];

/** Valores iniciales de los segmentadores en el reporte guardado. */
export const VALORES_INICIALES = {
  disp: ["Mecánica"],
  hDisp: 24 as HorasDisp,
  tConf: 18 as HorasConf,
  familiaMensual: "CARGADORAS BP",
};

// ---------------------------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------------------------

const MS_DIA = 86_400_000;

function partes(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function aIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Número de día serial (Excel) de "aaaa-mm-dd"; NaN si no es fecha válida. */
export function serialDeFecha(iso: string): number {
  return fechaASerial(iso);
}

/** Suma `n` días (puede ser negativo) a una fecha ISO. */
export function sumarDias(iso: string, n: number): string {
  const p = partes(iso);
  if (!p) return "";
  return aIso(Date.UTC(p[0], p[1] - 1, p[2]) + n * MS_DIA);
}

/** Días entre dos fechas ISO (fin - ini); equivale a DATEDIFF(ini, fin, DAY). */
export function diasEntre(ini: string, fin: string): number {
  const a = partes(ini);
  const b = partes(fin);
  if (!a || !b) return NaN;
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / MS_DIA);
}

/** Lista de fechas ISO de `ini` a `fin`, ambos inclusive. Vacía si ini > fin o alguna no es válida. */
export function calendario(ini: string, fin: string): string[] {
  const n = diasEntre(ini, fin);
  if (!(n >= 0)) return [];
  const p = partes(ini)!;
  const base = Date.UTC(p[0], p[1] - 1, p[2]);
  const dias: string[] = [];
  for (let i = 0; i <= n; i++) dias.push(aIso(base + i * MS_DIA));
  return dias;
}

/** Cantidad de días del periodo (inclusive). 0 si el rango es inválido o está vacío. */
export function contarDias(ini: string, fin: string): number {
  const n = diasEntre(ini, fin);
  return n >= 0 ? n + 1 : 0;
}

/** Día de la semana, 0 = domingo. */
export function diaSemana(iso: string): number {
  const p = partes(iso);
  return p ? new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() : NaN;
}

/** Primer día del mes de una fecha: "2026-11-20" -> "2026-11-01". */
export function primerDiaMes(iso: string): string {
  const p = partes(iso);
  return p ? `${String(p[0]).padStart(4, "0")}-${String(p[1]).padStart(2, "0")}-01` : "";
}

/** Último día del mes de una fecha. */
export function ultimoDiaMes(iso: string): string {
  const p = partes(iso);
  return p ? aIso(Date.UTC(p[0], p[1], 0)) : "";
}

/** Suma `n` meses (puede ser negativo) al primer día del mes de la fecha dada. */
export function sumarMeses(iso: string, n: number): string {
  const p = partes(iso);
  if (!p) return "";
  return aIso(Date.UTC(p[0], p[1] - 1 + n, 1));
}

/** Mes de la fecha como "aaaa-mm". */
export function claveMes(iso: string): string {
  return iso.slice(0, 7);
}

export interface MesDelRango {
  /** Primer día del mes calendario, "aaaa-mm-01". */
  mes: string;
  /** Días de ese mes que caen dentro de [ini, fin]. */
  dias: number;
}

/** Meses que toca [ini, fin] con la cantidad de días del rango en cada uno. */
export function mesesDelRango(ini: string, fin: string): MesDelRango[] {
  const total = diasEntre(ini, fin);
  if (!(total >= 0)) return [];
  const salida: MesDelRango[] = [];
  let cursor = ini;
  let restantes = total + 1;
  while (restantes > 0) {
    const mes = primerDiaMes(cursor);
    const hastaFinDeMes = diasEntre(cursor, ultimoDiaMes(cursor)) + 1;
    const dias = Math.min(hastaFinDeMes, restantes);
    salida.push({ mes, dias });
    restantes -= dias;
    cursor = sumarDias(cursor, dias);
  }
  return salida;
}

const NOMBRES_MES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Nombre del mes en español con la inicial en mayúscula ("2026-11-20" -> "Noviembre"). */
export function nombreMes(iso: string): string {
  const p = partes(iso);
  return p ? NOMBRES_MES[p[1] - 1] : "";
}

// ---------------------------------------------------------------------------------------------
// Semanas (WEEKNUM tipo 1: la semana empieza en domingo; la semana 1 contiene el 1 de enero)
// ---------------------------------------------------------------------------------------------

/** WEEKNUM(fecha) de Excel/DAX con return_type 1. */
export function numeroSemana(iso: string): number {
  const p = partes(iso);
  if (!p) return NaN;
  const t = Date.UTC(p[0], p[1] - 1, p[2]);
  const t1 = Date.UTC(p[0], 0, 1);
  const doy = Math.round((t - t1) / MS_DIA); // base 0
  const dowEnero1 = new Date(t1).getUTCDay();
  return Math.floor((doy + dowEnero1) / 7) + 1;
}

/** Etiqueta de semana de DIM_TIEMPO[NbSemana]: "Sem " & WEEKNUM & "/" & RIGHT(año, 2). */
export function etiquetaSemana(iso: string): string {
  const p = partes(iso);
  if (!p) return "";
  return `Sem ${numeroSemana(iso)}/${String(p[0]).slice(-2)}`;
}

export interface SemanaDelRango {
  /** "Sem 45/26". */
  etiqueta: string;
  /** WEEKNUM (NbSemana_orden en el reporte). */
  semana: number;
  anio: number;
  /** Primer día de la semana dentro del periodo. */
  ini: string;
  /** Último día de la semana dentro del periodo. */
  fin: string;
}

/**
 * Semanas que toca [ini, fin], en orden cronológico. Cada semana se agrupa por su etiqueta
 * (igual que el reporte, donde la categoría es NbSemana) y trae el primer y último día de esa
 * semana dentro del periodo, que son los MIN y MAX de DIM_TIEMPO[Fecha] en el contexto.
 */
export function semanasDelRango(ini: string, fin: string): SemanaDelRango[] {
  const grupos = new Map<string, SemanaDelRango>();
  for (const dia of calendario(ini, fin)) {
    const etiqueta = etiquetaSemana(dia);
    const g = grupos.get(etiqueta);
    if (g) g.fin = dia;
    else grupos.set(etiqueta, { etiqueta, semana: numeroSemana(dia), anio: Number(dia.slice(0, 4)), ini: dia, fin: dia });
  }
  return [...grupos.values()];
}

// ---------------------------------------------------------------------------------------------
// Presentación de fecha-hora (serial -> texto)
// ---------------------------------------------------------------------------------------------

const ORIGEN_EXCEL_MS = Date.UTC(1899, 11, 30);

/** Serial -> "aaaa-mm-ddThh:mm:ss" (se redondea al segundo; sin zona horaria). */
export function serialAIso(serial: number): string {
  const seg = Math.round(serial * 86400);
  return new Date(ORIGEN_EXCEL_MS + seg * 1000).toISOString().slice(0, 19);
}

/** Serial -> "m/d/aaaa h:mm:ss AM/PM", el formato del reporte (mes primero). */
export function formatoFechaHora(serial: number): string {
  const seg = Math.round(serial * 86400);
  const d = new Date(ORIGEN_EXCEL_MS + seg * 1000);
  const h = d.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()} ${h12}:${mm}:${ss} ${h < 12 ? "AM" : "PM"}`;
}
