// Lector del libro maestro (contrato de datos, sección 1). Funciona en el
// navegador y en Node. Busca las tablas de Excel por nombre en cualquier hoja y
// ubica las columnas por el nombre de su cabecera, no por posición.

import ExcelJS from "exceljs";
import type { DatosModelo, Equipo, Meta, Paro, Responsable, TipoMantto } from "./tipos";

export interface ResultadoLectura {
  datos: DatosModelo;
  /** Problemas no fatales, con hoja y número de fila de Excel. */
  avisos: string[];
  /** Fatales: tabla o columna faltante. Si hay errores, los datos pueden estar incompletos. */
  errores: string[];
  resumen: {
    filasPorTabla: Record<string, number>;
    descartadas: {
      /** Filas de Tabla2 sin aviso (incluye las filas vacías al final de la tabla). */
      sinAviso: number;
      sinFechaFin: number;
      sinEquipo: number;
      /** Fila con aviso, equipo y fecha fin pero sin fecha de inicio válida (no está en el contrato). */
      sinFechaInicio: number;
    };
    /** Menor y mayor fecha de inicio de los paros válidos ("aaaa-mm-dd"), o null si no hay paros. */
    fechaMin: string | null;
    fechaMax: string | null;
  };
}

type Valor = string | number | boolean | Date | null | undefined;

const MAX_AVISOS = 200;

// ---------- conversión de celdas ----------

/** Valor escalar de una celda: resultado de fórmulas, texto enriquecido, hipervínculos. */
function valorCelda(v: ExcelJS.CellValue): Valor {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if ("error" in o) return null;
    if ("result" in o) return valorCelda(o.result as ExcelJS.CellValue);
    if ("formula" in o || "sharedFormula" in o) return undefined; // fórmula sin resultado guardado
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if (typeof o.text === "string") return o.text;
    return null;
  }
  return v as Valor;
}

const vacio = (v: Valor) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

function texto(v: Valor): string {
  if (vacio(v)) return "";
  if (v instanceof Date) return fechaISO(v);
  return String(v).trim();
}

function entero(v: Valor): number | null {
  if (vacio(v)) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(/\.0+$/, ""));
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

