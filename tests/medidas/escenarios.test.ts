import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leerLibro } from "../../src/datos/excel";
import type { Contexto } from "../../src/medidas/contexto";
import { prepararModelo, type Modelo } from "../../src/medidas/modelo";
import { graficoFamilia, panelesSemanales, resumenPorEquipo, resumenPorFamilia, tablaParos } from "../../src/medidas/visuales";
import { cargarDatos, cargarModelo, Comparador, contextoDeFixture, type Fixture, type Resultado } from "./ayudas";

// Escenarios nuevos de filtros: cada fixture de tests/fixtures/powerbi_escenarios/ es la respuesta real
// del reporte público (obtenida con tools/consultar_powerbi.py reenviando una consulta capturada con
// otros filtros). Se compara el motor con esos valores, con la muestra de tests/fixtures/datos y con
// el Excel completo de datos_local cuando existe.
//
// Diferencias conocidas: ver KNOWN_DIFFS más abajo y docs/pruebas/escenarios_powerbi.md.

type FixtureEscenario = Fixture & {
  escenario: string;
  escenario_descripcion: string;
  visual_clave: string;
  origen: string;
  consulta: number;
};

const DIR = new URL("../fixtures/powerbi_escenarios/", import.meta.url);
const RUTA_EXCEL = new URL("../../datos_local/LIBRO_MAESTRO_15-09-2026.xlsx", import.meta.url).pathname;
/** La muestra solo trae paros con fin >= esta fecha: un periodo que empiece antes no cabe en ella. */
const INICIO_MUESTRA = "2026-06-01";

const FIXTURES: FixtureEscenario[] = readdirSync(DIR)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => JSON.parse(readFileSync(new URL(n, DIR), "utf8")) as FixtureEscenario);

const nombreFixture = (fx: FixtureEscenario) => `${fx.escenario}_${fx.visual_clave}`;

/**
 * Diferencias que el motor tiene con Power BI y que no se corrigen aquí (src/medidas no se toca en
 * esta tarea). Clave: `<fixture>@<fuente>` con fuente "muestra" o "excel". El valor es la causa
 * probable; la prueba se marca con it.fails, así que falla en cuanto el motor deje de diferir.
 */
const KNOWN_DIFFS: Record<string, string> = {};

// ---------------------------------------------------------------------------------------------
// Comparadores por visual (devuelven el resultado; las aserciones están en las pruebas)
// ---------------------------------------------------------------------------------------------

interface Salida {
  res: Resultado;
  fallas: string[];
  grafiasDistintas: number;
}

function resumenEquipo(modelo: Modelo, ctx: Contexto, fx: FixtureEscenario): Salida {
  const filas = resumenPorEquipo(modelo, ctx);
  const cmp = new Comparador();
  if (filas.length !== fx.filas.length) cmp.fallas.push(`filas: esperado ${fx.filas.length} obtenido ${filas.length}`);
  for (const esp of fx.filas) {
    const id = Number(esp["DIM_EQUIPOS.IDEQUIPO"]);
    const o = filas.find((f) => f.id === id);
    if (!o) {
      cmp.fallas.push(`equipo ${id}: falta en el motor`);
      continue;
    }
    const e = `eq ${id}`;
    cmp.num(`${e} MTTR`, esp["Metricas (2).MTTR_H"] as number, o.mttrH, "horas");
    cmp.num(`${e} MTBF`, esp["Metricas (2).MTBF_H"] as number, o.mtbfH, "horas");
    cmp.num(`${e} meta`, esp["Metas2026.Meta_Disp"] as number, o.metaDisp, "fraccion");
    cmp.num(`${e} disp`, esp["Metricas (2).Disp Din %"] as number, o.dispDin, "fraccion");
    cmp.num(`${e} conf`, esp["Metricas.Confiabilidad_24h"] as number, o.confiabilidad, "fraccion");
    cmp.num(`${e} prob`, esp["Metricas.ProbabilidadDeFalla"] as number, o.probFalla, "fraccion");
    cmp.num(`${e} brecha`, esp["Metricas (2).Brecha_Disp dn"] as number, o.brecha, "fraccion");
    cmp.texto(`${e} descripcion`, esp["DIM_EQUIPOS.Descripcion"], o.descripcion);
  }
  return { res: cmp.resultado(nombreFixture(fx), "Resumen por equipo", fx.filas.length), fallas: cmp.fallas, grafiasDistintas: 0 };
}

