import { afterAll, describe, expect, it } from "vitest";
import { tablaParos } from "../../src/medidas/visuales";
import { cargarDatos, cargarFixture, cargarModelo, Comparador, contextoDeFixture, mostrarResultados, resultados } from "./ayudas";

// Tablas de paros de las cinco páginas de familia. Power BI las ordena distinto en cada captura
// (Hrs desc, IDEQUIPO asc, _F/H Fin desc), así que el conjunto de filas se compara sin orden.
const grafiasDeLaMuestra = new Set(cargarDatos().paros.map((p) => p.desc_paro));

const TABLAS = [
  { fixture: "q_022_1", pagina: "Disp Simba" },
  { fixture: "q_017_1", pagina: "Disp Jumbo" },
  { fixture: "q_014_1", pagina: "Disp Sostenimiento" },
  { fixture: "q_010_0", pagina: "Disp Scooptram ST3.5" },
  { fixture: "q_007_1", pagina: "Disp Scooptram ST1030" },
];

// Power BI compara y agrupa texto sin distinguir mayúsculas y muestra la primera grafía que cargó
// en toda la columna. La muestra solo trae paros desde 2026-06-01, así que una descripción puede
// salir con otra grafía (por ejemplo "No enciende" en Power BI y "NO ENCIENDE" aquí) cuando la
// primera aparición del Excel completo es anterior a la muestra. La clave ignora esa diferencia y
// las diferencias de grafía se verifican aparte.
const claveFila = (sap: unknown, equipo: unknown, aviso: unknown, desc: unknown, ini: unknown, fin: unknown, resp: unknown, tipo: unknown) =>
  [sap, equipo, aviso, String(desc).toLowerCase(), ini, fin, String(resp).toLowerCase(), String(tipo).toLowerCase()].join(" | ");

describe.each(TABLAS)("tabla de paros $pagina ($fixture)", ({ fixture, pagina }) => {
  const modelo = cargarModelo();
  const fx = cargarFixture(fixture);
  const ctx = contextoDeFixture(modelo, fx);
  const filas = tablaParos(modelo, ctx);

  it("tiene el mismo número de filas que Power BI", () => {
    expect(filas).toHaveLength(fx.filas.length);
  });

  it("todas las filas son > 0 y van de mayor a menor Hrs Paro Ventana", () => {
    for (let i = 0; i < filas.length; i++) {
      expect(filas[i].hrsParoVentana).toBeGreaterThan(0);
      if (i > 0) expect(filas[i].hrsParoVentana).toBeLessThanOrEqual(filas[i - 1].hrsParoVentana + 1e-6); // tolera ruido de punto flotante
    }
  });

  it("coincide el conjunto de filas y sus horas", () => {
    const cmp = new Comparador();
    const grafiasDistintas: string[] = [];
    const obtenidas = new Map<string, number[]>();
    const grafias = new Map<string, string>();
    for (const f of filas) {
      const k = claveFila(f.sap, f.equipo, f.aviso, f.descripcion, f.inicio, f.fin, f.responsable, f.tipoParo);
      (obtenidas.get(k) ?? obtenidas.set(k, []).get(k)!).push(f.hrsParoVentana);
      grafias.set(k, f.descripcion);
    }
    for (const esp of fx.filas) {
      const k = claveFila(
        esp["DIM_EQUIPOS.IDEQUIPO"] !== null ? Number(esp["DIM_EQUIPOS.IDEQUIPO"]) : null,
        esp["HECHOS_DATAMES_NPI_PP.DesEquipo"],
        esp["Sum(HECHOS_DATAMES_NPI_PP.Aviso)"],
        esp["HECHOS_DATAMES_NPI_PP.Desc de Paro"],
        esp["HECHOS_DATAMES_NPI_PP._F/H Inicio"],
        esp["HECHOS_DATAMES_NPI_PP._F/H Fin"],
        esp["HECHOS_DATAMES_NPI_PP.Responsable"],
        esp["HECHOS_DATAMES_NPI_PP.Tipo de Paro(PP/NPI)"],
      );
      const lista = obtenidas.get(k);
      const h = lista?.shift();
      const grafia = grafias.get(k);
      const espDesc = esp["HECHOS_DATAMES_NPI_PP.Desc de Paro"] as string;
      if (grafia !== undefined && grafia !== espDesc) {
        // Solo puede diferir en mayúsculas y la grafía de Power BI no debe existir en la muestra.
        expect(grafia.toLowerCase()).toBe(espDesc.toLowerCase());
        expect(grafiasDeLaMuestra.has(espDesc)).toBe(false);
        grafiasDistintas.push(`${espDesc} / ${grafia}`);
      }
      cmp.num(k, esp["Metricas (2).Hrs Paro Ventana"] as number, h ?? null, "horas");
    }
    // Lo que sobre en el motor son filas que Power BI no trae.
    for (const [k, lista] of obtenidas) for (const h of lista) cmp.fallas.push(`sobra en el motor: ${k} (${h} h)`);
    const r = cmp.resultado(fixture, `Tabla de paros ${pagina}`, fx.filas.length);
    resultados.push({ ...r, difGrafia: grafiasDistintas.length } as typeof r);
    expect(cmp.fallas).toEqual([]);
  });

  afterAll(() => {
    if (fixture === TABLAS[TABLAS.length - 1].fixture) mostrarResultados("tablas de paros");
  });
});