function numero(v: Valor): number | null {
  if (vacio(v)) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const pad = (n: number, l = 2) => String(n).padStart(l, "0");
const fechaISO = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const ORIGEN_EXCEL_MS = Date.UTC(1899, 11, 30);

/** Fecha a "aaaa-mm-dd". Acepta Date (UTC), serial de Excel, "aaaa-mm-dd" y "dd/mm/aaaa". */
function fecha(v: Valor): string | null {
  if (vacio(v)) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : fechaISO(v);
  if (typeof v === "number") {
    return v > 0 && v < 2_958_466 ? fechaISO(new Date(ORIGEN_EXCEL_MS + Math.floor(v) * 86_400_000)) : null;
  }
  const t = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}

/** Hora a "hh:mm:ss". Acepta texto "hh:mm[:ss]", fracción de día o Date. Conserva "24:00:00". */
function hora(v: Valor): string | null {
  if (vacio(v)) return null;
  if (typeof v === "string") {
    const m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(v.trim());
    return m ? `${pad(Number(m[1]))}:${pad(Number(m[2]))}:${pad(Number(m[3] ?? 0))}` : null;
  }
  let seg: number;
  if (v instanceof Date) seg = v.getUTCHours() * 3600 + v.getUTCMinutes() * 60 + v.getUTCSeconds();
  else if (typeof v === "number") seg = Math.round((v - Math.floor(v === 1 ? 0 : v)) * 86400);
  else return null;
  return `${pad(Math.floor(seg / 3600))}:${pad(Math.floor((seg % 3600) / 60))}:${pad(seg % 60)}`;
}

/** "dd/mm/aaaa" para la columna Fecha de metas. */
function fechaMeta(v: Valor): string | null {
  const iso = fecha(v);
  if (!iso) return null;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

// ---------- ubicación de tablas ----------

interface TablaLeida {
  hoja: ExcelJS.Worksheet;
  /** nombre de cabecera (recortado) -> número de columna */
  columnas: Map<string, number>;
  filaIni: number; // primera fila de datos
  filaFin: number;
}

function parseRango(ref: string): { c1: number; r1: number; c2: number; r2: number } | null {
  const m = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  const col = (s: string) => [...s.toUpperCase()].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  return { c1: col(m[1]), r1: Number(m[2]), c2: col(m[3]), r2: Number(m[4]) };
}

function buscarTabla(libro: ExcelJS.Workbook, nombre: string): { hoja: ExcelJS.Worksheet; ref: string } | null {
  for (const hoja of libro.worksheets) {
    const tablas = hoja.getTables() as unknown as { table: { name: string; ref?: string; tableRef?: string } }[];
    for (const t of tablas) {
      if (t.table.name === nombre) {
        const ref = t.table.tableRef ?? t.table.ref;
        if (ref) return { hoja, ref };
      }
    }
  }
  return null;
}

function abrirTabla(libro: ExcelJS.Workbook, nombre: string, esperadas: string[], errores: string[]): TablaLeida | null {
  const enc = buscarTabla(libro, nombre);
  if (!enc) {
    errores.push(`No se encontró la tabla ${nombre} en el libro.`);
    return null;
  }
  const rango = parseRango(enc.ref);
  if (!rango) {
    errores.push(`No se pudo interpretar el rango ${enc.ref} de la tabla ${nombre}.`);
    return null;
  }
  const columnas = new Map<string, number>();
  const cab = enc.hoja.getRow(rango.r1);
  for (let c = rango.c1; c <= rango.c2; c++) {
    const t = texto(valorCelda(cab.getCell(c).value));
    if (t) columnas.set(t, c);
  }
  const faltan = esperadas.filter((n) => !columnas.has(n));
  if (faltan.length) {
    errores.push(`La tabla ${nombre} (hoja "${enc.hoja.name}") no tiene las columnas: ${faltan.join(", ")}.`);
    return null;
  }
  return { hoja: enc.hoja, columnas, filaIni: rango.r1 + 1, filaFin: rango.r2 };
}

// ---------- lectura principal ----------

export async function leerLibro(buffer: ArrayBuffer): Promise<ResultadoLectura> {
  const avisos: string[] = [];
  const errores: string[] = [];
  const aviso = (m: string) => {
    if (avisos.length < MAX_AVISOS) avisos.push(m);
    else if (avisos.length === MAX_AVISOS) avisos.push("Hay más avisos; se omiten los restantes.");
  };

  const datos: DatosModelo = { equipos: [], responsables: [], tipos_mantto: [], metas: [], paros: [] };
  const filasPorTabla: Record<string, number> = {};
  const descartadas = { sinAviso: 0, sinFechaFin: 0, sinEquipo: 0, sinFechaInicio: 0 };
  const vaciaResumen = (): ResultadoLectura["resumen"] => ({ filasPorTabla, descartadas, fechaMin: null, fechaMax: null });

  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer as unknown as Parameters<typeof libro.xlsx.load>[0]);
  } catch (e) {
    errores.push(`No se pudo abrir el archivo como libro de Excel (.xlsx): ${e instanceof Error ? e.message : String(e)}`);
    return { datos, avisos, errores, resumen: vaciaResumen() };
  }

  /** Recorre las filas de datos de una tabla; entrega la fila con un lector por nombre de columna. */
  const filas = (t: TablaLeida, fn: (get: (col: string) => Valor, nFila: number) => void) => {
    for (let r = t.filaIni; r <= t.filaFin; r++) {
      const fila = t.hoja.getRow(r);
      fn((col) => valorCelda(fila.getCell(t.columnas.get(col)!).value), r);
    }
  };

  // Tabla5: equipos
  const tEq = abrirTabla(libro, "Tabla5", ["Equipo", "Denominacion del Objeto", "Familia"], errores);
  if (tEq) {
    filas(tEq, (g, r) => {
      if (vacio(g("Equipo")) && vacio(g("Denominacion del Objeto"))) return;
      const id = entero(g("Equipo"));
      if (id === null) return aviso(`Tabla5 fila ${r}: equipo sin código válido; se omite.`);
      datos.equipos.push({ id_equipo: id, descripcion: texto(g("Denominacion del Objeto")), familia: texto(g("Familia")) });
    });
    filasPorTabla.Tabla5 = datos.equipos.length;
  }

  // Tabla18: responsables (sin código se descartan)
  const tRe = abrirTabla(libro, "Tabla18", ["GPO.CODIGOS", "DENOMINACION DE CODIGO", "RESPONSABLE", "DISPONIBILIDAD"], errores);
  if (tRe) {
    filas(tRe, (g) => {
      const id = texto(g("GPO.CODIGOS"));
      if (!id) return;
      datos.responsables.push({
        id_responsable: id,
        denominacion: texto(g("DENOMINACION DE CODIGO")),
        responsable: texto(g("RESPONSABLE")),
        disponibilidad: texto(g("DISPONIBILIDAD")),
      });
    });
    filasPorTabla.Tabla18 = datos.responsables.length;
  }

  // Tabla9: tipos de mantenimiento
  const tTi = abrirTabla(libro, "Tabla9", ["IDTIPO DE MANTTO", "DESCRIPCION"], errores);
  if (tTi) {
    filas(tTi, (g) => {
      const id = texto(g("IDTIPO DE MANTTO"));
      if (!id) return;
      datos.tipos_mantto.push({ id_tipo_mantto: id, descripcion: texto(g("DESCRIPCION")) });
    });
    filasPorTabla.Tabla9 = datos.tipos_mantto.length;
  }

  // Tabla15: metas
  const tMe = abrirTabla(libro, "Tabla15", ["Fecha", "Familia", "Disponibilidad", "MTTR", "MTBF", "Confiabilidad"], errores);
  if (tMe) {
    filas(tMe, (g, r) => {
      if (vacio(g("Fecha")) && vacio(g("Familia")) && vacio(g("Disponibilidad"))) return;
      const mes = fechaMeta(g("Fecha"));
      const meta = numero(g("Disponibilidad"));
      if (!mes) return aviso(`Tabla15 fila ${r}: fecha no válida (${String(g("Fecha"))}); se omite.`);
      if (meta === null) return aviso(`Tabla15 fila ${r}: disponibilidad no numérica; se omite.`);
      datos.metas.push({
        mes,
        equipo_descripcion: texto(g("Familia")),
        meta_disp: meta,
        meta_mttr: numero(g("MTTR")),
        meta_mtbf: numero(g("MTBF")),
        meta_conf: numero(g("Confiabilidad")),
      });
    });
    filasPorTabla.Tabla15 = datos.metas.length;
  }

  // Tabla2: paros
  const colsParo = [
    "Equipo", "Aviso", "Inicio avería", "Hora in-avería", "Fin de avería", "Hora fin avería", "Duración parada",
    "Descripción", "Grupo de codigos", "Codificación", "Codif-txt-cód-", "Status usuario", "Tipo de Paro(PP/NPI)",
    "Resumen de actividad",
  ];
  const tPa = abrirTabla(libro, "Tabla2", colsParo, errores);
  if (tPa) {
    const idsEquipo = new Set(datos.equipos.map((e) => e.id_equipo));
    let leidas = 0;
    let fMin: string | null = null;
    let fMax: string | null = null;
    filas(tPa, (g, r) => {
      leidas++;
      const av = entero(g("Aviso"));
      if (av === null) {
        if (!vacio(g("Aviso"))) aviso(`Tabla2 fila ${r}: aviso no numérico (${String(g("Aviso"))}); fila descartada.`);
        descartadas.sinAviso++;
        return;
      }
      const idEq = entero(g("Equipo"));
      if (idEq === null || !idsEquipo.has(idEq)) {
        descartadas.sinEquipo++;
        return;
      }
      const fFin = fecha(g("Fin de avería"));
      if (!fFin) {
        if (!vacio(g("Fin de avería"))) aviso(`Tabla2 fila ${r} (aviso ${av}): fecha de fin no válida (${String(g("Fin de avería"))}).`);
        descartadas.sinFechaFin++;
        return;
      }
      const fIni = fecha(g("Inicio avería"));
      if (!fIni) {
        aviso(`Tabla2 fila ${r} (aviso ${av}): sin fecha de inicio válida; fila descartada.`);
        descartadas.sinFechaInicio++;
        return;
      }
      let hIni = hora(g("Hora in-avería"));
      if (hIni === null) {
        aviso(`Tabla2 fila ${r} (aviso ${av}): hora de inicio vacía o inválida (${String(g("Hora in-avería"))}); se usa 00:00:00.`);
        hIni = "00:00:00";
      }
      if (hIni === "24:00:00") hIni = "00:00:00"; // regla de Power Query: solo en inicio
      let hFin = hora(g("Hora fin avería"));
      if (hFin === null) {
        aviso(`Tabla2 fila ${r} (aviso ${av}): hora de fin vacía o inválida (${String(g("Hora fin avería"))}); se usa 00:00:00.`);
        hFin = "00:00:00";
      }
      let dur = numero(g("Duración parada"));
      if (dur === null && g("Duración parada") === undefined) {
        // Fórmula sin resultado guardado: se recalcula como en la hoja (minutos, 2 decimales).
        dur = Math.round(((serial(fFin) + frac(hFin)) - (serial(fIni) + frac(hIni))) * 1440 * 100) / 100;
      }
      datos.paros.push({
        id_equipo: idEq,
        aviso: av,
        fecha_inicio: fIni,
        hora_inicio: hIni,
        fecha_fin: fFin,
        hora_fin: hFin,
        duracion_min: dur,
        desc_paro: texto(g("Descripción")),
        id_responsable: texto(g("Grupo de codigos")),
        cod_falla: texto(g("Codificación")),
        texto_falla: texto(g("Codif-txt-cód-")),
        id_tipo_mantto: texto(g("Status usuario")),
        tipo_paro_pp_npi: texto(g("Tipo de Paro(PP/NPI)")),
        resumen: texto(g("Resumen de actividad")),
      });
      if (fMin === null || fIni < fMin) fMin = fIni;
      if (fMax === null || fIni > fMax) fMax = fIni;
    });
    filasPorTabla.Tabla2 = leidas;
    filasPorTabla["Tabla2 (paros válidos)"] = datos.paros.length;
    return { datos, avisos, errores, resumen: { filasPorTabla, descartadas, fechaMin: fMin, fechaMax: fMax } };
  }

  return { datos, avisos, errores, resumen: vaciaResumen() };
}

function serial(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - ORIGEN_EXCEL_MS) / 86_400_000);
}
function frac(h: string): number {
  const [hh, mm, ss] = h.split(":").map(Number);
  return (hh * 3600 + mm * 60 + ss) / 86400;
}
