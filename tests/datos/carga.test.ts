import { describe, expect, it } from "vitest";
import { compararConActual, rutaStorage } from "../../src/datos/carga";
import { convertirCarga, convertirMeta, convertirParo, isoADmy } from "../../src/datos/lectura";
import type { DatosModelo, Paro } from "../../src/datos/tipos";

const paro = (aviso: number, fecha: string, extra: Partial<Paro> = {}): Paro => ({
  id_equipo: 1, aviso, fecha_inicio: fecha, hora_inicio: "08:00:00", fecha_fin: fecha, hora_fin: "09:00:00",
  duracion_min: 60, desc_paro: "", id_responsable: "T-MTO-ME", cod_falla: "", texto_falla: "",
  id_tipo_mantto: "PP", tipo_paro_pp_npi: "", resumen: "", ...extra,
});

const base = (paros: Paro[]): DatosModelo => ({
  equipos: [{ id_equipo: 1, descripcion: "A", familia: "F" }],
  responsables: [{ id_responsable: "T-MTO-ME", denominacion: "", responsable: "", disponibilidad: "" }],
  tipos_mantto: [{ id_tipo_mantto: "PP", descripcion: "" }],
  metas: [{ mes: "01/01/2026", equipo_descripcion: "A", meta_disp: 0.9, meta_mttr: null, meta_mtbf: null, meta_conf: null }],
  paros,
});

describe("compararConActual", () => {
  it("sin datos actuales todo es nuevo", () => {
    const c = compararConActual(base([paro(1, "2026-08-01")]), undefined);
    expect(c.hayActual).toBe(false);
    expect(c.paros).toMatchObject({ actual: 0, nuevo: 1, nuevas: 1, quitadas: 0, rangoActual: null });
  });

  it("cuenta filas nuevas, quitadas, rangos y avisos de los últimos 30 días", () => {
    const actual = base([paro(1, "2026-06-01"), paro(2, "2026-07-01")]);
    const nuevo = base([paro(2, "2026-07-01"), paro(3, "2026-08-20"), paro(4, "2026-06-15")]);
    const c = compararConActual(nuevo, actual);
    expect(c.hayActual).toBe(true);
    expect(c.paros).toMatchObject({
      actual: 2, nuevo: 3, nuevas: 2, quitadas: 1,
      rangoActual: { min: "2026-06-01", max: "2026-07-01" },
      rangoNuevo: { min: "2026-06-15", max: "2026-08-20" },
      avisosNuevos30d: 1, // solo el 3; el 4 es nuevo pero de hace más de 30 días
    });
    expect(c.tablas.find((t) => t.tabla === "equipos")).toMatchObject({ nuevas: 0, quitadas: 0 });
  });

  it("distingue filas de un mismo aviso repetido", () => {
    const c = compararConActual(base([paro(1, "2026-08-01"), paro(1, "2026-08-01")]), base([paro(1, "2026-08-01")]));
    expect(c.paros).toMatchObject({ nuevas: 1, quitadas: 0 });
  });

  it("compara metas sin distinguir mayúsculas ni espacios", () => {
    const a = base([paro(1, "2026-08-01")]);
    const n = base([paro(1, "2026-08-01")]);
    n.metas[0] = { ...n.metas[0], equipo_descripcion: " a " };
    expect(compararConActual(n, a).tablas.find((t) => t.tabla === "metas")).toMatchObject({ nuevas: 0, quitadas: 0 });
  });
});

describe("conversión de tipos de lectura", () => {
  it("normaliza bigint y numeric que llegan como texto o número", () => {
    const p = convertirParo({
      aviso: "300012345", id_equipo: 100305, fecha_inicio: "2026-08-01", hora_inicio: "08:30",
      fecha_fin: "2026-08-01", hora_fin: "24:00:00", duracion_min: "90.5", desc_paro: null,
      id_responsable: "T-MTO-ME", cod_falla: null, texto_falla: null, id_tipo_mantto: "PP",
      tipo_paro_pp_npi: null, resumen: null,
    });
    expect(p).toMatchObject({ aviso: 300012345, id_equipo: 100305, hora_inicio: "08:30:00", hora_fin: "24:00:00", duracion_min: 90.5, desc_paro: "" });
    expect(convertirParo({ ...p, duracion_min: null }).duracion_min).toBeNull();
  });

  it("convierte la fecha de las metas a dd/mm/aaaa y deja nulos los opcionales", () => {
    expect(isoADmy("2026-01-01")).toBe("01/01/2026");
    expect(convertirMeta({ mes: "2026-03-01", equipo_descripcion: "X", meta_disp: "0.85", meta_mttr: null, meta_mtbf: "12", meta_conf: null }))
      .toEqual({ mes: "01/03/2026", equipo_descripcion: "X", meta_disp: 0.85, meta_mttr: null, meta_mtbf: 12, meta_conf: null });
  });

  it("convierte una carga", () => {
    expect(convertirCarga({ id: "7", fecha_carga: "2026-11-22T10:00:00Z", archivo: "a.xlsx", fecha_min: "2026-01-01", fecha_max: null, filas: { paros: "11622" } }))
      .toEqual({ id: 7, fecha_carga: "2026-11-22T10:00:00Z", archivo: "a.xlsx", fecha_min: "2026-01-01", fecha_max: null, filas: { paros: 11622 } });
  });
});

describe("rutaStorage", () => {
  it("usa aaaa/mm/dd-hhmmss_nombre.xlsx y limpia el nombre", () => {
    expect(rutaStorage("LIBRO MAESTRO ñ 15-09.xlsx", new Date(2026, 10, 2, 9, 5, 7))).toBe("2026/11/02-090507_LIBRO_MAESTRO_n_15-09.xlsx");
  });
});
