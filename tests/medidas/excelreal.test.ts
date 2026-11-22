import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { leerLibro } from "../../src/datos/excel";
import { prepararModelo, type Modelo } from "../../src/medidas/modelo";
import { graficoFamilia, panelesSemanales, resumenPorEquipo, tablaParos } from "../../src/medidas/visuales";
import { cargarFixture, contextoDeFixture } from "./ayudas";

// Mismo cotejo con el Excel completo (11 622 paros), cuando está en datos_local. Con todos los
// paros la grafía de los textos (primera aparición en la columna) coincide también, así que las
// tablas se comparan con el texto exacto de Power BI.

const RUTA = new URL("../../datos_local/LIBRO_MAESTRO_15-09-2026.xlsx", import.meta.url).pathname;

describe.skipIf(!existsSync(RUTA))("motor con el Excel completo", () => {
  let modelo: Modelo;
  beforeAll(async () => {
    const b = readFileSync(RUTA);
    const r = await leerLibro(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    modelo = prepararModelo(r.datos);
  }, 120_000);

  for (const nombre of ["q_022_1", "q_017_1", "q_014_1", "q_010_0", "q_007_1"]) {
    it(`tabla de paros ${nombre}: filas, texto y horas idénticos`, () => {
      const fx = cargarFixture(nombre);
      const filas = tablaParos(modelo, contextoDeFixture(modelo, fx));
      expect(filas).toHaveLength(fx.filas.length);
      const clave = (a: unknown[]) => a.join(" | ");
      const obtenidas = new Map(filas.map((f) => [clave([f.sap, f.equipo, f.aviso, f.descripcion, f.inicio, f.fin, f.responsable, f.tipoParo]), f.hrsParoVentana]));
      for (const e of fx.filas) {
        const k = clave([
          Number(e["DIM_EQUIPOS.IDEQUIPO"]),
          e["HECHOS_DATAMES_NPI_PP.DesEquipo"],
          e["Sum(HECHOS_DATAMES_NPI_PP.Aviso)"],
          e["HECHOS_DATAMES_NPI_PP.Desc de Paro"],
          e["HECHOS_DATAMES_NPI_PP._F/H Inicio"],
          e["HECHOS_DATAMES_NPI_PP._F/H Fin"],
          e["HECHOS_DATAMES_NPI_PP.Responsable"],
          e["HECHOS_DATAMES_NPI_PP.Tipo de Paro(PP/NPI)"],
        ]);
        expect(obtenidas.has(k), k).toBe(true);
        expect(Math.abs(obtenidas.get(k)! - (e["Metricas (2).Hrs Paro Ventana"] as number))).toBeLessThanOrEqual(0.01);
      }
    });
  }

  it("resumen por equipo y gráfico ST1030 coinciden con el Excel completo", () => {
    const fx = cargarFixture("q_001_0");
    const r = resumenPorEquipo(modelo, contextoDeFixture(modelo, fx));
    for (const e of fx.filas) {
      const o = r.find((x) => x.id === Number(e["DIM_EQUIPOS.IDEQUIPO"]))!;
      expect(Math.abs(o.dispDin! - (e["Metricas (2).Disp Din %"] as number))).toBeLessThanOrEqual(0.0001);
      expect(Math.abs(o.metaDisp! - (e["Metas2026.Meta_Disp"] as number))).toBeLessThanOrEqual(0.0001);
      expect(Math.abs(o.mtbfH! - (e["Metricas (2).MTBF_H"] as number))).toBeLessThanOrEqual(0.01);
    }
    const g = cargarFixture("q_006_0");
    const graf = graficoFamilia(modelo, contextoDeFixture(modelo, g));
    expect(graf).toHaveLength(g.filas.length);
  });

  it("Disp Mensual: 114 puntos iguales al fixture", () => {
    const fx = cargarFixture("q_024_0");
    const paneles = panelesSemanales(modelo, contextoDeFixture(modelo, fx));
    for (const e of fx.filas) {
      const p = paneles.find((x) => x.descripcion === e["DIM_EQUIPOS.Descripcion"])!.puntos.find((x) => x.etiqueta === e["DIM_TIEMPO.NbSemana"])!;
      expect(Math.abs(p.dispDin! - (e["Metricas (2).Disp Din %"] as number))).toBeLessThanOrEqual(0.0001);
    }
  });
});
