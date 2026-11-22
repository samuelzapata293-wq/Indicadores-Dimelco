import { afterAll, describe, expect, it } from "vitest";
import { graficoFamilia } from "../../src/medidas/visuales";
import { cargarFixture, cargarModelo, Comparador, contextoDeFixture, mostrarResultados, resultados } from "./ayudas";

// Gráficos combinados (columnas Disp Din % + línea Meta_Disp) de las cinco páginas de familia.
const GRAFICOS = [
  { fixture: "q_021_0", pagina: "Disp Simba" },
  { fixture: "q_018_0", pagina: "Disp Jumbo" },
  { fixture: "q_013_0", pagina: "Disp Sostenimiento" },
  { fixture: "q_008_0", pagina: "Disp Scooptram ST3.5" },
  { fixture: "q_006_0", pagina: "Disp Scooptram ST1030" },
];

describe.each(GRAFICOS)("gráfico combinado $pagina ($fixture)", ({ fixture, pagina }) => {
  const modelo = cargarModelo();
  const fx = cargarFixture(fixture);
  const ctx = contextoDeFixture(modelo, fx);
  const filas = graficoFamilia(modelo, ctx);

  it("tiene los mismos equipos que Power BI", () => {
    expect(filas.map((f) => f.descripcion).sort()).toEqual(fx.filas.map((f) => f["DIM_EQUIPOS.Descripcion"] as string).sort());
  });

  it("coincide fila por fila en Disp Din %, Meta_Disp y color", () => {
    const cmp = new Comparador();
    for (const esp of fx.filas) {
      const desc = esp["DIM_EQUIPOS.Descripcion"] as string;
      const o = filas.find((f) => f.descripcion === desc);
      expect(o, desc).toBeDefined();
      cmp.num(`${desc} disp`, esp["Metricas (2).Disp Din %"] as number, o!.dispDin, "fraccion");
      cmp.num(`${desc} meta`, esp["Metas2026.Meta_Disp"] as number, o!.metaDisp, "fraccion");
      cmp.texto(`${desc} color`, esp["Metas2026.Color_Disponibilidad"], o!.color);
    }
    resultados.push(cmp.resultado(fixture, `Gráfico ${pagina}`, fx.filas.length));
    expect(cmp.fallas).toEqual([]);
  });

  afterAll(() => {
    if (fixture === GRAFICOS[GRAFICOS.length - 1].fixture) mostrarResultados("gráficos combinados");
  });
});
