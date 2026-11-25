import { describe, expect, it } from "vitest";
import { elegirPeriodo, mensualConfigurado, periodoConfigurado, type Configuracion } from "../src/datos/periodos";

const calculado = { desde: "2026-11-01", hasta: "2026-11-20" };
const guardado = { desde: "2026-10-01", hasta: "2026-10-31" };
const usuario = { desde: "2026-11-05", hasta: "2026-11-10" };
const config: Configuracion = {
  periodo_ini: "2026-10-01", periodo_fin: "2026-10-31", mensual_ini: "2026-07-01", mensual_fin: "2026-11-05",
};

describe("elegirPeriodo", () => {
  it("sin nada guardado ni movido usa el calculado", () => {
    expect(elegirPeriodo(null, null, calculado)).toEqual(calculado);
  });
  it("la configuración guardada gana al calculado", () => {
    expect(elegirPeriodo(null, guardado, calculado)).toEqual(guardado);
  });
  it("lo que movió el usuario no se pisa aunque llegue la configuración", () => {
    expect(elegirPeriodo(usuario, null, calculado)).toEqual(usuario);
    expect(elegirPeriodo(usuario, guardado, calculado)).toEqual(usuario);
  });
  it("sin datos ni configuración devuelve null", () => {
    expect(elegirPeriodo(null, null, null)).toBeNull();
  });
});

describe("periodoConfigurado y mensualConfigurado", () => {
  it("leen cada par por separado", () => {
    expect(periodoConfigurado(config)).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(mensualConfigurado(config)).toEqual({ desde: "2026-07-01", hasta: "2026-11-05" });
  });
  it("null cuando no hay configuración o el par está incompleto o invertido", () => {
    expect(periodoConfigurado(null)).toBeNull();
    expect(mensualConfigurado(undefined)).toBeNull();
    expect(periodoConfigurado({ ...config, periodo_fin: null })).toBeNull();
    expect(periodoConfigurado({ ...config, periodo_ini: "2026-12-01" })).toBeNull();
  });
  it("un par sin guardar deja el otro disponible", () => {
    const c = { ...config, mensual_ini: null, mensual_fin: null };
    expect(mensualConfigurado(c)).toBeNull();
    expect(periodoConfigurado(c)).toEqual(guardado);
  });
});
