import { describe, expect, it } from "vitest";
import { nombreCorto, NOMBRES_CORTOS } from "../src/pages/nombresCortos";

describe("nombreCorto", () => {
  it("devuelve el nombre corto de un id conocido", () => {
    expect(nombreCorto(618487, "JUMBO DE PERFORACION ATLAS SIMBA S7 N°1")).toBe("SIMBA S7 N°1");
    expect(nombreCorto("100362", "CARGADOR FRONTAL BP SCOOP 3.50 N°5 (WAGNER)")).toBe("SCOOP 3.50 N°5 (WAGNER)");
  });

  it("devuelve el nombre completo si el id no está en el mapa", () => {
    expect(nombreCorto(999999, "EQUIPO NUEVO")).toBe("EQUIPO NUEVO");
  });

  it("cubre los 18 equipos", () => {
    expect(Object.keys(NOMBRES_CORTOS)).toHaveLength(18);
  });
});
