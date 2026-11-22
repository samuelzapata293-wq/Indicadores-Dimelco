// Datos de cada visual del reporte, armados a partir del modelo precalculado y del contexto.
// Funciones puras; no tocan la interfaz. Las medidas viven en medidas.ts.

import { primerDiaMes, semanasDelRango, serialAIso, sumarMeses, type Contexto } from "./contexto";
import {
  calcularBase,
  colorDisp,
  confiabilidadDeMtbf,
  dispDinDeBase,
  metaDisp,
  minParoVentana,
  mtbfHDeBase,
  mttrHDeBase,
  parosDelContexto,
  type Base,
} from "./medidas";
import { equiposValidos, type Modelo, type ParoModelo } from "./modelo";

/** Comparación de texto sin distinguir mayúsculas, como el orden de Power BI. */
const COLACION = new Intl.Collator("es", { sensitivity: "accent" });

/** Contexto de un solo conjunto de equipos (una fila, una columna o una familia). */
function conEquipos(ctx: Contexto, equipos: number[]): Contexto {
  return { ...ctx, equipos };
}

// ---------------------------------------------------------------------------------------------
// Gráfico combinado de las páginas de familia
// ---------------------------------------------------------------------------------------------

export interface FilaGrafico {
  id: number;
  descripcion: string;
  /** Columna: Disp Din %, fracción 0 a 1 (null = en blanco). */
  dispDin: number | null;
  /** Línea: Meta_Disp, fracción 0 a 1 (null = en blanco). */
  metaDisp: number | null;
  /** "#00493C" cumple la meta, "#F89221" no. */
  color: string;
}

/** Una columna por equipo en contexto, en el orden de `ctx.equipos`. */
export function graficoFamilia(modelo: Modelo, ctx: Contexto): FilaGrafico[] {
  return equiposValidos(modelo, ctx.equipos).map((id) => {
    const c = conEquipos(ctx, [id]);
    const d = dispDinDeBase(calcularBase(parosDelContexto(modelo, c), c));
    const m = metaDisp(modelo, c);
    return { id, descripcion: modelo.equipos.get(id)!.descripcion, dispDin: d, metaDisp: m, color: colorDisp(m, d) };
  });
}

// ---------------------------------------------------------------------------------------------
// Tabla de paros
// ---------------------------------------------------------------------------------------------

export interface FilaParo {
  /** Sap: id del equipo. */
  sap: number;
  /** Equipo: descripción. */
  equipo: string;
  /** Suma del aviso de las filas agrupadas (Power BI suma la columna Aviso al agrupar). */
  aviso: number;
  /** Descripción del Paro. */
  descripcion: string;
  /** _F/H Inicio, "aaaa-mm-ddThh:mm:ss". */
  inicio: string;
  /** _F/H Fin, "aaaa-mm-ddThh:mm:ss". */
  fin: string;
  /** Mismos valores como serial de Excel (para ordenar o formatear). */
  inicioSerial: number;
  finSerial: number;
  /** Hrs Paro Ventana (siempre > 0). */
  hrsParoVentana: number;
  /** Responsable: "Mantenimiento", "Operación" o el código. */
  responsable: string;
  /** Tipo de Paro(PP/NPI). */
  tipoParo: string;
}

/**
 * Filas de la tabla de paros. La tabla de Power BI agrupa por Sap, Equipo, Descripción, inicio,
 * fin, Responsable y Tipo de Paro (texto sin distinguir mayúsculas): las filas del Excel idénticas en
 * esas columnas (avisos repetidos) salen como una sola fila, con el aviso sumado y las horas de
 * ventana de todas ellas.
 * Solo se muestran las filas con Hrs Paro Ventana > 0, de mayor a menor. Los empates se ordenan
 * como Power BI: Sap, Descripción del Paro, inicio y fin (todo ascendente).
 * `equipoSeleccionado` filtra la tabla a ese equipo (clic en una columna del gráfico).
 */
export function tablaParos(modelo: Modelo, ctx: Contexto, equipoSeleccionado?: number | null): FilaParo[] {
  let equipos = ctx.equipos;
  if (equipoSeleccionado !== undefined && equipoSeleccionado !== null) equipos = equipos.filter((id) => id === equipoSeleccionado);
  const c = conEquipos(ctx, equiposValidos(modelo, equipos));
  const grupos = new Map<string, { filas: ParoModelo[]; aviso: number }>();
  for (const p of parosDelContexto(modelo, c)) {
    const clave = p.claveTabla;
    const g = grupos.get(clave);
    if (g) {
      g.filas.push(p);
      g.aviso += p.aviso;
    } else grupos.set(clave, { filas: [p], aviso: p.aviso });
  }
  const salida: FilaParo[] = [];
  for (const { filas, aviso } of grupos.values()) {
    const minutos = minParoVentana(filas, c);
    if (!(minutos > 0)) continue;
    const p = filas[0];
    salida.push({
      sap: p.idEquipo,
      equipo: modelo.equipos.get(p.idEquipo)!.descripcion,
      aviso,
      descripcion: p.descParo,
      inicio: serialAIso(p.inicio),
      fin: serialAIso(p.fin),
      inicioSerial: p.inicio,
      finSerial: p.fin,
      hrsParoVentana: minutos / 60,
      responsable: p.responsable,
      tipoParo: p.tipoParoPpNpi,
    });
  }
  // Orden de Power BI: primero la medida (Hrs Paro Ventana) de mayor a menor con su valor exacto,
  // ruido de punto flotante incluido (12.000000000058 va antes que 12, y el motor lo reproduce igual
  // que el DAX); los empates siguen el orden de las columnas de la tabla: Sap, Equipo, Descripción
  // (sin distinguir mayúsculas), inicio y fin.
  salida.sort(
    (a, b) =>
      b.hrsParoVentana - a.hrsParoVentana ||
      a.sap - b.sap ||
      COLACION.compare(a.descripcion, b.descripcion) ||
      a.inicioSerial - b.inicioSerial ||
      a.finSerial - b.finSerial ||
      a.aviso - b.aviso,
  );
  return salida;
}

