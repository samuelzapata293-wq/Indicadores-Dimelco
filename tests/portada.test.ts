import { describe, expect, it } from "vitest";
import { textoDataActualizada } from "../src/pages/Portada";

describe("textoDataActualizada", () => {
  it("mismo mes y año: un solo mes al final", () => {
    expect(textoDataActualizada("2026-11-01", "2026-11-20")).toBe(
      "Data actualizada: 01 al 20 de noviembre 2026",
    );
  });

  it("mismo día: una sola fecha", () => {
    expect(textoDataActualizada("2026-11-01", "2026-11-01")).toBe("Data actualizada: 01 de noviembre 2026");
  });

  it("cambia el mes dentro del mismo año", () => {
    expect(textoDataActualizada("2026-10-28", "2026-11-20")).toBe(
      "Data actualizada: 28 de octubre al 20 de noviembre 2026",
    );
  });

  it("cambia el año", () => {
    expect(textoDataActualizada("2025-12-28", "2026-01-05")).toBe(
      "Data actualizada: 28 de diciembre 2025 al 05 de enero 2026",
    );
  });

  it("sin fechas o con fechas no válidas", () => {
    expect(textoDataActualizada()).toBe("Data actualizada: sin datos cargados");
    expect(textoDataActualizada("2026-11-01")).toBe("Data actualizada: sin datos cargados");
    expect(textoDataActualizada("2026-02-30", "2026-03-01")).toBe("Data actualizada: sin datos cargados");
  });
});
