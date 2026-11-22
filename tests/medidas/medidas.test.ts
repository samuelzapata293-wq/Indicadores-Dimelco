import { describe, expect, it } from "vitest";
import type { Contexto } from "../../src/medidas/contexto";
import {
  calcularBase,
  COLOR_CUMPLE,
  COLOR_NO_CUMPLE,
  colorDisp,
  confiabilidad,
  dispDin,
  fallasNpi,
  metaDisp,
  mtbfH,
  mttrH,
  paroGeneralVentana,
  paroNpiVentana,
  parosDelContexto,
  probFalla,
  tiempoProgramado,
} from "../../src/medidas/medidas";
import { prepararModelo } from "../../src/medidas/modelo";
import { periodoInicial } from "../../src/medidas/visuales";
import { cargarDatos, cargarModelo } from "./ayudas";
import type { DatosModelo, Paro } from "../../src/datos/tipos";

const paroBase: Paro = {
  id_equipo: 1,
  aviso: 1,
  fecha_inicio: "2026-11-05",
  hora_inicio: "08:00:00",
  fecha_fin: "2026-11-05",
  hora_fin: "20:00:00",
  duracion_min: 720,
  desc_paro: "x",
  id_responsable: "T-MTO-ME",
  cod_falla: "",
  texto_falla: "",
  id_tipo_mantto: "NPI",
  tipo_paro_pp_npi: "No Programado",
  resumen: "",
};

function armar(paros: Partial<Paro>[], metas: DatosModelo["metas"] = []) {
  return prepararModelo({
    equipos: [
      { id_equipo: 1, descripcion: "  EQUIPO UNO ", familia: "F1" },
      { id_equipo: 2, descripcion: "EQUIPO DOS", familia: "F1" },
    ],
    responsables: [
      { id_responsable: "T-MTO-ME", denominacion: "", responsable: "", disponibilidad: "" },
      { id_responsable: "T-MTO-EL", denominacion: "", responsable: "", disponibilidad: "" },
      { id_responsable: "T-OPE-MP", denominacion: "", responsable: "", disponibilidad: "" },
      { id_responsable: "T-FES-NI", denominacion: "", responsable: "", disponibilidad: "" },
    ],
    tipos_mantto: [
      { id_tipo_mantto: "PP", descripcion: "" },
      { id_tipo_mantto: "NPI", descripcion: "" },
    ],
    metas,
    paros: paros.map((p) => ({ ...paroBase, ...p })),
  });
}

const ctx = (extra: Partial<Contexto> = {}): Contexto => ({ ini: "2026-11-01", fin: "2026-11-10", equipos: [1], disp: [], hDisp: 24, tConf: 18, ...extra });

