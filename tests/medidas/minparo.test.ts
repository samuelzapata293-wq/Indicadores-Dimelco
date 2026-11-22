import { describe, expect, it } from "vitest";
import { fechaASerial } from "../../src/datos/derivados";
import type { DatosModelo, Paro } from "../../src/datos/tipos";
import type { Contexto } from "../../src/medidas/contexto";
import { hrsParoVentana, minParoVentana } from "../../src/medidas/medidas";
import { prepararModelo } from "../../src/medidas/modelo";

// Pruebas unitarias de `Min Paro Ventana` con la ventana del 1 al 30 de noviembre de 2026
// ([01/11 00:00, 01/12 00:00)). Los valores esperados se calcularon a mano con la fórmula del
// contrato: r y s cuentan INT(días) * hpm + MIN(resto en minutos, hpm) desde el inicio del paro.

const ctx = (hDisp: 18 | 24, ini = "2026-11-01", fin = "2026-11-30"): Contexto => ({ ini, fin, equipos: [1], disp: [], hDisp, tConf: 18 });

/** "2026-11-05 08:30" -> serial con fracción de día. */
function t(fechaHora: string): number {
  const [f, h = "00:00"] = fechaHora.split(" ");
  const [hh, mm] = h.split(":").map(Number);
  return fechaASerial(f) + (hh * 60 + mm) / 1440;
}
const paro = (ini: string, fin: string) => ({ inicio: t(ini), fin: t(fin) });

describe("minParoVentana: casos borde", () => {
  it("paro dentro de la ventana: sus minutos", () => {
    expect(minParoVentana([paro("2026-11-05 08:00", "2026-11-05 12:00")], ctx(24))).toBeCloseTo(240, 6);
    expect(minParoVentana([paro("2026-11-05 08:00", "2026-11-05 12:00")], ctx(18))).toBeCloseTo(240, 6);
  });

  it("empieza antes de la ventana: solo cuenta lo que cae dentro", () => {
    const p = [paro("2026-10-30 20:00", "2026-11-02 06:00")];
    // 24 h: del 01/11 00:00 al 02/11 06:00 son 30 h = 1800 min.
    expect(minParoVentana(p, ctx(24))).toBeCloseTo(1800, 6);
    // 18 h: r = 1*1080 + 240 = 1320 y s = 2*1080 + 600 = 2760 -> 1440 (los días se cuentan desde el inicio del paro).
    expect(minParoVentana(p, ctx(18))).toBeCloseTo(1440, 6);
  });

  it("termina después de la ventana: se corta en fin + 1 día", () => {
    const p = [paro("2026-11-29 12:00", "2026-12-03 12:00")];
    expect(minParoVentana(p, ctx(24))).toBeCloseTo(2160, 6); // 36 h hasta el 01/12 00:00
    expect(minParoVentana(p, ctx(18))).toBeCloseTo(1800, 6); // 1*1080 + MIN(720, 1080)
  });

  it("paro que cubre toda la ventana", () => {
    const p = [paro("2026-10-20 00:00", "2026-12-10 00:00")];
    expect(minParoVentana(p, ctx(24))).toBeCloseTo(30 * 1440, 6);
    expect(minParoVentana(p, ctx(18))).toBeCloseTo(30 * 1080, 6);
  });

  it("de varios días: tope de 18 h por día", () => {
    // 5 días completos: 18 h/día = 5400 min; con 24 h son 7200.
    const cinco = [paro("2026-11-03 00:00", "2026-11-08 00:00")];
    expect(minParoVentana(cinco, ctx(18))).toBeCloseTo(5400, 6);
    expect(minParoVentana(cinco, ctx(24))).toBeCloseTo(7200, 6);
    // 38 h (1 día + 14 h): 18 h -> 1080 + MIN(840, 1080) = 1920.
    const treintaYOcho = [paro("2026-11-03 06:00", "2026-11-04 20:00")];
    expect(minParoVentana(treintaYOcho, ctx(18))).toBeCloseTo(1920, 6);
    // 47 h (1 día + 23 h): el resto se topa en 1080 -> 2160.
    const cuarentaYSiete = [paro("2026-11-03 00:00", "2026-11-04 23:00")];
    expect(minParoVentana(cuarentaYSiete, ctx(18))).toBeCloseTo(2160, 6);
  });

  it("de varios días: con 24 h cuenta todo el tiempo transcurrido", () => {
    expect(minParoVentana([paro("2026-11-03 06:00", "2026-11-04 20:00")], ctx(24))).toBeCloseTo(38 * 60, 6);
    expect(minParoVentana([paro("2026-11-03 00:00", "2026-11-20 00:00")], ctx(24))).toBeCloseTo(17 * 1440, 6);
  });

  it("fin = inicio: pasa el filtro (fin >= inicio) pero aporta 0 minutos", () => {
    const p = [paro("2026-11-05 08:00", "2026-11-05 08:00")];
    expect(minParoVentana(p, ctx(24))).toBe(0);
    expect(hrsParoVentana(p, ctx(24))).toBeNull(); // Hrs Paro Ventana es BLANK cuando no es > 0
  });

  it("fin < inicio no cuenta", () => {
    expect(minParoVentana([paro("2026-11-05 12:00", "2026-11-05 08:00")], ctx(24))).toBe(0);
  });

  it("paros fuera de la ventana no cuentan, aunque toquen el borde", () => {
    expect(minParoVentana([paro("2026-10-25 00:00", "2026-10-28 00:00")], ctx(24))).toBe(0); // antes
    expect(minParoVentana([paro("2026-12-02 00:00", "2026-12-03 00:00")], ctx(24))).toBe(0); // después
    expect(minParoVentana([paro("2026-10-31 12:00", "2026-11-01 00:00")], ctx(24))).toBe(0); // termina justo en _ini (fin > _ini es estricto)
    expect(minParoVentana([paro("2026-12-01 00:00", "2026-12-01 06:00")], ctx(24))).toBe(0); // empieza justo en _fin (inicio < _fin es estricto)
  });

  it("suma varias filas", () => {
    const filas = [paro("2026-11-05 08:00", "2026-11-05 12:00"), paro("2026-11-06 00:00", "2026-11-06 06:00"), paro("2026-09-01 00:00", "2026-09-02 00:00")];
    expect(minParoVentana(filas, ctx(24))).toBeCloseTo(240 + 360, 6);
  });

  it("una ventana de un solo día usa ese día completo", () => {
    const c = ctx(24, "2026-11-10", "2026-11-10");
    expect(minParoVentana([paro("2026-11-09 18:00", "2026-11-10 06:00")], c)).toBeCloseTo(360, 6);
    expect(minParoVentana([paro("2026-11-10 22:00", "2026-11-11 04:00")], c)).toBeCloseTo(120, 6);
  });
});