// ---------------------------------------------------------------------------------------------
// Resumen Disp.
// ---------------------------------------------------------------------------------------------

interface Indicadores {
  mttrH: number | null;
  mtbfH: number | null;
  dispDin: number | null;
  metaDisp: number | null;
  color: string;
  confiabilidad: number;
  probFalla: number;
  /** Brecha_Disp dn: Disp Din % - Meta_Disp (null si falta alguno). */
  brecha: number | null;
}

function indicadores(modelo: Modelo, c: Contexto): Indicadores {
  const base: Base = calcularBase(parosDelContexto(modelo, c), c);
  const mtbf = mtbfHDeBase(base);
  const conf = confiabilidadDeMtbf(mtbf, c.tConf);
  const d = dispDinDeBase(base);
  const m = metaDisp(modelo, c);
  return {
    mttrH: mttrHDeBase(base),
    mtbfH: mtbf,
    dispDin: d,
    metaDisp: m,
    color: colorDisp(m, d),
    confiabilidad: conf,
    probFalla: 1 - conf,
    brecha: d !== null && m !== null ? d - m : null,
  };
}

export interface FilaResumenEquipo extends Indicadores {
  id: number;
  descripcion: string;
}

/** Tabla por equipo: MTTR, MTBF, Meta, Disponibilidad, Confiabilidad y Probabilidad de falla. */
export function resumenPorEquipo(modelo: Modelo, ctx: Contexto): FilaResumenEquipo[] {
  return equiposValidos(modelo, ctx.equipos).map((id) => ({
    id,
    descripcion: modelo.equipos.get(id)!.descripcion,
    ...indicadores(modelo, conEquipos(ctx, [id])),
  }));
}

export interface FilaResumenFamilia extends Indicadores {
  familia: string;
  equipos: number[];
}

/** Tabla por familia: los equipos en contexto agrupados por DIM_EQUIPOS[Familia] (orden de aparición). */
export function resumenPorFamilia(modelo: Modelo, ctx: Contexto): FilaResumenFamilia[] {
  const porFamilia = new Map<string, number[]>();
  for (const id of equiposValidos(modelo, ctx.equipos)) {
    const familia = modelo.equipos.get(id)!.familia;
    const lista = porFamilia.get(familia);
    if (lista) lista.push(id);
    else porFamilia.set(familia, [id]);
  }
  return [...porFamilia].map(([familia, equipos]) => ({ familia, equipos, ...indicadores(modelo, conEquipos(ctx, equipos)) }));
}

// ---------------------------------------------------------------------------------------------
// Disp Mensual
// ---------------------------------------------------------------------------------------------

export interface PuntoSemana {
  /** "Sem 45/26". */
  etiqueta: string;
  /** WEEKNUM (tipo 1). */
  semana: number;
  /** Primer y último día de la semana dentro del periodo. */
  ini: string;
  fin: string;
  dispDin: number | null;
  metaDisp: number | null;
}

export interface PanelSemanal {
  id: number;
  descripcion: string;
  puntos: PuntoSemana[];
}

/**
 * Un panel por equipo con un punto por semana del periodo: Disp Din % y Meta_Disp calculadas con
 * `ini` y `fin` de la semana (recortados al periodo).
 */
export function panelesSemanales(modelo: Modelo, ctx: Contexto): PanelSemanal[] {
  const semanas = semanasDelRango(ctx.ini, ctx.fin);
  return equiposValidos(modelo, ctx.equipos).map((id) => {
    const pBase = conEquipos(ctx, [id]);
    const P = parosDelContexto(modelo, pBase); // filtrar por equipo y DISP una sola vez
    const puntos = semanas.map((s) => {
      const c: Contexto = { ...pBase, ini: s.ini, fin: s.fin };
      return {
        etiqueta: s.etiqueta,
        semana: s.semana,
        ini: s.ini,
        fin: s.fin,
        dispDin: dispDinDeBase(calcularBase(P, c)),
        metaDisp: metaDisp(modelo, c),
      };
    });
    return { id, descripcion: modelo.equipos.get(id)!.descripcion, puntos };
  });
}

// ---------------------------------------------------------------------------------------------
// Periodo inicial de los segmentadores
// ---------------------------------------------------------------------------------------------

export interface PeriodoInicial {
  /** Páginas de familia y Resumen: del primer día del mes de la fecha de inicio más reciente hasta esa fecha. */
  general: { ini: string; fin: string };
  /** Disp Mensual: desde el primer día del mes cuatro meses antes hasta esa misma fecha. */
  mensual: { ini: string; fin: string };
}

/** Periodo inicial (contrato, sección 4). `null` si no hay paros. */
export function periodoInicial(modelo: Modelo): PeriodoInicial | null {
  const fin = modelo.maxFechaInicio;
  if (!fin) return null;
  return {
    general: { ini: primerDiaMes(fin), fin },
    mensual: { ini: sumarMeses(fin, -4), fin },
  };
}