describe("filtros de las medidas", () => {
  it("Paro General excluye T-FES-NI pero deja pasar responsables desconocidos o vacíos", () => {
    const m = armar([
      { id_responsable: "T-MTO-ME" },
      { id_responsable: "T-FES-NI" },
      { id_responsable: "T-OPH-MA" }, // no está en la tabla de responsables
      { id_responsable: "" },
    ]);
    const c = ctx();
    const P = parosDelContexto(m, c);
    expect(P).toHaveLength(4);
    expect(paroGeneralVentana(P, c)).toBe(3 * 720); // las 3 filas distintas de T-FES-NI
    expect(paroNpiVentana(P, c)).toBe(720); // solo T-MTO-ME / T-MTO-EL con NPI
  });

  it("Paro General ignora mayúsculas y espacios finales del código", () => {
    const m = armar([{ id_responsable: "t-fes-ni " }]);
    expect(paroGeneralVentana(parosDelContexto(m, ctx()), ctx())).toBe(0);
  });

  it("Paro NPI exige NPI y responsable de mantenimiento", () => {
    const m = armar([
      { id_tipo_mantto: "PP" },
      { id_responsable: "T-OPE-MP" },
      { id_responsable: "T-MTO-EL" },
      { id_tipo_mantto: "XYZ" }, // tipo que no está en la tabla
    ]);
    const c = ctx();
    const P = parosDelContexto(m, c);
    expect(paroNpiVentana(P, c)).toBe(720);
    expect(fallasNpi(P, c)).toBe(1);
  });

  it("fallasNpi exige fin > inicio estricto y que toque la ventana", () => {
    const m = armar([
      { hora_fin: "08:00:00" }, // fin = inicio: no es falla
      { fecha_inicio: "2026-10-01", fecha_fin: "2026-10-02" }, // fuera de la ventana
      { fecha_inicio: "2026-10-31", hora_inicio: "20:00:00", fecha_fin: "2026-11-01", hora_fin: "06:00:00" }, // entra al periodo
      { fecha_inicio: "2026-11-10", hora_inicio: "20:00:00", fecha_fin: "2026-11-11", hora_fin: "06:00:00" }, // empieza el último día
      { fecha_inicio: "2026-11-11", hora_inicio: "00:00:00", fecha_fin: "2026-11-11", hora_fin: "06:00:00" }, // empieza justo después
    ]);
    const c = ctx();
    const P = parosDelContexto(m, c);
    expect(fallasNpi(P, c)).toBe(2);
    expect(calcularBase(P, c).fallasNpi).toBe(2);
  });

  it("el filtro DISP elige filas por el campo disp y vacío significa sin filtro", () => {
    const m = armar([{ id_responsable: "T-MTO-ME" }, { id_responsable: "T-OPE-MP", fecha_inicio: "2026-11-06", fecha_fin: "2026-11-06" }]);
    expect(parosDelContexto(m, ctx({ disp: ["Mecánica"] }))).toHaveLength(1);
    expect(parosDelContexto(m, ctx({ disp: ["Operacional"] }))).toHaveLength(1);
    expect(parosDelContexto(m, ctx({ disp: ["Mecánica", "Operacional"] }))).toHaveLength(2);
    expect(parosDelContexto(m, ctx({ disp: [] }))).toHaveLength(2);
    expect(dispDin(parosDelContexto(m, ctx({ disp: ["Mecánica"] })), ctx({ disp: ["Mecánica"] }))).toBeCloseTo(1 - 720 / 14400, 12);
  });

  it("no cuenta dos veces un equipo repetido en el contexto", () => {
    const m = armar([{}]);
    expect(parosDelContexto(m, ctx({ equipos: [1, 1] }))).toHaveLength(1);
  });

  it("descarta paros de equipos que no están en la tabla de equipos", () => {
    const m = armar([{ id_equipo: 99 }, {}]);
    expect(m.paros).toHaveLength(1);
  });
});

describe("tiempoProgramado, Disp Din %, MTTR, MTBF y confiabilidad", () => {
  it("tiempoProgramado = días * 60 * hDisp * equipos", () => {
    expect(tiempoProgramado(ctx())).toBe(10 * 60 * 24 * 1);
    expect(tiempoProgramado(ctx({ hDisp: 18, equipos: [1, 2] }))).toBe(10 * 60 * 18 * 2);
    expect(tiempoProgramado(ctx({ ini: "2026-11-10", fin: "2026-11-01" }))).toBeNull();
    expect(tiempoProgramado(ctx({ ini: "", fin: "" }))).toBeNull();
  });

  it("Disp Din % es nulo sin tiempo programado y no baja de 0", () => {
    const m = armar([{ fecha_inicio: "2026-10-01", fecha_fin: "2026-12-31" }]);
    expect(dispDin(parosDelContexto(m, ctx()), ctx())).toBe(0);
    expect(dispDin([], ctx({ equipos: [] }))).toBeNull();
    expect(dispDin([], ctx())).toBe(1);
  });

  it("MTTR y MTBF son nulos sin fallas; la confiabilidad es 1", () => {
    const c = ctx();
    expect(mttrH([], c)).toBeNull();
    expect(mtbfH([], c)).toBeNull();
    expect(confiabilidad([], c)).toBe(1);
    expect(probFalla([], c)).toBe(0);
  });

  it("con una falla de 12 h en 10 días a 24 h", () => {
    const m = armar([{}]);
    const c = ctx();
    const P = parosDelContexto(m, c);
    expect(mttrH(P, c)).toBeCloseTo(12, 9);
    expect(mtbfH(P, c)).toBeCloseTo(240 - 12, 9);
    expect(confiabilidad(P, c)).toBeCloseTo(Math.exp(-18 / 228), 12);
    expect(confiabilidad(P, ctx({ tConf: 12 }))).toBeCloseTo(Math.exp(-12 / 228), 12);
    expect(probFalla(P, c)).toBeCloseTo(1 - Math.exp(-18 / 228), 12);
  });

  it("MTBF = 0 da confiabilidad 0 (ni nulo ni división por cero)", () => {
    const m = armar([{ fecha_inicio: "2026-11-01", hora_inicio: "00:00:00", fecha_fin: "2026-11-10", hora_fin: "24:00:00" }]);
    const c = ctx();
    const P = parosDelContexto(m, c);
    expect(mtbfH(P, c)).toBe(0);
    expect(confiabilidad(P, c)).toBe(0);
    expect(probFalla(P, c)).toBe(1);
    expect(dispDin(P, c)).toBe(0);
  });

  it("calcularBase coincide con las medidas por separado", () => {
    const modelo = cargarModelo();
    const c: Contexto = { ini: "2026-09-01", fin: "2026-11-20", equipos: [100362, 100615, 618487], disp: ["Mecánica"], hDisp: 18, tConf: 24 };
    for (const id of c.equipos) {
      const ce = { ...c, equipos: [id] };
      const P = parosDelContexto(modelo, ce);
      const b = calcularBase(P, ce);
      expect(b.paroGeneral).toBeCloseTo(paroGeneralVentana(P, ce), 6);
      expect(b.paroNpi).toBeCloseTo(paroNpiVentana(P, ce), 6);
      expect(b.fallasNpi).toBe(fallasNpi(P, ce));
      expect(b.programado).toBe(tiempoProgramado(ce));
    }
  });

  it("MTBF de 69.83 h y tConf 18 dan confiabilidad de 77.28 % (valor publicado)", () => {
    expect(Math.exp(-18 / 69.83333333331393)).toBeCloseTo(0.7728, 4);
  });
});

