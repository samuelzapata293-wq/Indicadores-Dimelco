// Funciones de formato de los visuales. No calculan medidas: solo presentan valores ya calculados.

export const COLORES = {
  verdeCumple: "#00493C",
  naranjaNoCumple: "#F89221",
  verdeTabla: "#0B4A3C",
  semaforoVerde: "#5FB370",
  semaforoRojo: "#F0625A",
  amarilloEtiqueta: "#F5D328",
  grisEtiqueta: "#BDBDBD",
  metaLinea: "#F26B21",
  lineaDisp: "#D4B106",
  lineaMeta: "#1A2A9A",
} as const;

export type FormatoCelda = "texto" | "entero" | "horas" | "pct0" | "pct2" | "fechaHora";

type Nulo = null | undefined;

function esNumero(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Horas con 2 decimales: 46.33 */
export function horas(v: number | Nulo): string {
  return esNumero(v) ? v.toFixed(2) : "";
}

/** Porcentaje sin decimales a partir de una fracción 0..1: 0.66 -> "66%" */
export function pct0(v: number | Nulo): string {
  return esNumero(v) ? `${Math.round(v * 100)}%` : "";
}

/** Porcentaje con 2 decimales, con espacio antes del signo como en el reporte: 0.7728 -> "77.28 %" */
export function pct2(v: number | Nulo): string {
  return esNumero(v) ? `${(v * 100).toFixed(2)} %` : "";
}

export function entero(v: number | Nulo): string {
  return esNumero(v) ? String(Math.round(v)) : "";
}

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/**
 * Fecha y hora como en el reporte: "11/3/2026 6:00:00 PM" (mes/día/año, hora de 12 h).
 * Acepta "aaaa-mm-ddThh:mm:ss" (sin cambiar de zona horaria) o un Date.
 */
export function fechaHora(v: string | Date | Nulo): string {
  if (v === null || v === undefined || v === "") return "";
  let y: number, m: number, d: number, h: number, mi: number, s: number;
  let tieneHora = true;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    y = v.getFullYear(); m = v.getMonth() + 1; d = v.getDate();
    h = v.getHours(); mi = v.getMinutes(); s = v.getSeconds();
  } else {
    const r = RE_FECHA.exec(v);
    if (!r) return String(v);
    y = +r[1]; m = +r[2]; d = +r[3];
    tieneHora = r[4] !== undefined;
    h = +(r[4] ?? 0); mi = +(r[5] ?? 0); s = +(r[6] ?? 0);
  }
  const fecha = `${m}/${d}/${y}`;
  if (!tieneHora) return fecha;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const dd = (n: number) => String(n).padStart(2, "0");
  return `${fecha} ${h12}:${dd(mi)}:${dd(s)} ${h < 12 ? "AM" : "PM"}`;
}

/** Aplica un formato de celda a un valor cualquiera. */
export function formatear(v: unknown, formato: FormatoCelda = "texto"): string {
  if (v === null || v === undefined) return "";
  switch (formato) {
    case "horas": return horas(v as number);
    case "pct0": return pct0(v as number);
    case "pct2": return pct2(v as number);
    case "entero": return entero(v as number);
    case "fechaHora": return fechaHora(v as string | Date);
    default: return String(v);
  }
}

export function esFormatoNumerico(f: FormatoCelda | undefined): boolean {
  return f === "entero" || f === "horas" || f === "pct0" || f === "pct2";
}

/** Parte un nombre en `lineas` líneas de largo parecido, cortando en espacios. */
export function partirNombre(nombre: string, lineas = 2): string {
  const palabras = nombre.split(/\s+/);
  if (palabras.length < 2 || lineas < 2) return nombre;
  const objetivo = nombre.length / lineas;
  const salida: string[] = [];
  let actual = "";
  for (const p of palabras) {
    if (actual && actual.length + 1 + p.length > objetivo * 1.15 && salida.length < lineas - 1) {
      salida.push(actual);
      actual = p;
    } else {
      actual = actual ? `${actual} ${p}` : p;
    }
  }
  salida.push(actual);
  return salida.join("\n");
}
