import { describe, expect, it } from "vitest";
import type { Contexto } from "../../src/medidas/contexto";
import { EQUIPOS_POR_PAGINA, EQUIPOS_RESUMEN } from "../../src/medidas/contexto";
import { prepararModelo } from "../../src/medidas/modelo";
import { graficoFamilia, panelesSemanales, resumenPorEquipo, resumenPorFamilia, tablaParos } from "../../src/medidas/visuales";
import type { Paro } from "../../src/datos/tipos";
import { cargarModelo } from "./ayudas";

const paroBase: Paro = {
  id_equipo: 1,
  aviso: 940000001,
  fecha_inicio: "2026-11-05",
  hora_inicio: "08:00:00",
  fecha_fin: "2026-11-05",
  hora_fin: "20:00:00",
  duracion_min: 720,
  desc_paro: "Fuga de aceite",
  id_responsable: "T-MTO-ME",
  cod_falla: "",
  texto_falla: "",
  id_tipo_mantto: "NPI",
  tipo_paro_pp_npi: "No Programado",
  resumen: "",
};

const modeloMini = (paros: Partial<Paro>[]) =>
  prepararModelo({
    equipos: [
      { id_equipo: 1, descripcion: "EQUIPO UNO", familia: "F1" },
      { id_equipo: 2, descripcion: "EQUIPO DOS", familia: "F1" },
    ],
    responsables: [{ id_responsable: "T-MTO-ME", denominacion: "", responsable: "", disponibilidad: "" }],
    tipos_mantto: [{ id_tipo_mantto: "NPI", descripcion: "" }],
    metas: [],
    paros: paros.map((p) => ({ ...paroBase, ...p })),
  });

const ctx = (extra: Partial<Contexto> = {}): Contexto => ({ ini: "2026-11-01", fin: "2026-11-30", equipos: [1, 2], disp: [], hDisp: 24, tConf: 18, ...extra });

describe("tablaParos: agrupación", () => {
  it("filas idénticas en las columnas visibles se agrupan: suma el aviso y las horas", () => {
    const m = modeloMini([{}, { aviso: 940000002 }]);
    const t = tablaParos(m, ctx());
    expect(t).toHaveLength(1);
    expect(t[0].aviso).toBe(940000001 + 940000002);
    expect(t[0].hrsParoVentana).toBeCloseTo(24, 9);
  });

  it("el texto se agrupa sin distinguir mayúsculas y muestra la primera grafía", () => {
    const m = modeloMini([{ desc_paro: "Fuga de aceite" }, { desc_paro: "FUGA DE ACEITE", aviso: 940000002 }]);
    const t = tablaParos(m, ctx());
    expect(t).toHaveLength(1);
    expect(t[0].descripcion).toBe("Fuga de aceite");
  });

  it("filas distintas en inicio, fin, descripción, responsable o tipo no se agrupan", () => {
    const m = modeloMini([{}, { hora_fin: "21:00:00" }, { desc_paro: "otra" }, { tipo_paro_pp_npi: "Programado" }]);
    expect(tablaParos(m, ctx())).toHaveLength(4);
  });

  it("solo filas con horas > 0, ordenadas de mayor a menor, con fechas ISO", () => {
    const m = modeloMini([
      { aviso: 1, hora_inicio: "08:00:00", hora_fin: "10:00:00" },
      { aviso: 2, hora_inicio: "08:00:00", hora_fin: "08:00:00" }, // fin = inicio: 0 h, no sale
      { aviso: 3, fecha_inicio: "2026-10-01", fecha_fin: "2026-10-02" }, // fuera del periodo
      { aviso: 4, hora_inicio: "08:00:00", hora_fin: "20:00:00" },
    ]);
    const t = tablaParos(m, ctx());
    expect(t.map((f) => f.aviso)).toEqual([4, 1]);
    expect(t[0]).toMatchObject({ sap: 1, equipo: "EQUIPO UNO", inicio: "2026-11-05T08:00:00", fin: "2026-11-05T20:00:00", responsable: "Mantenimiento", tipoParo: "No Programado" });
  });

  it("equipoSeleccionado filtra la tabla a ese equipo", () => {
    const m = modeloMini([{ id_equipo: 1 }, { id_equipo: 2, aviso: 5 }]);
    expect(tablaParos(m, ctx())).toHaveLength(2);
    expect(tablaParos(m, ctx(), 2).map((f) => f.sap)).toEqual([2]);
    expect(tablaParos(m, ctx(), 99)).toEqual([]);
    expect(tablaParos(m, ctx(), null)).toHaveLength(2);
  });

  it("el filtro DISP también aplica a la tabla (Hrs Paro Ventana no filtra por responsable)", () => {
    const m = modeloMini([{ id_responsable: "T-OPE-MP", aviso: 7 }, {}]);
    expect(tablaParos(m, ctx({ disp: ["Mecánica"] })).map((f) => f.aviso)).toEqual([paroBase.aviso]);
    expect(tablaParos(m, ctx({ disp: [] }))).toHaveLength(2);
  });
});

describe("visuales con la muestra", () => {
  const modelo = cargarModelo();
  const base: Contexto = { ini: "2026-11-01", fin: "2026-11-20", equipos: [...EQUIPOS_RESUMEN], disp: ["Mecánica"], hDisp: 24, tConf: 18 };

  it("graficoFamilia devuelve una columna por equipo en el orden del contexto", () => {
    const g = graficoFamilia(modelo, { ...base, equipos: [...EQUIPOS_POR_PAGINA.st35] });
    expect(g.map((f) => f.id)).toEqual([100362, 618486]);
    expect(g[0].dispDin).toBeCloseTo(0.8291666666664241, 6);
    expect(g[0].color).toBe("#00493C");
    expect(g[1].color).toBe("#F89221");
  });

  it("resumenPorFamilia agrupa por familia en orden de aparición y suma los equipos", () => {
    const f = resumenPorFamilia(modelo, base);
    expect(f.map((x) => x.familia)).toEqual(["TIRO LARGO", "PERFORACION MECANIZADA", "EQUIPOS DE SOSTENIMIENTO", "CARGADORAS BP FLOTA 3.5", "CARGADORAS BP"]);
    expect(f.reduce((a, x) => a + x.equipos.length, 0)).toBe(18);
  });

  it("resumenPorEquipo ignora ids desconocidos y repetidos", () => {
    const r = resumenPorEquipo(modelo, { ...base, equipos: [100362, 100362, 1] });
    expect(r.map((x) => x.id)).toEqual([100362]);
  });

  it("panelesSemanales: un punto por semana con ini y fin recortados al periodo", () => {
    const p = panelesSemanales(modelo, { ...base, equipos: [100362], ini: "2026-11-01", fin: "2026-11-20" });
    expect(p).toHaveLength(1);
    expect(p[0].puntos.map((x) => x.etiqueta)).toEqual(["Sem 45/26", "Sem 46/26", "Sem 47/26"]);
    expect(p[0].puntos[0]).toMatchObject({ ini: "2026-11-01", fin: "2026-11-07" });
    expect(p[0].puntos[2]).toMatchObject({ ini: "2026-11-15", fin: "2026-11-20" });
  });
});