function resumenFamilia(modelo: Modelo, ctx: Contexto, fx: FixtureEscenario): Salida {
  const filas = resumenPorFamilia(modelo, ctx);
  const cmp = new Comparador();
  if (filas.length !== fx.filas.length) cmp.fallas.push(`filas: esperado ${fx.filas.length} obtenido ${filas.length}`);
  for (const esp of fx.filas) {
    const fam = esp["DIM_EQUIPOS.Familia"] as string;
    const o = filas.find((f) => f.familia === fam);
    if (!o) {
      cmp.fallas.push(`familia ${fam}: falta en el motor`);
      continue;
    }
    cmp.num(`${fam} MTTR`, esp["Metricas (2).MTTR_H"] as number, o.mttrH, "horas");
    cmp.num(`${fam} MTBF`, esp["Metricas (2).MTBF_H"] as number, o.mtbfH, "horas");
    cmp.num(`${fam} disp`, esp["Metricas (2).Disp Din %"] as number, o.dispDin, "fraccion");
    cmp.num(`${fam} conf`, esp["Metricas.Confiabilidad_24h"] as number, o.confiabilidad, "fraccion");
    cmp.num(`${fam} prob`, esp["Metricas.ProbabilidadDeFalla"] as number, o.probFalla, "fraccion");
  }
  return { res: cmp.resultado(nombreFixture(fx), "Resumen por familia", fx.filas.length), fallas: cmp.fallas, grafiasDistintas: 0 };
}

function grafico(modelo: Modelo, ctx: Contexto, fx: FixtureEscenario): Salida {
  const filas = graficoFamilia(modelo, ctx);
  const cmp = new Comparador();
  const esperados = fx.filas.map((f) => f["DIM_EQUIPOS.Descripcion"] as string).sort();
  const obtenidos = filas.map((f) => f.descripcion).sort();
  if (JSON.stringify(esperados) !== JSON.stringify(obtenidos)) cmp.fallas.push(`equipos: esperado ${esperados.join(", ")} obtenido ${obtenidos.join(", ")}`);
  for (const esp of fx.filas) {
    const desc = esp["DIM_EQUIPOS.Descripcion"] as string;
    const o = filas.find((f) => f.descripcion === desc);
    if (!o) continue;
    cmp.num(`${desc} disp`, esp["Metricas (2).Disp Din %"] as number, o.dispDin, "fraccion");
    cmp.num(`${desc} meta`, esp["Metas2026.Meta_Disp"] as number, o.metaDisp, "fraccion");
    cmp.texto(`${desc} color`, esp["Metas2026.Color_Disponibilidad"], o.color);
  }
  return { res: cmp.resultado(nombreFixture(fx), `Gráfico ${fx.pagina}`, fx.filas.length), fallas: cmp.fallas, grafiasDistintas: 0 };
}

/**
 * Clave de una fila de la tabla de paros. Con el Excel completo la grafía de los textos coincide con
 * la de Power BI y se compara exacta; con la muestra (solo paros desde 2026-06-01) la primera aparición
 * de una descripción puede ser otra grafía, así que ahí se ignoran las mayúsculas.
 */
const claveFila = (exacto: boolean, ...c: unknown[]) => c.map((x) => (exacto ? String(x) : String(x).toLowerCase())).join(" | ");

