// Medidas del reporte (contrato, sección 3), traducidas del DAX de `Metricas (2)`, `Metricas` y
// `Metas2026`. Son funciones puras: reciben los paros ya filtrados por equipo y DISP (el conjunto
// `P` del contrato; ver `parosDelContexto`) y el contexto, y devuelven `number | null`, donde
// `null` es el BLANK de DAX.
//
// Las fechas se manejan como días serial con fracción (1 día = 1440 minutos), igual que en DAX.

import { fechaASerial } from "../datos/derivados";
import { contarDias, mesesDelRango, type Contexto } from "./contexto";
import type { Modelo, ParoModelo } from "./modelo";

export const COLOR_CUMPLE = "#00493C";
export const COLOR_NO_CUMPLE = "#F89221";

/** Lo mínimo de un paro que necesita `minParoVentana`. */
export type FilaVentana = Pick<ParoModelo, "inicio" | "fin">;

interface Ventana {
  /** `_ini`: primer día del periodo (serial). */
  f0: number;
  /** `_fin`: último día + 1 (serial); el periodo es [f0, f1). */
  f1: number;
  /** Minutos programados por día. */
  hpm: number;
}

function ventanaDe(ctx: Contexto): Ventana {
  return { f0: fechaASerial(ctx.ini), f1: fechaASerial(ctx.fin) + 1, hpm: ctx.hDisp * 60 };
}

/** MOD de DAX: a - b * INT(a / b). */
function mod(a: number, b: number): number {
  return a - b * Math.floor(a / b);
}

/** Minutos de un paro dentro de la ventana, 0 si el paro no cumple las condiciones del filtro. */
function minutosFila(j: number, k: number, v: Ventana): number {
  if (!(k >= j && j < v.f1 && k > v.f0)) return 0;
  const dR = Math.min(Math.max(v.f0, j), k) - j;
  const r = Math.floor(dR) * v.hpm + Math.min(mod(dR * 1440, 1440), v.hpm);
  const dS = Math.min(Math.max(v.f1, j), k) - j;
  const s = Math.floor(dS) * v.hpm + Math.min(mod(dS * 1440, 1440), v.hpm);
  return s - r;
}

/** Paros P del contrato: en los equipos del contexto y con DISP elegido (vacío = todos). */
export function parosDelContexto(modelo: Modelo, ctx: Contexto): ParoModelo[] {
  const salida: ParoModelo[] = [];
  const dispSet = ctx.disp.length > 0 ? new Set(ctx.disp.map((d) => d.trim())) : null;
  const vistos = ctx.equipos.length > 1 ? new Set<number>() : null;
  for (const id of ctx.equipos) {
    if (vistos) {
      if (vistos.has(id)) continue;
      vistos.add(id);
    }
    const lista = modelo.parosPorEquipo.get(id);
    if (!lista) continue;
    for (const p of lista) if (!dispSet || dispSet.has(p.disp)) salida.push(p);
  }
  return salida;
}

// ---------------------------------------------------------------------------------------------
// Medidas base
// ---------------------------------------------------------------------------------------------

/**
 * `Min Paro Ventana`: minutos de paro de las filas de S que caen en [ini, fin + 1), contando por
 * día solo las horas programadas (`hDisp`). Un paro largo aporta como máximo `hDisp` horas por
 * día calendario.
 */
export function minParoVentana(S: readonly FilaVentana[], ctx: Contexto): number {
  const v = ventanaDe(ctx);
  let total = 0;
  for (const p of S) total += minutosFila(p.inicio, p.fin, v);
  return total;
}

/** `Tiempo_Programado` en minutos: días del periodo * 60 * hDisp * equipos en contexto. Nulo sin fechas. */
export function tiempoProgramado(ctx: Contexto): number | null {
  const dias = contarDias(ctx.ini, ctx.fin);
  if (dias <= 0) return null;
  return dias * 60 * ctx.hDisp * ctx.equipos.length;
}

/** `Paro General Ventana`: minutos de paro sin las filas de "T-FES-NI". */
export function paroGeneralVentana(P: readonly ParoModelo[], ctx: Contexto): number {
  const v = ventanaDe(ctx);
  let total = 0;
  for (const p of P) if (p.general) total += minutosFila(p.inicio, p.fin, v);
  return total;
}

/** `Paro NPI Ventana`: minutos de paro NPI de mantenimiento (T-MTO-ME y T-MTO-EL). */
export function paroNpiVentana(P: readonly ParoModelo[], ctx: Contexto): number {
  const v = ventanaDe(ctx);
  let total = 0;
  for (const p of P) if (p.npiMtto) total += minutosFila(p.inicio, p.fin, v);
  return total;
}

/** `_Cantidad Fallas NPI`: filas NPI de mantenimiento con fin > inicio que tocan la ventana. 0 si no hay. */
export function fallasNpi(P: readonly ParoModelo[], ctx: Contexto): number {
  const { f0, f1 } = ventanaDe(ctx);
  let n = 0;
  for (const p of P) if (p.npiMtto && p.fin > p.inicio && p.inicio < f1 && p.fin > f0) n++;
  return n;
}

// ---------------------------------------------------------------------------------------------
// Medidas derivadas
// ---------------------------------------------------------------------------------------------

/** Valores base de una consulta, calculados en una sola pasada sobre los paros. */
export interface Base {
  programado: number | null;
  paroGeneral: number;
  paroNpi: number;
  fallasNpi: number;
}

