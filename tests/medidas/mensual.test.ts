import { afterAll, describe, expect, it } from "vitest";
import { panelesSemanales } from "../../src/medidas/visuales";
import { cargarFixture, cargarModelo, Comparador, contextoDeFixture, mostrarResultados, resultados } from "./ayudas";

describe("Disp Mensual: evolución semanal (q_024_0)", () => {
  const modelo = cargarModelo();
  const fx = cargarFixture("q_024_0");
  const ctx = contextoDeFixture(modelo, fx);
  const paneles = panelesSemanales(modelo, ctx);

  it("tiene 6 equipos y 19 semanas por equipo (114 puntos), de Sem 27/26 a Sem 45/26", () => {
    expect(paneles).toHaveLength(6);
    for (const p of paneles) {
      expect(p.puntos).toHaveLength(19);
      expect(p.puntos[0].etiqueta).toBe("Sem 27/26");
      expect(p.puntos[18].etiqueta).toBe("Sem 45/26");
    }
    expect(paneles.reduce((a, p) => a + p.puntos.length, 0)).toBe(fx.filas.length);
  });

  it("coincide punto por punto en Disp Din % y Meta_Disp", () => {
    const cmp = new Comparador();
    for (const esp of fx.filas) {
      const desc = esp["DIM_EQUIPOS.Descripcion"] as string;
      const sem = esp["DIM_TIEMPO.NbSemana"] as string;
      const panel = paneles.find((p) => p.descripcion === desc);
      expect(panel, desc).toBeDefined();
      const punto = panel!.puntos.find((x) => x.etiqueta === sem);
      expect(punto, `${desc} ${sem}`).toBeDefined();
      cmp.num(`${desc} ${sem} disp`, esp["Metricas (2).Disp Din %"] as number, punto!.dispDin, "fraccion");
      cmp.num(`${desc} ${sem} meta`, esp["Metas2026.Meta_Disp"] as number, punto!.metaDisp, "fraccion");
      cmp.num(`${desc} ${sem} orden`, esp["DIM_TIEMPO.NbSemana_orden"] as number, punto!.semana, "horas");
    }
    resultados.push(cmp.resultado("q_024_0", "Disp Mensual (equipo x semana)", fx.filas.length));
    expect(cmp.fallas).toEqual([]);
  });

  afterAll(() => mostrarResultados("disp mensual"));
});