function tabla(modelo: Modelo, ctx: Contexto, fx: FixtureEscenario, exacto: boolean, grafiasDeLaMuestra: Set<string> | null): Salida {
  const filas = tablaParos(modelo, ctx);
  const cmp = new Comparador();
  if (filas.length !== fx.filas.length) cmp.fallas.push(`filas: esperado ${fx.filas.length} obtenido ${filas.length}`);
  const obtenidas = new Map<string, number[]>();
  const grafias = new Map<string, string>();
  for (const f of filas) {
    const k = claveFila(exacto, f.sap, f.equipo, f.aviso, f.descripcion, f.inicio, f.fin, f.responsable, f.tipoParo);
    (obtenidas.get(k) ?? obtenidas.set(k, []).get(k)!).push(f.hrsParoVentana);
    grafias.set(k, f.descripcion);
  }
  let grafiasDistintas = 0;
  for (const esp of fx.filas) {
    const espDesc = esp["HECHOS_DATAMES_NPI_PP.Desc de Paro"] as string;
    const k = claveFila(
      exacto,
      esp["DIM_EQUIPOS.IDEQUIPO"] !== null ? Number(esp["DIM_EQUIPOS.IDEQUIPO"]) : null,
      esp["HECHOS_DATAMES_NPI_PP.DesEquipo"],
      esp["Sum(HECHOS_DATAMES_NPI_PP.Aviso)"],
      espDesc,
      esp["HECHOS_DATAMES_NPI_PP._F/H Inicio"],
      esp["HECHOS_DATAMES_NPI_PP._F/H Fin"],
      esp["HECHOS_DATAMES_NPI_PP.Responsable"],
      esp["HECHOS_DATAMES_NPI_PP.Tipo de Paro(PP/NPI)"],
    );
    const h = obtenidas.get(k)?.shift();
    const grafia = grafias.get(k);
    if (!exacto && grafia !== undefined && grafia !== espDesc) {
      // Solo puede diferir en mayúsculas y la grafía de Power BI no debe existir en la muestra.
      if (grafia.toLowerCase() !== espDesc.toLowerCase() || grafiasDeLaMuestra?.has(espDesc)) cmp.fallas.push(`grafía: ${espDesc} / ${grafia}`);
      else grafiasDistintas++;
    }
    cmp.num(k, esp["Metricas (2).Hrs Paro Ventana"] as number, h ?? null, "horas");
  }
  for (const [k, lista] of obtenidas) for (const h of lista) cmp.fallas.push(`sobra en el motor: ${k} (${h} h)`);
  return { res: cmp.resultado(nombreFixture(fx), `Tabla de paros ${fx.pagina}`, fx.filas.length), fallas: cmp.fallas, grafiasDistintas };
}

function mensual(modelo: Modelo, ctx: Contexto, fx: FixtureEscenario): Salida {
  const paneles = panelesSemanales(modelo, ctx);
  const cmp = new Comparador();
  const puntos = paneles.reduce((a, p) => a + p.puntos.length, 0);
  if (puntos !== fx.filas.length) cmp.fallas.push(`puntos: esperado ${fx.filas.length} obtenido ${puntos}`);
  for (const esp of fx.filas) {
    const desc = esp["DIM_EQUIPOS.Descripcion"] as string;
    const sem = esp["DIM_TIEMPO.NbSemana"] as string;
    const punto = paneles.find((p) => p.descripcion === desc)?.puntos.find((x) => x.etiqueta === sem);
    if (!punto) {
      cmp.fallas.push(`${desc} ${sem}: falta en el motor`);
      continue;
    }
    cmp.num(`${desc} ${sem} disp`, esp["Metricas (2).Disp Din %"] as number, punto.dispDin, "fraccion");
    cmp.num(`${desc} ${sem} meta`, esp["Metas2026.Meta_Disp"] as number, punto.metaDisp, "fraccion");
    cmp.num(`${desc} ${sem} orden`, esp["DIM_TIEMPO.NbSemana_orden"] as number, punto.semana, "horas");
  }
  return { res: cmp.resultado(nombreFixture(fx), "Disp Mensual (equipo x semana)", fx.filas.length), fallas: cmp.fallas, grafiasDistintas: 0 };
}

function comparar(modelo: Modelo, fx: FixtureEscenario, exacto: boolean, grafiasDeLaMuestra: Set<string> | null): Salida {
  const ctx = contextoDeFixture(modelo, fx);
  switch (fx.visual_clave) {
    case "resumen_equipo":
      return resumenEquipo(modelo, ctx, fx);
    case "resumen_familia":
      return resumenFamilia(modelo, ctx, fx);
    case "grafico_simba":
    case "grafico_sostenimiento":
      return grafico(modelo, ctx, fx);
    case "tabla_simba":
    case "tabla_sostenimiento":
      return tabla(modelo, ctx, fx, exacto, grafiasDeLaMuestra);
    case "mensual":
      return mensual(modelo, ctx, fx);
  }
  throw new Error(`visual desconocido: ${fx.visual_clave}`);
}