describe("minParoVentana con horas del Excel (24:00:00)", () => {
  const base: Paro = {
    id_equipo: 1,
    aviso: 1,
    fecha_inicio: "2026-11-29",
    hora_inicio: "12:00:00",
    fecha_fin: "2026-11-30",
    hora_fin: "24:00:00",
    duracion_min: null,
    desc_paro: "x",
    id_responsable: "T-MTO-ME",
    cod_falla: "",
    texto_falla: "",
    id_tipo_mantto: "NPI",
    tipo_paro_pp_npi: "No Programado",
    resumen: "",
  };
  const modelo = (p: Paro) =>
    prepararModelo({
      equipos: [{ id_equipo: 1, descripcion: "E1", familia: "F" }],
      responsables: [{ id_responsable: "T-MTO-ME", denominacion: "", responsable: "", disponibilidad: "" }],
      tipos_mantto: [{ id_tipo_mantto: "NPI", descripcion: "" }],
      metas: [],
      paros: [p],
    } as DatosModelo);

  it("hora fin 24:00:00 suma un día: 30/11 24:00 es 01/12 00:00", () => {
    const m = modelo(base);
    expect(m.paros[0].fin).toBe(fechaASerial("2026-12-01"));
    // Del 29/11 12:00 al 01/12 00:00 son 36 h, todas dentro de la ventana (que termina el 01/12 00:00).
    expect(minParoVentana(m.paros, ctx(24))).toBeCloseTo(2160, 6);
    // Equivale a escribirlo como 01/12 00:00:00.
    const m2 = modelo({ ...base, fecha_fin: "2026-12-01", hora_fin: "00:00:00" });
    expect(minParoVentana(m2.paros, ctx(24))).toBe(minParoVentana(m.paros, ctx(24)));
  });

  it("hora inicio 24:00:00 se trata como 00:00:00 del mismo día", () => {
    const m = modelo({ ...base, fecha_inicio: "2026-11-10", hora_inicio: "24:00:00", fecha_fin: "2026-11-10", hora_fin: "06:00:00" });
    expect(m.paros[0].inicio).toBe(fechaASerial("2026-11-10"));
    expect(minParoVentana(m.paros, ctx(24))).toBeCloseTo(360, 6);
  });

  it("paro de todo el mes: 01/11 00:00 a 30/11 24:00 son 30 días", () => {
    const m = modelo({ ...base, fecha_inicio: "2026-11-01", hora_inicio: "00:00:00" });
    expect(minParoVentana(m.paros, ctx(24))).toBeCloseTo(30 * 1440, 6);
    expect(minParoVentana(m.paros, ctx(18))).toBeCloseTo(30 * 1080, 6);
  });
});
