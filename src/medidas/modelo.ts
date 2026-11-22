// Modelo precalculado para el motor de medidas.
//
// `prepararModelo` se ejecuta una sola vez por carga de datos. Deja todo lo que no depende de los
// filtros (inicio/fin en serial, DISP, responsable, banderas de los filtros de las medidas, índice
// por equipo, metas por mes) para que recalcular al mover un segmentador solo recorra los paros de
// los equipos en contexto.

import { disp as dispDeResponsable, fin as finDeParo, inicio as inicioDeParo, responsable as responsableDe } from "../datos/derivados";
import type { DatosModelo, Equipo } from "../datos/tipos";

/**
 * Comparación de texto como la de Power BI: sin distinguir mayúsculas y sin espacios al inicio ni
 * al final. Se usa en las relaciones (meta -> equipo) y en los filtros por código.
 */
export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? "").trim().toUpperCase();
}

export const RESPONSABLE_FUERA_ESTADISTICA = "T-FES-NI";
export const RESPONSABLES_MTTO: readonly string[] = ["T-MTO-ME", "T-MTO-EL"];
export const TIPO_NPI = "NPI";

export interface EquipoModelo {
  id: number;
  /** Descripción recortada, tal como se muestra. */
  descripcion: string;
  /** Descripción normalizada (mayúsculas, sin espacios en los extremos): clave de la relación con las metas. */
  descNorm: string;
  familia: string;
}

/** Fila de paro con todo lo que las medidas necesitan ya calculado. */
export interface ParoModelo {
  idEquipo: number;
  aviso: number;
  /** Serial de Excel (días con fracción). */
  inicio: number;
  fin: number;
  /**
   * Descripción del paro. Power BI agrupa y compara texto sin distinguir mayúsculas, y muestra la
   * primera grafía que cargó en la columna; aquí se guarda esa misma grafía (primera aparición en
   * el orden de los datos) para que las filas que solo difieren en mayúsculas salgan iguales.
   */
  descParo: string;
  idResponsable: string;
  /** "Mecánica", "Operacional" o el propio código (campo DISP del reporte). */
  disp: string;
  /** "Mantenimiento", "Operación" o el propio código (campo Responsable del reporte). */
  responsable: string;
  tipoParoPpNpi: string;
  /** Clave de agrupación de la tabla de paros (equipo, descripción, inicio, fin, responsable y tipo, sin mayúsculas ni espacios en los extremos). */
  claveTabla: string;
  /**
   * Pasa el filtro de "Paro General": IDResponsable <> "T-FES-NI". Las filas con responsable vacío o
   * desconocido sí pasan (en DAX caen en el miembro en blanco de DIM_RESPONSABLE).
   */
  general: boolean;
  /**
   * Pasa el filtro de "Paro NPI": responsable en {T-MTO-ME, T-MTO-EL} (y existente en la tabla de
   * responsables) y tipo de mantenimiento "NPI" (y existente en la tabla de tipos).
   */
  npiMtto: boolean;
}

export interface MetaAcumulada {
  suma: number;
  n: number;
}

export interface Modelo {
  equipos: Map<number, EquipoModelo>;
  /** Equipos en el orden de la tabla de entrada. */
  listaEquipos: EquipoModelo[];
  paros: ParoModelo[];
  /** Paros por id_equipo. */
  parosPorEquipo: Map<number, ParoModelo[]>;
  /** Metas: descNorm -> "aaaa-mm-dd" (primer día del mes) -> suma y cantidad de filas con meta. */
  metas: Map<string, Map<string, MetaAcumulada>>;
  /** Valores distintos de DISP presentes en los paros (para convertir un "NOT IN" en una lista). */
  valoresDisp: string[];
  /** Fecha de inicio más reciente de los paros, "aaaa-mm-dd" ("" si no hay paros). */
  maxFechaInicio: string;
  /** Familias distintas, en orden de aparición. */
  familias: string[];
}