// ---------------------------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------------------------

interface Fila extends Resultado {
  fuente: string;
  difGrafia: number;
  fallas: string[];
}
const tabla_resumen: Fila[] = [];

afterAll(() => {
  console.log("\n=== escenarios Power BI ===");
  console.table(tabla_resumen.map(({ fallas, ...r }) => ({ ...r, diferencias: fallas.length })));
  if (process.env.ESCENARIOS_RESUMEN) writeFileSync(process.env.ESCENARIOS_RESUMEN, JSON.stringify(tabla_resumen, null, 1));
});

function pruebasDe(fuente: "muestra" | "excel", obtenerModelo: () => Modelo, aplica: (ctx: Contexto) => boolean) {
  const grafiasDeLaMuestra = fuente === "muestra" ? new Set(cargarDatos().paros.map((p) => p.desc_paro)) : null;
  for (const fx of FIXTURES) {
    const clave = `${nombreFixture(fx)}@${fuente}`;
    const causa = KNOWN_DIFFS[clave];
    const prueba = causa ? it.fails : it;
    prueba(`${nombreFixture(fx)}: ${fx.escenario_descripcion}${causa ? ` [diferencia conocida: ${causa}]` : ""}`, (ctx) => {
      const modelo = obtenerModelo();
      if (!aplica(contextoDeFixture(modelo, fx))) return ctx.skip();
      const s = comparar(modelo, fx, fuente === "excel", grafiasDeLaMuestra);
      tabla_resumen.push({ ...s.res, fuente, difGrafia: s.grafiasDistintas, fallas: s.fallas });
      expect(s.fallas).toEqual([]);
    });
  }
}

describe("escenarios: los fixtures están completos", () => {
  it("hay fixtures de los escenarios a-g con sus visuales", () => {
    const porEscenario = new Map<string, string[]>();
    for (const fx of FIXTURES) (porEscenario.get(fx.escenario) ?? porEscenario.set(fx.escenario, []).get(fx.escenario)!).push(fx.visual_clave);
    expect([...porEscenario.keys()].sort()).toEqual(["a", "b", "c", "c_sindisp", "d_conf12", "d_conf24", "e", "f", "g_sostenimiento", "g_tirolargo"]);
    for (const e of ["a", "b", "c", "e", "f"]) expect(porEscenario.get(e)!.sort()).toEqual(["grafico_simba", "grafico_sostenimiento", "mensual", "resumen_equipo", "resumen_familia", "tabla_simba", "tabla_sostenimiento"]);
    for (const e of ["c_sindisp", "d_conf12", "d_conf24"]) expect(porEscenario.get(e)!.sort()).toEqual(["resumen_equipo", "resumen_familia"]);
    for (const e of ["g_sostenimiento", "g_tirolargo"]) expect(porEscenario.get(e)).toEqual(["mensual"]);
  });

  it("los filtros guardados son los del escenario (fechas, DISP, Var t, Conf., Familia)", () => {
    const esperado: Record<string, { ini: string; fin: string; vart: string; conf?: string; disp: unknown; familia?: string }> = {
      a: { ini: "2026-11-01", fin: "2026-11-21", vart: "18 hrs", conf: "18 hrs", disp: { not_in: ["Operacional"] } },
      b: { ini: "2026-11-01", fin: "2026-11-21", vart: "24 hrs", disp: { in: ["Operacional"] } },
      c: { ini: "2026-11-01", fin: "2026-11-21", vart: "24 hrs", disp: { in: ["Mecánica", "Operacional"] } },
      c_sindisp: { ini: "2026-11-01", fin: "2026-11-21", vart: "24 hrs", disp: undefined },
      d_conf12: { ini: "2026-11-01", fin: "2026-11-21", vart: "24 hrs", conf: "12 hrs", disp: { not_in: ["Operacional"] } },
      d_conf24: { ini: "2026-11-01", fin: "2026-11-21", vart: "24 hrs", conf: "24 hrs", disp: { not_in: ["Operacional"] } },
      e: { ini: "2026-10-01", fin: "2026-11-01", vart: "24 hrs", conf: "18 hrs", disp: { not_in: ["Operacional"] } },
      f: { ini: "2026-09-15", fin: "2026-10-16", vart: "24 hrs", disp: { not_in: ["Operacional"] } },
      g_tirolargo: { ini: "2026-07-01", fin: "2026-11-21", vart: "24 hrs", disp: { not_in: ["Operacional"] }, familia: "TIRO LARGO" },
      g_sostenimiento: { ini: "2026-07-01", fin: "2026-11-21", vart: "24 hrs", disp: { not_in: ["Operacional"] }, familia: "EQUIPOS DE SOSTENIMIENTO" },
    };
    for (const fx of FIXTURES) {
      const e = esperado[fx.escenario];
      const f = fx.filtros;
      expect(f["DIM_TIEMPO[Fecha]"][">="]!.slice(0, 10), nombreFixture(fx)).toBe(e.ini);
      expect(f["DIM_TIEMPO[Fecha]"]["<"]!.slice(0, 10), nombreFixture(fx)).toBe(e.fin);
      expect(f["Var_t: Disp[Var_t: Disp]"]?.in, nombreFixture(fx)).toEqual([e.vart]);
      if (e.conf && fx.visual_clave.startsWith("resumen")) expect(f["Confiabilidad[Confiabilidad]"]?.in, nombreFixture(fx)).toEqual([e.conf]);
      expect(f["HECHOS_DATAMES_NPI_PP[DISP]"], nombreFixture(fx)).toEqual(e.disp);
      // El gráfico de Disp Mensual trae CARGADORAS BP en su filtro de página; solo el escenario g lo cambia.
      if (fx.visual_clave === "mensual") expect(f["DIM_EQUIPOS[Familia]"]?.in?.[0], nombreFixture(fx)).toBe(e.familia ?? "CARGADORAS BP");
      else expect(f["DIM_EQUIPOS[Familia]"], nombreFixture(fx)).toBeUndefined();
    }
  });

  it("la muestra solo trae paros con fin desde 2026-06-01", () => {
    const minFin = cargarDatos().paros.map((p) => p.fecha_fin).sort()[0];
    expect(minFin >= INICIO_MUESTRA).toBe(true);
  });
});

