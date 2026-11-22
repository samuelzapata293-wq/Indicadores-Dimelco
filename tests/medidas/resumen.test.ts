import { afterAll, describe, expect, it } from "vitest";
import { resumenPorEquipo, resumenPorFamilia } from "../../src/medidas/visuales";
import { cargarFixture, cargarModelo, Comparador, contextoDeFixture, mostrarResultados, resultados } from "./ayudas";

describe("Resumen Disp.: tabla por equipo (q_001_0)", () => {
  const modelo = cargarModelo();
  const fx = cargarFixture("q_001_0");
  const ctx = contextoDeFixture(modelo, fx);
  const filas = resumenPorEquipo(modelo, ctx);

  it("el contexto tiene los 18 equipos del fixture", () => {
    expect(ctx.equipos).toHaveLength(18);
    expect(filas).toHaveLength(fx.filas.length);
  });

  it("coincide fila por fila con Power BI", () => {
    const cmp = new Comparador();
    for (const esp of fx.filas) {
      const id = Number(esp["DIM_EQUIPOS.IDEQUIPO"]);
      const o = filas.find((f) => f.id === id);
      expect(o, `equipo ${id}`).toBeDefined();
      const e = `eq ${id}`;
      cmp.num(`${e} MTTR`, esp["Metricas (2).MTTR_H"] as number, o!.mttrH, "horas");
      cmp.num(`${e} MTBF`, esp["Metricas (2).MTBF_H"] as number, o!.mtbfH, "horas");
      cmp.num(`${e} meta`, esp["Metas2026.Meta_Disp"] as number, o!.metaDisp, "fraccion");
      cmp.num(`${e} disp`, esp["Metricas (2).Disp Din %"] as number, o!.dispDin, "fraccion");
      cmp.num(`${e} conf`, esp["Metricas.Confiabilidad_24h"] as number, o!.confiabilidad, "fraccion");
      cmp.num(`${e} prob`, esp["Metricas.ProbabilidadDeFalla"] as number, o!.probFalla, "fraccion");
      cmp.num(`${e} brecha`, esp["Metricas (2).Brecha_Disp dn"] as number, o!.brecha, "fraccion");
      cmp.texto(`${e} descripcion`, esp["DIM_EQUIPOS.Descripcion"], o!.descripcion);
    }
    resultados.push(cmp.resultado("q_001_0", "Resumen por equipo", fx.filas.length));
    expect(cmp.fallas).toEqual([]);
  });

  afterAll(() => mostrarResultados("resumen por equipo"));
});

describe("Resumen Disp.: tabla por familia (q_000_1)", () => {
  const modelo = cargarModelo();
  const fx = cargarFixture("q_000_1");
  const ctx = contextoDeFixture(modelo, fx);
  const filas = resumenPorFamilia(modelo, ctx);

  it("coincide fila por fila con Power BI", () => {
    expect(filas).toHaveLength(fx.filas.length);
    const cmp = new Comparador();
    for (const esp of fx.filas) {
      const fam = esp["DIM_EQUIPOS.Familia"] as string;
      const o = filas.find((f) => f.familia === fam);
      expect(o, `familia ${fam}`).toBeDefined();
      cmp.num(`${fam} MTTR`, esp["Metricas (2).MTTR_H"] as number, o!.mttrH, "horas");
      cmp.num(`${fam} MTBF`, esp["Metricas (2).MTBF_H"] as number, o!.mtbfH, "horas");
      cmp.num(`${fam} disp`, esp["Metricas (2).Disp Din %"] as number, o!.dispDin, "fraccion");
      cmp.num(`${fam} conf`, esp["Metricas.Confiabilidad_24h"] as number, o!.confiabilidad, "fraccion");
      cmp.num(`${fam} prob`, esp["Metricas.ProbabilidadDeFalla"] as number, o!.probFalla, "fraccion");
    }
    resultados.push(cmp.resultado("q_000_1", "Resumen por familia", fx.filas.length));
    expect(cmp.fallas).toEqual([]);
  });

  afterAll(() => mostrarResultados("resumen por familia"));
});