/** "dd/mm/aaaa" (o ya ISO "aaaa-mm-dd") -> "aaaa-mm-dd". "" si no se reconoce. */
export function mesMetaAIso(mes: string): string {
  const t = (mes ?? "").trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

export function prepararModelo(datos: DatosModelo): Modelo {
  const equipos = new Map<number, EquipoModelo>();
  const listaEquipos: EquipoModelo[] = [];
  const familias: string[] = [];
  for (const e of datos.equipos as Equipo[]) {
    const descripcion = e.descripcion.trim();
    const em: EquipoModelo = { id: e.id_equipo, descripcion, descNorm: normalizarTexto(descripcion), familia: e.familia.trim() };
    equipos.set(em.id, em);
    listaEquipos.push(em);
    if (!familias.includes(em.familia)) familias.push(em.familia);
  }

  const respConocidos = new Set(datos.responsables.map((r) => normalizarTexto(r.id_responsable)));
  const tiposConocidos = new Set(datos.tipos_mantto.map((t) => normalizarTexto(t.id_tipo_mantto)));

  // Grafía que muestra Power BI para cada texto: la primera que aparece en la columna.
  const primeraGrafia = (mapa: Map<string, string>, texto: string): string => {
    const k = normalizarTexto(texto);
    const previa = mapa.get(k);
    if (previa !== undefined) return previa;
    mapa.set(k, texto);
    return texto;
  };
  const grafiaDesc = new Map<string, string>();
  const grafiaResp = new Map<string, string>();
  const grafiaTipo = new Map<string, string>();

  const paros: ParoModelo[] = [];
  const parosPorEquipo = new Map<number, ParoModelo[]>();
  const valoresDisp = new Set<string>();
  let maxFechaInicio = "";
  for (const p of datos.paros) {
    if (!equipos.has(p.id_equipo)) continue; // el importador ya los descarta; por seguridad
    const inicio = inicioDeParo(p);
    const fin = finDeParo(p);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin)) continue;
    const idResp = normalizarTexto(p.id_responsable);
    const tipo = normalizarTexto(p.id_tipo_mantto);
    const d = dispDeResponsable(p.id_responsable);
    const descParo = primeraGrafia(grafiaDesc, p.desc_paro);
    const responsable = primeraGrafia(grafiaResp, responsableDe(p.id_responsable));
    const tipoParoPpNpi = primeraGrafia(grafiaTipo, p.tipo_paro_pp_npi);
    const fila: ParoModelo = {
      idEquipo: p.id_equipo,
      aviso: p.aviso,
      inicio,
      fin,
      descParo,
      idResponsable: p.id_responsable.trim(),
      disp: d,
      responsable,
      tipoParoPpNpi,
      claveTabla: [p.id_equipo, normalizarTexto(descParo), inicio, fin, normalizarTexto(responsable), normalizarTexto(tipoParoPpNpi)].join("\u0001"),
      general: idResp !== RESPONSABLE_FUERA_ESTADISTICA,
      npiMtto: RESPONSABLES_MTTO.includes(idResp) && respConocidos.has(idResp) && tipo === TIPO_NPI && tiposConocidos.has(tipo),
    };
    paros.push(fila);
    let lista = parosPorEquipo.get(fila.idEquipo);
    if (!lista) parosPorEquipo.set(fila.idEquipo, (lista = []));
    lista.push(fila);
    valoresDisp.add(d);
    if (p.fecha_inicio > maxFechaInicio) maxFechaInicio = p.fecha_inicio;
  }

  const metas = new Map<string, Map<string, MetaAcumulada>>();
  for (const m of datos.metas) {
    if (m.meta_disp === null || m.meta_disp === undefined || !Number.isFinite(m.meta_disp)) continue; // AVERAGE ignora vacíos
    const mes = mesMetaAIso(m.mes);
    if (!mes) continue;
    const clave = normalizarTexto(m.equipo_descripcion);
    let porMes = metas.get(clave);
    if (!porMes) metas.set(clave, (porMes = new Map()));
    const acc = porMes.get(mes);
    if (acc) {
      acc.suma += m.meta_disp;
      acc.n += 1;
    } else porMes.set(mes, { suma: m.meta_disp, n: 1 });
  }

  return { equipos, listaEquipos, paros, parosPorEquipo, metas, valoresDisp: [...valoresDisp], maxFechaInicio, familias };
}

/** Ids únicos de `ids` que existen en el modelo (DISTINCTCOUNT de DIM_EQUIPOS[IDEQUIPO] en contexto). */
export function equiposValidos(modelo: Modelo, ids: readonly number[]): number[] {
  const vistos = new Set<number>();
  const salida: number[] = [];
  for (const id of ids) {
    if (modelo.equipos.has(id) && !vistos.has(id)) {
      vistos.add(id);
      salida.push(id);
    }
  }
  return salida;
}
