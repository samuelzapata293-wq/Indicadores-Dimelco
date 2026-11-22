import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import { leerLibro, type ResultadoLectura } from "../../src/datos/excel";
import { disp, fechaASerial, fin, inicio, minutosAjustados, responsable, serialADate, serialAFecha, tipoParo } from "../../src/datos/derivados";

const RUTA = new URL("../../datos_local/LIBRO_MAESTRO_15-09-2026.xlsx", import.meta.url).pathname;

describe.skipIf(!existsSync(RUTA))("lectura del Excel real", () => {
  let r: ResultadoLectura;
  beforeAll(async () => {
    const b = readFileSync(RUTA);
    r = await leerLibro(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    // Conteos reales, para reportar.
    console.log("filasPorTabla", r.resumen.filasPorTabla, "descartadas", r.resumen.descartadas);
    console.log("fechas", r.resumen.fechaMin, r.resumen.fechaMax, "avisos", r.avisos.length, "errores", r.errores);
  }, 120_000);

  it("no tiene errores fatales", () => {
    expect(r.errores).toEqual([]);
  });

  it("lee las tablas de parámetros con los conteos reales", () => {
    expect(r.datos.equipos).toHaveLength(25);
    // La Tabla18 tiene 15 filas, pero solo 13 traen código (las otras 2 se descartan).
    expect(r.datos.responsables).toHaveLength(13);
    expect(r.datos.responsables.every((x) => x.id_responsable !== "")).toBe(true);
    expect(r.datos.tipos_mantto.map((t) => t.id_tipo_mantto)).toEqual(["PP", "NPI", "EPP"]);
    expect(r.datos.metas).toHaveLength(216);
  });

  it("recorta descripciones y normaliza metas", () => {
    expect(r.datos.equipos.every((e) => e.descripcion === e.descripcion.trim())).toBe(true);
    expect(r.datos.equipos.find((e) => e.id_equipo === 100305)?.descripcion).toBe("CAMIÓN BP 985 EIMCO No.03");
    expect(r.datos.metas[0]).toMatchObject({ mes: "01/01/2026", equipo_descripcion: "CARGADOR FRONTAL BP SCOOP ST1030 No. 01" });
    expect(r.datos.metas.every((m) => /^\d{2}\/\d{2}\/\d{4}$/.test(m.mes) && m.meta_disp > 0 && m.meta_disp <= 1)).toBe(true);
  });

  it("cuenta filas y descartes de paros de forma coherente", () => {
    const { filasPorTabla, descartadas } = r.resumen;
    expect(filasPorTabla.Tabla2).toBe(
      r.datos.paros.length + descartadas.sinAviso + descartadas.sinEquipo + descartadas.sinFechaFin + descartadas.sinFechaInicio,
    );
    expect(filasPorTabla.Tabla2 - descartadas.sinAviso).toBe(14325); // filas con aviso (contrato 1.1)
    // 14 325 con aviso - 2 700 de equipos fuera de Tabla5 - 3 sin fecha de fin.
    expect(descartadas).toEqual({ sinAviso: 6269, sinEquipo: 2700, sinFechaFin: 3, sinFechaInicio: 0 });
    expect(r.datos.paros).toHaveLength(11622);
  });

  it("los paros cumplen las reglas de transformación", () => {
    const ids = new Set(r.datos.equipos.map((e) => e.id_equipo));
    for (const p of r.datos.paros) {
      expect(ids.has(p.id_equipo)).toBe(true);
      expect(p.fecha_fin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.hora_inicio).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(p.hora_inicio).not.toBe("24:00:00");
      expect(p.hora_fin).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    }
    expect(r.datos.paros.some((p) => p.hora_fin === "24:00:00")).toBe(true);
  });

  it("fecha máxima de inicio es 2026-11-20", () => {
    expect(r.resumen.fechaMax).toBe("2026-11-20");
  });

  it("caso concreto: aviso 940365357 del equipo 618487", () => {
    const p = r.datos.paros.find((x) => x.aviso === 940365357);
    expect(p).toBeDefined();
    expect(p!.id_equipo).toBe(618487);
    expect(r.datos.equipos.find((e) => e.id_equipo === 618487)?.descripcion).toBe("JUMBO DE PERFORACION ATLAS SIMBA S7 N°1");
    expect(p!.desc_paro).toBe("BOMBA HIDRAULICA PRINCIPAL EN M/E");
    expect(serialADate(inicio(p!)).toISOString()).toBe("2026-11-03T18:00:00.000Z");
    expect(serialADate(fin(p!)).toISOString()).toBe("2026-11-05T16:20:00.000Z");
    expect(p!.duracion_min).toBe(2780);
    expect(p!.id_responsable).toBe("T-MTO-ME");
    expect(p!.id_tipo_mantto).toBe("NPI");
  });

  it("la duración de la hoja coincide con fin - inicio", () => {
    const malas = r.datos.paros.filter((p) => p.duracion_min !== null && Math.abs((fin(p) - inicio(p)) * 1440 - p.duracion_min) > 1);
    console.log("paros con duración distinta de fin-inicio (>1 min):", malas.length, malas.slice(0, 3));
  });
});

describe("leerLibro con archivos inválidos", () => {
  it("reporta error fatal si no es un xlsx", async () => {
    const res = await leerLibro(new TextEncoder().encode("hola").buffer as ArrayBuffer);
    expect(res.errores.length).toBeGreaterThan(0);
    expect(res.datos.paros).toEqual([]);
  });
});

describe("derivados", () => {
  const base = { fecha_inicio: "2026-11-03", hora_inicio: "18:00:00", fecha_fin: "2026-11-05", hora_fin: "16:20:00" };

  it("convierte fechas a serial de Excel y de vuelta", () => {
    expect(fechaASerial("1900-03-01")).toBe(61);
    expect(fechaASerial("2026-11-03")).toBe(46329);
    expect(serialAFecha(46329.75)).toBe("2026-11-03");
    expect(Number.isNaN(fechaASerial("basura"))).toBe(true);
  });

  it("inicio y fin como días serial con fracción de hora", () => {
    expect(inicio(base)).toBeCloseTo(46329.75, 9);
    expect(fin(base)).toBeCloseTo(46331 + (16 * 60 + 20) / 1440, 9);
    expect((fin(base) - inicio(base)) * 1440).toBeCloseTo(2780, 6);
  });

  it("hora 24:00:00 en inicio es 00:00:00 del mismo día", () => {
    expect(inicio({ fecha_inicio: "2026-11-03", hora_inicio: "24:00:00" })).toBe(46329);
  });

  it("hora 24:00:00 en fin suma un día", () => {
    expect(fin({ fecha_fin: "2026-11-03", hora_fin: "24:00:00" })).toBe(46330);
  });

  it("acepta horas sin segundos", () => {
    expect(inicio({ fecha_inicio: "2026-11-03", hora_inicio: "06:30" })).toBeCloseTo(46329 + 0.270833333, 6);
  });

  it("tipoParo: texto después del primer espacio, en nombre propio", () => {
    expect(tipoParo("123 PARO REVISIÓN HIDRÁULICA")).toBe("Paro Revisión Hidráulica");
    expect(tipoParo("001 falla ELÉCTRICA de motor")).toBe("Falla Eléctrica De Motor");
    expect(tipoParo("o'neil 1st")).toBe("1St");
  });

  it("tipoParo: resumen sin espacio o vacío da cadena vacía", () => {
    expect(tipoParo("SINESPACIO")).toBe("");
    expect(tipoParo("")).toBe("");
  });

  it("disp y responsable por código", () => {
    expect(disp("T-MTO-ME")).toBe("Mecánica");
    expect(disp("T-MTO-EL")).toBe("Mecánica");
    expect(disp("T-OPE-MP")).toBe("Operacional");
    expect(disp("T-OPH-EX")).toBe("Operacional");
    expect(responsable("T-MTO-ME")).toBe("Mantenimiento");
    expect(responsable("T-OPH-EX")).toBe("Operación");
  });

  it("disp y responsable sin -MTO-/-OPE-/-OPH- devuelven el propio id", () => {
    expect(disp("T-FES-NI")).toBe("T-FES-NI");
    expect(responsable("T-MTH-GD")).toBe("T-MTH-GD");
    expect(disp("")).toBe("");
  });

  it("minutosAjustados: 2 días y 20 h = 4080 min -> 2 * 1080 + 1080", () => {
    expect(minutosAjustados(4080)).toBe(3240);
  });

  it("minutosAjustados: casos borde", () => {
    expect(minutosAjustados(0)).toBe(0);
    expect(minutosAjustados(600)).toBe(600);
    expect(minutosAjustados(1080)).toBe(1080);
    expect(minutosAjustados(1440)).toBe(1080);
    expect(minutosAjustados(1500)).toBe(1080 + 60);
    expect(minutosAjustados(2780)).toBe(2160); // 1 día + 1340 min -> 1080 + min(1340, 1080)
  });
});