describe("Meta_Disp y color", () => {
  const metas = (rows: [string, string, number | null][]): DatosModelo["metas"] =>
    rows.map(([mes, equipo_descripcion, meta_disp]) => ({ mes, equipo_descripcion, meta_disp: meta_disp as number, meta_mttr: null, meta_mtbf: null, meta_conf: null }));

  it("pondera por días de cada mes y omite los meses sin meta", () => {
    const m = armar([], metas([["01/10/2026", "EQUIPO UNO", 0.6], ["01/11/2026", "EQUIPO UNO", 0.8]]));
    // 5 días de octubre (0.6) y 10 de noviembre (0.8)
    expect(metaDisp(m, ctx({ ini: "2026-10-27", fin: "2026-11-10" }))).toBeCloseTo((0.6 * 5 + 0.8 * 10) / 15, 12);
    // diciembre no tiene meta: no cuenta ni en el numerador ni en los días
    expect(metaDisp(m, ctx({ ini: "2026-11-28", fin: "2026-12-05" }))).toBeCloseTo(0.8, 12);
    expect(metaDisp(m, ctx({ ini: "2026-12-01", fin: "2026-12-05" }))).toBeNull();
  });

  it("es el promedio simple de los equipos en contexto; la relación va por descripción sin espacios ni mayúsculas", () => {
    const m = armar([], metas([["01/11/2026", "equipo uno  ", 0.6], ["01/11/2026", "EQUIPO DOS", 0.8], ["01/11/2026", "OTRO", 0.1]]));
    expect(metaDisp(m, ctx({ equipos: [1] }))).toBeCloseTo(0.6, 12);
    expect(metaDisp(m, ctx({ equipos: [1, 2] }))).toBeCloseTo(0.7, 12);
    expect(metaDisp(m, ctx({ equipos: [] }))).toBeNull();
  });

  it("las metas vacías no cuentan en el promedio", () => {
    const m = armar([], metas([["01/11/2026", "EQUIPO UNO", 0.6], ["01/11/2026", "EQUIPO DOS", null]]));
    expect(metaDisp(m, ctx({ equipos: [1, 2] }))).toBeCloseTo(0.6, 12);
  });

  it("color: verde si meta <= disponibilidad, naranja si no; el blanco cuenta como 0", () => {
    expect(colorDisp(0.7, 0.8)).toBe(COLOR_CUMPLE);
    expect(colorDisp(0.8, 0.8)).toBe(COLOR_CUMPLE);
    expect(colorDisp(0.81, 0.8)).toBe(COLOR_NO_CUMPLE);
    expect(colorDisp(null, 0.5)).toBe(COLOR_CUMPLE);
    expect(colorDisp(0.5, null)).toBe(COLOR_NO_CUMPLE);
    expect(colorDisp(null, null)).toBe(COLOR_CUMPLE);
  });
});

describe("periodoInicial", () => {
  it("de la captura: 01/11 al 20/11 y, en Disp Mensual, desde el 01/07", () => {
    const p = periodoInicial(cargarModelo());
    expect(p).toEqual({ general: { ini: "2026-11-01", fin: "2026-11-20" }, mensual: { ini: "2026-07-01", fin: "2026-11-20" } });
  });

  it("sin paros no hay periodo", () => {
    expect(periodoInicial(prepararModelo({ ...cargarDatos(), paros: [] }))).toBeNull();
  });
});
