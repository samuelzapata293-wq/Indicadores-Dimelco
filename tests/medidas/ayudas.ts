// Ayudas compartidas de las pruebas del motor de medidas: carga de fixtures, armado del contexto a
// partir de los filtros de una captura de Power BI y comparación con tolerancia.

import { readFileSync } from "node:fs";
import type { DatosModelo } from "../../src/datos/tipos";
import { sumarDias, type Contexto, type HorasConf, type HorasDisp } from "../../src/medidas/contexto";
import { normalizarTexto, prepararModelo, type Modelo } from "../../src/medidas/modelo";

const RAIZ = new URL("../fixtures/", import.meta.url);

export interface Fixture {
  origen: string;
  pagina: string;
  visual: { tipo: string; titulo: string; descripcion: string };
  campos: { nombre: string; campo: string; alias_visual: string | null }[];
  filtros: Record<string, { in?: (string | null)[]; not_in?: (string | null)[]; ">="?: string; "<"?: string; ">"?: number }>;
  filas: Record<string, string | number | null>[];
}

export function cargarFixture(nombre: string): Fixture {
  return JSON.parse(readFileSync(new URL(`powerbi/${nombre}.json`, RAIZ), "utf8"));
}

let modeloCache: Modelo | null = null;
export function cargarDatos(): DatosModelo {
  return JSON.parse(readFileSync(new URL("datos/muestra.json", RAIZ), "utf8"));
}
export function cargarModelo(): Modelo {
  return (modeloCache ??= prepararModelo(cargarDatos()));
}

/** Contexto equivalente a los filtros de una consulta de Power BI. */
export function contextoDeFixture(modelo: Modelo, fx: Fixture): Contexto {
  const f = fx.filtros;
  const fecha = f["DIM_TIEMPO[Fecha]"];
  const ini = fecha[">="]!.slice(0, 10);
  const fin = sumarDias(fecha["<"]!.slice(0, 10), -1); // el reporte guarda el fin excluyente

  // Equipos: lista IN menos lista NOT IN de Descripcion, y filtro de Familia si existe.
  const desc = f["DIM_EQUIPOS[Descripcion]"];
  const dentro = new Set((desc.in ?? []).map((x) => normalizarTexto(x)));
  const fuera = new Set((desc.not_in ?? []).map((x) => normalizarTexto(x)));
  const familias = f["DIM_EQUIPOS[Familia]"]?.in?.map((x) => normalizarTexto(x));
  const equipos = modelo.listaEquipos
    .filter((e) => dentro.has(e.descNorm) && !fuera.has(e.descNorm) && (!familias || familias.includes(normalizarTexto(e.familia))))
    .map((e) => e.id);

  // DISP GLOBAL: un NOT IN deja pasar todos los demás valores de DISP (también los códigos sueltos).
  const d = f["HECHOS_DATAMES_NPI_PP[DISP]"];
  let disp: string[] = [];
  if (d?.in) disp = d.in.filter((x): x is string => x !== null);
  if (d?.not_in) disp = (d.in ? disp : modelo.valoresDisp).filter((x) => !d.not_in!.includes(x));

  const h = f["Var_t: Disp[Var_t: Disp]"]?.in?.[0];
  const c = f["Confiabilidad[Confiabilidad]"]?.in?.[0];
  return {
    ini,
    fin,
    equipos,
    disp,
    hDisp: (h ? parseInt(String(h), 10) : 24) as HorasDisp,
    tConf: (c ? parseInt(String(c), 10) : 18) as HorasConf,
  };
}

// ---------------------------------------------------------------------------------------------
// Comparación y reporte
// ---------------------------------------------------------------------------------------------

export interface Resultado {
  fixture: string;
  visual: string;
  filas: number;
  comparaciones: number;
  coinciden: number;
  difMaxFraccion: number;
  difMaxHoras: number;
}

export class Comparador {
  comparaciones = 0;
  coinciden = 0;
  difMaxFraccion = 0;
  difMaxHoras = 0;
  fallas: string[] = [];

  /** Compara un número; `tipo` fija la tolerancia (fracción: 0.0001; horas: 0.01). `null` solo coincide con `null`. */
  num(etiqueta: string, esperado: number | null | undefined, obtenido: number | null, tipo: "fraccion" | "horas") {
    this.comparaciones++;
    const e = esperado ?? null;
    const tol = tipo === "fraccion" ? 0.0001 : 0.01;
    let ok: boolean;
    let dif = 0;
    if (e === null || obtenido === null) ok = e === obtenido;
    else {
      dif = Math.abs(e - obtenido);
      ok = dif <= tol;
    }
    if (ok) this.coinciden++;
    else this.fallas.push(`${etiqueta}: esperado ${e} obtenido ${obtenido}`);
    if (tipo === "fraccion") this.difMaxFraccion = Math.max(this.difMaxFraccion, dif);
    else this.difMaxHoras = Math.max(this.difMaxHoras, dif);
  }

  texto(etiqueta: string, esperado: unknown, obtenido: unknown) {
    this.comparaciones++;
    if (esperado === obtenido) this.coinciden++;
    else this.fallas.push(`${etiqueta}: esperado ${JSON.stringify(esperado)} obtenido ${JSON.stringify(obtenido)}`);
  }

  resultado(fixture: string, visual: string, filas: number): Resultado {
    return {
      fixture,
      visual,
      filas,
      comparaciones: this.comparaciones,
      coinciden: this.coinciden,
      difMaxFraccion: Number(this.difMaxFraccion.toExponential(2)),
      difMaxHoras: Number(this.difMaxHoras.toExponential(2)),
    };
  }
}

export const resultados: Resultado[] = [];

export function mostrarResultados(titulo: string) {
  console.log(`\n=== ${titulo} ===`);
  console.table(resultados.splice(0));
}