/** Calcula las cuatro medidas base de una vez (equivale a llamar a las funciones por separado). */
export function calcularBase(P: readonly ParoModelo[], ctx: Contexto): Base {
  const v = ventanaDe(ctx);
  let paroGeneral = 0;
  let paroNpi = 0;
  let fallas = 0;
  for (const p of P) {
    const j = p.inicio;
    const k = p.fin;
    if (!(k >= j && j < v.f1 && k > v.f0)) continue;
    if (p.general || p.npiMtto) {
      const m = minutosFila(j, k, v);
      if (p.general) paroGeneral += m;
      if (p.npiMtto) {
        paroNpi += m;
        if (k > j) fallas++;
      }
    }
  }
  return { programado: tiempoProgramado(ctx), paroGeneral, paroNpi, fallasNpi: fallas };
}

/** `Disp Din %` a partir de las medidas base. */
export function dispDinDeBase(b: Base): number | null {
  const prog = b.programado;
  if (prog === null || !(prog > 0)) return null;
  return Math.max(0, prog - b.paroGeneral) / prog;
}

/** `MTTR_H` a partir de las medidas base: nulo sin fallas. */
export function mttrHDeBase(b: Base): number | null {
  if (b.fallasNpi === 0) return null;
  return b.paroNpi / 60 / b.fallasNpi;
}

/** `MTBF_H` a partir de las medidas base: nulo sin fallas. */
export function mtbfHDeBase(b: Base): number | null {
  if (b.fallasNpi === 0) return null;
  // En DAX un BLANK en una resta cuenta como 0.
  return Math.max(0, (b.programado ?? 0) - b.paroNpi) / 60 / b.fallasNpi;
}

/** `Confiabilidad_24h`: 1 sin MTBF (sin fallas), 0 con MTBF = 0, si no EXP(-tConf / MTBF). */
export function confiabilidadDeMtbf(mtbf: number | null, tConf: number): number {
  if (mtbf === null) return 1;
  if (mtbf === 0) return 0;
  return Math.exp(-(tConf / mtbf));
}

/** `Disp Din %` = MAX(0, programado - paro general) / programado; nulo si no hay tiempo programado. */
export function dispDin(P: readonly ParoModelo[], ctx: Contexto): number | null {
  return dispDinDeBase({ programado: tiempoProgramado(ctx), paroGeneral: paroGeneralVentana(P, ctx), paroNpi: 0, fallasNpi: 0 });
}

/** `MTTR_H` (horas): paro NPI / 60 / fallas NPI; nulo si no hay fallas. */
export function mttrH(P: readonly ParoModelo[], ctx: Contexto): number | null {
  return mttrHDeBase({ programado: null, paroGeneral: 0, paroNpi: paroNpiVentana(P, ctx), fallasNpi: fallasNpi(P, ctx) });
}

/** `MTBF_H` (horas): (programado - paro NPI) / 60 / fallas NPI; nulo si no hay fallas. */
export function mtbfH(P: readonly ParoModelo[], ctx: Contexto): number | null {
  return mtbfHDeBase({ programado: tiempoProgramado(ctx), paroGeneral: 0, paroNpi: paroNpiVentana(P, ctx), fallasNpi: fallasNpi(P, ctx) });
}

/** `Confiabilidad_24h`. Siempre devuelve un número (sin fallas es 1). */
export function confiabilidad(P: readonly ParoModelo[], ctx: Contexto): number {
  return confiabilidadDeMtbf(mtbfH(P, ctx), ctx.tConf);
}

/** `ProbabilidadDeFalla` = 1 - confiabilidad. */
export function probFalla(P: readonly ParoModelo[], ctx: Contexto): number {
  return 1 - confiabilidad(P, ctx);
}

/** `Hrs Paro Ventana`: minutos de las filas S / 60 si es mayor que 0; si no, nulo. */
export function hrsParoVentana(S: readonly FilaVentana[], ctx: Contexto): number | null {
  const m = minParoVentana(S, ctx);
  return m > 0 ? m / 60 : null;
}

// ---------------------------------------------------------------------------------------------
// Meta y color
// ---------------------------------------------------------------------------------------------

/**
 * `Meta_Disp`: promedio ponderado por días de la meta mensual. Para cada mes que toca [ini, fin],
 * la meta del mes es el promedio simple de las metas de ese mes de los equipos en contexto
 * (relación Metas2026[Familia] -> DIM_EQUIPOS[Descripcion], solo desde equipos hacia metas). Los
 * meses sin meta no cuentan ni en el numerador ni en los días. Nulo si ningún mes tiene meta.
 */
export function metaDisp(modelo: Modelo, ctx: Contexto): number | null {
  const descripciones: string[] = [];
  for (const id of ctx.equipos) {
    const e = modelo.equipos.get(id);
    if (e && !descripciones.includes(e.descNorm)) descripciones.push(e.descNorm);
  }
  let numerador = 0;
  let denominador = 0;
  for (const { mes, dias } of mesesDelRango(ctx.ini, ctx.fin)) {
    let suma = 0;
    let n = 0;
    for (const d of descripciones) {
      const acc = modelo.metas.get(d)?.get(mes);
      if (acc) {
        suma += acc.suma;
        n += acc.n;
      }
    }
    if (n === 0) continue;
    numerador += (suma / n) * dias;
    denominador += dias;
  }
  return denominador > 0 ? numerador / denominador : null;
}

/**
 * `Color_Disponibilidad`: verde si la meta <= disponibilidad, naranja si no. Igual que en DAX, un
 * valor en blanco se compara como 0.
 */
export function colorDisp(meta: number | null, disp: number | null): string {
  return (meta ?? 0) <= (disp ?? 0) ? COLOR_CUMPLE : COLOR_NO_CUMPLE;
}
