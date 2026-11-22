import { describe, expect, it } from "vitest";
import { EQUIPOS_POR_PAGINA, EQUIPOS_RESUMEN, type Contexto } from "../../src/medidas/contexto";
import { graficoFamilia, panelesSemanales, resumenPorEquipo, resumenPorFamilia, tablaParos } from "../../src/medidas/visuales";
import { cargarDatos, cargarFixture, cargarModelo, contextoDeFixture } from "./ayudas";
import { prepararModelo } from "../../src/medidas/modelo";
import { serialAFecha, fechaASerial } from "../../src/datos/derivados";
import type { DatosModelo } from "../../src/datos/tipos";

// Criterio: calcular todos los visuales de una página para un periodo de un mes tarda menos de 50 ms.
// Se mide la primera ejecución (sin calentar el JIT) y la mediana de ejecuciones repetidas.

const base: Contexto = { ini: "2026-11-01", fin: "2026-11-30", equipos: [], disp: ["Mecánica"], hDisp: 24, tConf: 18 };

const PAGINAS: Record<string, (m: ReturnType<typeof cargarModelo>) => void> = {
  "familia ST1030 (gráfico + tabla)": (m) => {
    const c = { ...base, equipos: [...EQUIPOS_POR_PAGINA.st1030] };
    graficoFamilia(m, c);
    tablaParos(m, c);
  },
  "familia ST1030 con la tabla de los 8 scoops": (m) => {
    const c = { ...base, equipos: [...EQUIPOS_POR_PAGINA.st1030, ...EQUIPOS_POR_PAGINA.st35, 100361] };
    graficoFamilia(m, c);
    tablaParos(m, c);
  },
  "Resumen Disp. (por equipo + por familia)": (m) => {
    const c = { ...base, equipos: [...EQUIPOS_RESUMEN] };
    resumenPorEquipo(m, c);
    resumenPorFamilia(m, c);
  },
  "Disp Mensual (18 equipos, un mes)": (m) => {
    panelesSemanales(m, { ...base, equipos: [...EQUIPOS_RESUMEN] });
  },
  "Disp Mensual (18 equipos, cinco meses)": (m) => {
    panelesSemanales(m, { ...base, ini: "2026-07-01", fin: "2026-11-30", equipos: [...EQUIPOS_RESUMEN] });
  },
};

function ms(f: () => void): number {
  const t0 = performance.now();
  f();
  return performance.now() - t0;
}

describe("rendimiento (Node)", () => {
  it("prepararModelo con la muestra", () => {
    const datos = cargarDatos();
    const t = ms(() => prepararModelo(datos));
    console.log(`prepararModelo(${datos.paros.length} paros): ${t.toFixed(1)} ms`);
    expect(t).toBeLessThan(500);
  });

  const filas: Record<string, string | number>[] = [];
  for (const [nombre, f] of Object.entries(PAGINAS)) {
    it(`${nombre} < 50 ms`, () => {
      const modelo = prepararModelo(cargarDatos()); // modelo nuevo: primera ejecución en frío
      const primera = ms(() => f(modelo));
      const rep: number[] = [];
      for (let i = 0; i < 30; i++) rep.push(ms(() => f(modelo)));
      rep.sort((a, b) => a - b);
      filas.push({ visual: nombre, primeraMs: Number(primera.toFixed(2)), medianaMs: Number(rep[15].toFixed(2)), maxMs: Number(rep[29].toFixed(2)) });
      expect(primera).toBeLessThan(50);
      expect(rep[29]).toBeLessThan(50);
    });
  }

  it("resumen de tiempos", () => {
    console.table(filas);
  });
});

/** Datos de prueba del tamaño del Excel real (~11 600 paros): la muestra repetida hacia atrás en el tiempo. */
function datosGrandes(copias: number): DatosModelo {
  const d = cargarDatos();
  const paros = [...d.paros];
  for (let c = 1; c < copias; c++) {
    for (const p of d.paros) {
      const desp = -c * 200;
      paros.push({
        ...p,
        fecha_inicio: serialAFecha(fechaASerial(p.fecha_inicio) + desp),
        fecha_fin: serialAFecha(fechaASerial(p.fecha_fin) + desp),
      });
    }
  }
  return { ...d, paros };
}

describe("rendimiento con un modelo del tamaño del Excel real", () => {
  const datos = datosGrandes(6);
  it(`prepararModelo(${datos.paros.length} paros) < 500 ms`, () => {
    const t = ms(() => prepararModelo(datos));
    console.log(`prepararModelo(${datos.paros.length} paros): ${t.toFixed(1)} ms`);
    expect(t).toBeLessThan(500);
  });

  const filas: Record<string, string | number>[] = [];
  for (const [nombre, f] of Object.entries(PAGINAS)) {
    it(`${nombre} < 50 ms`, () => {
      const modelo = prepararModelo(datos);
      const primera = ms(() => f(modelo));
      const rep: number[] = [];
      for (let i = 0; i < 30; i++) rep.push(ms(() => f(modelo)));
      rep.sort((a, b) => a - b);
      filas.push({ visual: nombre, primeraMs: Number(primera.toFixed(2)), medianaMs: Number(rep[15].toFixed(2)), maxMs: Number(rep[29].toFixed(2)) });
      expect(primera).toBeLessThan(50);
      expect(rep[29]).toBeLessThan(50);
    });
  }

  it("resumen de tiempos", () => {
    console.table(filas);
  });
});

describe("DISP GLOBAL: Mecánica sola equivale a NOT IN Operacional en las capturas", () => {
  // Power BI guardó el filtro como NOT IN ('Operacional'), que también deja pasar códigos sueltos
  // como T-FES-NI. En la muestra esos paros caen fuera de los periodos capturados, así que la lista
  // ["Mecánica"] da lo mismo.
  const modelo = cargarModelo();
  for (const nombre of ["q_022_1", "q_017_1", "q_014_1", "q_010_0", "q_007_1"]) {
    it(`${nombre}: misma tabla con ["Mecánica"] que con el complemento de Operacional`, () => {
      const fx = cargarFixture(nombre);
      const c = contextoDeFixture(modelo, fx);
      expect(c.disp).toContain("T-FES-NI"); // el complemento incluye los códigos sueltos
      const a = tablaParos(modelo, c);
      const b = tablaParos(modelo, { ...c, disp: ["Mecánica"] });
      expect(b).toEqual(a);
    });
  }
});
