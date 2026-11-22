import { describe, expect, it } from "vitest";
import {
  calendario,
  contarDias,
  etiquetaSemana,
  formatoFechaHora,
  mesesDelRango,
  nombreMes,
  numeroSemana,
  primerDiaMes,
  semanasDelRango,
  serialAIso,
  sumarDias,
  sumarMeses,
  ultimoDiaMes,
} from "../../src/medidas/contexto";
import { fechaASerial } from "../../src/datos/derivados";

describe("fechas", () => {
  it("calendario inclusivo y días contados", () => {
    expect(calendario("2026-11-01", "2026-11-03")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(calendario("2026-11-03", "2026-11-01")).toEqual([]);
    expect(contarDias("2026-11-01", "2026-11-20")).toBe(20);
    expect(contarDias("2026-02-01", "2026-02-28")).toBe(28);
    expect(contarDias("2026-11-20", "2026-11-01")).toBe(0);
  });

  it("sumarDias y meses", () => {
    expect(sumarDias("2026-11-21", -1)).toBe("2026-11-20");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(primerDiaMes("2026-11-20")).toBe("2026-11-01");
    expect(ultimoDiaMes("2026-02-10")).toBe("2026-02-28");
    expect(sumarMeses("2026-11-20", -4)).toBe("2026-07-01");
    expect(sumarMeses("2026-02-20", -4)).toBe("2025-10-01");
    expect(nombreMes("2026-11-20")).toBe("Noviembre");
  });

  it("mesesDelRango reparte los días por mes", () => {
    expect(mesesDelRango("2026-07-01", "2026-11-05")).toEqual([
      { mes: "2026-07-01", dias: 31 },
      { mes: "2026-08-01", dias: 31 },
      { mes: "2026-09-01", dias: 30 },
      { mes: "2026-10-01", dias: 31 },
      { mes: "2026-11-01", dias: 5 },
    ]);
    expect(mesesDelRango("2026-11-28", "2026-12-02")).toEqual([
      { mes: "2026-11-01", dias: 3 },
      { mes: "2026-12-01", dias: 2 },
    ]);
    expect(mesesDelRango("2026-11-05", "2026-11-04")).toEqual([]);
  });

  it("serial y formato del reporte", () => {
    expect(serialAIso(fechaASerial("2026-11-19") + 18 / 24)).toBe("2026-11-19T18:00:00");
    expect(serialAIso(fechaASerial("2026-11-19") + (23 * 60 + 50) / 1440)).toBe("2026-11-19T23:50:00");
    expect(formatoFechaHora(fechaASerial("2026-11-19") + 18 / 24)).toBe("11/19/2026 6:00:00 PM");
    expect(formatoFechaHora(fechaASerial("2026-11-19"))).toBe("11/19/2026 12:00:00 AM");
    expect(formatoFechaHora(fechaASerial("2026-11-19") + 0.5)).toBe("11/19/2026 12:00:00 PM");
  });
});

describe("semanas (WEEKNUM tipo 1)", () => {
  it("la semana 1 contiene el 1 de enero y empieza en domingo", () => {
    expect(numeroSemana("2026-01-01")).toBe(1); // jueves
    expect(numeroSemana("2026-01-03")).toBe(1); // sábado
    expect(numeroSemana("2026-01-04")).toBe(2); // domingo
    expect(numeroSemana("2025-01-01")).toBe(1); // miércoles
    expect(numeroSemana("2026-12-31")).toBe(53);
    expect(numeroSemana("2027-01-01")).toBe(1);
  });

  it("coincide con las etiquetas del reporte (q_024_0: Sem 27/26 a Sem 45/26)", () => {
    expect(etiquetaSemana("2026-07-01")).toBe("Sem 27/26");
    expect(etiquetaSemana("2026-11-05")).toBe("Sem 45/26");
  });

  it("semanasDelRango recorta la primera y la última al periodo", () => {
    const s = semanasDelRango("2026-07-01", "2026-11-05");
    expect(s).toHaveLength(19);
    expect(s[0]).toMatchObject({ etiqueta: "Sem 27/26", ini: "2026-07-01", fin: "2026-07-04" }); // mié a sáb
    expect(s[1]).toMatchObject({ etiqueta: "Sem 28/26", ini: "2026-07-05", fin: "2026-07-11" }); // dom a sáb
    expect(s[18]).toMatchObject({ etiqueta: "Sem 45/26", ini: "2026-11-01", fin: "2026-11-05" });
  });

  it("al cruzar de año las semanas se separan por etiqueta", () => {
    const s = semanasDelRango("2026-12-27", "2027-01-05");
    expect(s.map((x) => [x.etiqueta, x.ini, x.fin])).toEqual([
      ["Sem 53/26", "2026-12-27", "2026-12-31"],
      ["Sem 1/27", "2027-01-01", "2027-01-02"],
      ["Sem 2/27", "2027-01-03", "2027-01-05"],
    ]);
  });
});