describe("escenarios: control negativo (las pruebas distinguen un filtro mal armado)", () => {
  it("el escenario a (Var t 18 h) no coincide con el motor si se calcula con 24 h", () => {
    const modelo = cargarModelo();
    const fx = FIXTURES.find((f) => nombreFixture(f) === "a_resumen_equipo")!;
    const ctx = { ...contextoDeFixture(modelo, fx), hDisp: 24 as const };
    expect(resumenEquipo(modelo, ctx, fx).fallas.length).toBeGreaterThan(0);
  });

  it("el escenario b (solo Operacional) no coincide con el motor si se calcula con Mecánica", () => {
    const modelo = cargarModelo();
    const fx = FIXTURES.find((f) => nombreFixture(f) === "b_tabla_simba")!;
    const ctx = { ...contextoDeFixture(modelo, fx), disp: ["Mecánica"] };
    expect(tabla(modelo, ctx, fx, false, null).fallas.length).toBeGreaterThan(0);
  });

  it("el escenario f (cruza meses) no coincide con la meta de un solo mes", () => {
    const modelo = cargarModelo();
    const fx = FIXTURES.find((f) => nombreFixture(f) === "f_resumen_equipo")!;
    const ctx = { ...contextoDeFixture(modelo, fx), ini: "2026-10-01" };
    expect(resumenEquipo(modelo, ctx, fx).fallas.some((x) => x.includes("meta"))).toBe(true);
  });
});

describe("escenarios: motor con la muestra (tests/fixtures/datos/muestra.json)", () => {
  pruebasDe("muestra", cargarModelo, (ctx) => ctx.ini >= INICIO_MUESTRA);
});

describe.skipIf(!existsSync(RUTA_EXCEL))("escenarios: motor con el Excel completo (datos_local)", () => {
  let modelo: Modelo;
  beforeAll(async () => {
    const b = readFileSync(RUTA_EXCEL);
    const r = await leerLibro(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    modelo = prepararModelo(r.datos);
  }, 120_000);
  pruebasDe("excel", () => modelo, () => true);
});
