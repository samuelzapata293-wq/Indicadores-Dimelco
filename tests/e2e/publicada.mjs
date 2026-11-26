// Pruebas de punta a punta sobre la web publicada (React + HashRouter + datos reales en Supabase),
// como invitado, comparando lo que se ve con los valores reales de Power BI (tests/fixtures).
//
// Uso:   NODE_PATH=$(npm root -g) node tests/e2e/publicada.mjs
// Opciones por variable de entorno:
//   URL_PUBLICADA   direccion de la web (por defecto la de GitHub Pages)
//   SOLO            "comparacion" o "funcional" para correr solo una parte
//   SALIDA          ruta del JSON de resultados (por defecto docs/pruebas/resultados_e2e.json)
//   OMITIR          lista separada por comas de bloques a omitir al depurar (F10, F11, F12, F13, F14, F16)
//   CAPTURAS        carpeta de capturas (por defecto docs/pruebas/capturas_e2e)
//
// Barras de desplazamiento: Playwright las oculta por defecto (--hide-scrollbars). La comparacion y las demas
// comprobaciones corren asi (igual que las corridas anteriores); F15 (tabla de paros sin barra horizontal) y F17
// (PDF sin barras) corren en un segundo navegador con las barras visibles, como las ve una persona.
//
// Requisitos: playwright (NODE_PATH=$(npm root -g)), pdfinfo y pdftoppm (poppler) y python3 con PIL y numpy
// (solo para las comprobaciones del PDF exportado, F17).
//
// Salida: JSON con todos los resultados (lo consume tests/e2e/informe.mjs) y un resumen por consola.
// Codigo de salida 0 si todo coincide y todas las comprobaciones pasan, 1 si hay diferencias.

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = process.env.URL_PUBLICADA ?? "https://samuelzapata293-wq.github.io/Indicadores-Dimelco/";
const SOLO = process.env.SOLO ?? "";
const OMITIR = (process.env.OMITIR ?? "").split(",").filter(Boolean); // ids de bloque a omitir (depuracion): F10, F11, F12, F13, F14, F16
const omitido = (id) => OMITIR.includes(id);
const SALIDA = process.env.SALIDA ?? path.join(RAIZ, "docs/pruebas/resultados_e2e.json");
const CAPTURAS = process.env.CAPTURAS ?? path.join(RAIZ, "docs/pruebas/capturas_e2e");
const T_CARGA = 300_000; // la carga de los 11 622 paros por el proxy del entorno llego a tardar minutos
const VENTANA = { width: 1600, height: 900 };

// ---------------------------------------------------------------------------------------------
// Formato como la app (src/components/formato.ts) y como Power BI (mitad hacia arriba)
// ---------------------------------------------------------------------------------------------
// Un valor en blanco de Power BI (null) se muestra como celda vacia.
const horas = (v) => (v == null ? "" : v.toFixed(2));
const pct0 = (v) => (v == null ? "" : `${Math.round(v * 100)}%`);
const pct2 = (v) => (v == null ? "" : `${(v * 100).toFixed(2)} %`);
// Mitad hacia arriba sobre la representacion decimal del numero (lo que haria Power BI al mostrar).
const redMitad = (v, d) => {
  const s = Math.sign(v) || 1;
  return s * Math.round(Number(`${Math.abs(v)}e${d}`)) / 10 ** d;
};
const horasPbi = (v) => (v == null ? "" : redMitad(v, 2).toFixed(2));
const pct0Pbi = (v) => (v == null ? "" : `${redMitad(v * 100, 0)}%`);
const pct2Pbi = (v) => (v == null ? "" : `${redMitad(v * 100, 2).toFixed(2)} %`);
function fechaHora(iso) {
  const r = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  if (!r) return String(iso);
  const [, y, m, d, h, mi, s] = r.map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const dd = (n) => String(n).padStart(2, "0");
  return `${m}/${d}/${y} ${h12}:${dd(mi)}:${dd(s)} ${h < 12 ? "AM" : "PM"}`;
}
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------------------------
// Fixtures de Power BI y filtros de cada uno
// ---------------------------------------------------------------------------------------------
const leer = (...p) => JSON.parse(fs.readFileSync(path.join(RAIZ, "tests/fixtures", ...p), "utf8"));

// Nombres cortos de equipo: se leen del propio src/pages/nombresCortos.ts (sin duplicar el mapa) y se aplica
// la misma regla que la app: el nombre corto del id_equipo o, si el id no esta en el mapa, el nombre completo.
const NOMBRES_CORTOS = (() => {
  const fuente = fs.readFileSync(path.join(RAIZ, "src/pages/nombresCortos.ts"), "utf8");
  const bloque = /NOMBRES_CORTOS[^{]*\{([\s\S]*?)\n\};/.exec(fuente);
  if (!bloque) throw new Error("No se pudo leer el mapa de src/pages/nombresCortos.ts");
  const mapa = new Map();
  for (const m of bloque[1].matchAll(/^\s*(\d+):\s*"([^"]+)"/gm)) mapa.set(String(Number(m[1])), m[2]);
  if (mapa.size === 0) throw new Error("El mapa de nombres cortos quedo vacio al leerlo");
  return mapa;
})();
const nombreCorto = (id, completo) => NOMBRES_CORTOS.get(String(Number(id))) ?? completo;
/** Orden de las 8 paginas, leido de src/pages/ordenPaginas.ts. */
const ORDEN_PAGINAS = (() => {
  const fuente = fs.readFileSync(path.join(RAIZ, "src/pages/ordenPaginas.ts"), "utf8");
  return [...fuente.matchAll(/\{\s*ruta:\s*"([^"]+)",\s*titulo:\s*"([^"]+)"\s*\}/g)].map((m) => ({ ruta: m[1], titulo: m[2] }));
})();
// Los fixtures de grafico y de Disp Mensual traen solo la descripcion del equipo; el id se toma de los fixtures
// que traen los dos (Resumen por equipo: IDEQUIPO + Descripcion; tabla de paros: IDEQUIPO + DesEquipo).
const ID_POR_DESCRIPCION = new Map();
const nombreEsperado = (descripcion, id) => nombreCorto(id ?? ID_POR_DESCRIPCION.get(norm(descripcion)) ?? "", descripcion);

function sumarDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Filtros de la interfaz que reproducen los del fixture. */
function filtrosDe(fx) {
  const f = fx.filtros;
  const fecha = f["DIM_TIEMPO[Fecha]"];
  const disp = f["HECHOS_DATAMES_NPI_PP[DISP]"];
  const conf = f["Confiabilidad[Confiabilidad]"];
  const fam = f["DIM_EQUIPOS[Familia]"];
  return {
    desde: fecha[">="].slice(0, 10),
    hasta: sumarDias(fecha["<"].slice(0, 10), -1), // el fin del rango en Power BI es exclusivo
    hDisp: parseInt(f["Var_t: Disp[Var_t: Disp]"].in[0], 10),
    tConf: conf ? parseInt(conf.in[0], 10) : null,
    disp: !disp ? [] : disp.not_in ? ["Mecánica", "Operacional"].filter((x) => !disp.not_in.includes(x)) : disp.in,
    familia: fam ? fam.in[0] : null,
  };
}

const PAGINAS = {
  resumen: { ruta: "#/resumen", nombre: "Resumen Disp." },
  simba: { ruta: "#/simba", nombre: "Disp Simba" },
  jumbo: { ruta: "#/jumbo", nombre: "Disp Jumbo" },
  sostenimiento: { ruta: "#/sostenimiento", nombre: "Disp Sostenimiento" },
  st35: { ruta: "#/st35", nombre: "Disp Scooptram ST3.5" },
  st1030: { ruta: "#/st1030", nombre: "Disp Scooptram ST1030" },
  mensual: { ruta: "#/mensual", nombre: "Disp Mensual" },
};

function fixturesComparables() {
  const lista = [];
  // Capturas originales (tests/fixtures/powerbi): 01/11 a 20/11, 24 h, Mecanica, Conf. 18 h; Mensual 01/07 a 05/11.
  const orig = [
    ["q_001_0", "resumen", "resumen_equipo"], ["q_000_1", "resumen", "resumen_familia"],
    ["q_021_0", "simba", "grafico"], ["q_022_1", "simba", "tabla"],
    ["q_018_0", "jumbo", "grafico"], ["q_017_1", "jumbo", "tabla"],
    ["q_013_0", "sostenimiento", "grafico"], ["q_014_1", "sostenimiento", "tabla"],
    ["q_008_0", "st35", "grafico"], ["q_010_0", "st35", "tabla"],
    ["q_006_0", "st1030", "grafico"], ["q_007_1", "st1030", "tabla"],
    ["q_024_0", "mensual", "mensual"],
  ];
  for (const [id, pagina, visual] of orig) {
    const fx = leer("powerbi", `${id}.json`);
    lista.push({ esc: "orig", descripcion: "Capturas originales: 01 al 20/11/2026, 24 h, Mecánica, Conf. 18 h (Mensual 01/07 al 05/11)", fixture: id, pagina, visual, fx });
  }
  const dir = path.join(RAIZ, "tests/fixtures/powerbi_escenarios");
  const re = /^(.+?)_(resumen_equipo|resumen_familia|grafico_simba|grafico_sostenimiento|tabla_simba|tabla_sostenimiento|mensual)$/;
  for (const nombre of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const m = re.exec(nombre.replace(/\.json$/, ""));
    if (!m) throw new Error(`Fixture sin clasificar: ${nombre}`);
    const [, esc, vis] = m;
    const fx = leer("powerbi_escenarios", nombre);
    const [tipo, fam] = vis.split("_");
    const pagina = tipo === "resumen" ? "resumen" : tipo === "mensual" ? "mensual" : fam;
    const visual = tipo === "resumen" ? vis : tipo === "mensual" ? "mensual" : tipo; // grafico | tabla
    lista.push({ esc, descripcion: fx.escenario_descripcion, fixture: nombre.replace(/\.json$/, ""), pagina, visual, fx });
  }
  for (const x of lista) {
    x.filtros = filtrosDe(x.fx);
    for (const r of x.fx.filas) {
      const id = r["DIM_EQUIPOS.IDEQUIPO"];
      const d = r["DIM_EQUIPOS.Descripcion"] ?? r["HECHOS_DATAMES_NPI_PP.DesEquipo"];
      if (id != null && d != null) ID_POR_DESCRIPCION.set(norm(d), String(id));
    }
  }
  return lista;
}

// ---------------------------------------------------------------------------------------------
// Registro de resultados
// ---------------------------------------------------------------------------------------------
const R = {
  url: BASE,
  fecha: new Date().toISOString(),
  navegador: "",
  comparaciones: [], // una por fixture: { esc, descripcion, fixture, pagina, visual, comparados, iguales, diferencias[], informativas[] }
  funcionales: [], // { id, nombre, ok, detalle }
  tiempos: {},
  consola: [],
  selectoresFaltantes: [
    "Periodo de tiempo: los dos input[type=date] tienen aria-label 'Desde' y 'Hasta' (estables); la sección que los contiene no tiene role ni nombre.",
    "Tablas: tienen aria-label (Tabla de paros, Resumen por equipo, Resumen por familia); la de familia usa la clase .tabla-familia.",
    "Gráfico de columnas: el contenedor tiene role=img y aria-label, pero los números solo existen dentro del SVG de ECharts, sin data-attributes. Se distinguen las series por el color del texto (#252423 Disp, #fff Meta) y el equipo por la posición x del eje.",
    "Disp Mensual: sin data-attributes en los puntos. Se leen los círculos del SVG por su relleno (#D9B300 Disp, #12239E Meta) y se convierte la posición y a % con la calibración del eje de PanelesSemanales.tsx (arriba 40 px, abajo 13 px, máximo 1.06). Si cambian esos márgenes la comparación de puntos hay que recalibrarla.",
    "Portada: el rango de fechas se lee de .portada-fecha y los botones de .portada-boton (clases, sin data-testid); la flecha de volver es a.lienzo-volver (tiene aria-label 'Volver a Portada').",
  ],
  notas: [],
};

function nuevaComparacion(x) {
  return { esc: x.esc, descripcion: x.descripcion, fixture: x.fixture, pagina: PAGINAS[x.pagina].nombre, visual: x.visual, filtros: x.filtros, comparados: 0, iguales: 0, diferencias: [], informativas: [], notas: [] };
}
/** Compara un valor mostrado con el esperado; `alt` es la version con redondeo de Power BI (mitad hacia arriba). */
function cmp(c, item, campo, esperado, obtenido, alt) {
  c.comparados++;
  esperado = norm(esperado);
  obtenido = norm(obtenido);
  if (esperado === obtenido) {
    c.iguales++;
    if (alt !== undefined && norm(alt) !== esperado) {
      c.informativas.push({ item, campo, appRedondeo: esperado, pbiRedondeo: norm(alt), web: obtenido, nota: "El valor sin redondear cae en un empate decimal; la web coincide con el redondeo de la app (toFixed/Math.round) y no con la mitad hacia arriba" });
    }
    return;
  }
  const dif = { item, campo, powerbi: esperado, web: obtenido };
  if (alt !== undefined && norm(alt) !== esperado && norm(alt) === obtenido) dif.redondeoPbi = norm(alt);
  c.diferencias.push(dif);
}

function funcional(id, nombre, ok, detalle = "") {
  R.funcionales.push({ id, nombre, ok: Boolean(ok), detalle });
  console.log(`${ok ? "PASA " : "FALLA"} ${id} ${nombre}${detalle ? ` | ${detalle}` : ""}`);
}

// ---------------------------------------------------------------------------------------------
// Interfaz: filtros y lectura
// ---------------------------------------------------------------------------------------------
const seccion = (page, titulo) => page.locator("section.seg", { has: page.locator("h3.seg-cabecera", { hasText: new RegExp(`^${titulo.replace(/[.]/g, "\\.")}$`) }) });

async function esperarEstable(page, ms = 700) {
  // El contexto de medidas se difiere (useDeferredValue): se espera a que el lienzo deje de cambiar.
  let previo = "";
  let desde = Date.now();
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    const actual = await page.evaluate(() => {
      const l = document.querySelector(".lienzo");
      return l ? `${l.innerText}|${l.innerHTML.length}` : "";
    });
    if (actual === previo && actual !== "") {
      if (Date.now() - desde >= ms) return;
    } else {
      previo = actual;
      desde = Date.now();
    }
    await page.waitForTimeout(120);
  }
}

async function esperarPagina(page, ruta) {
  await page.waitForFunction((r) => location.hash === r, ruta);
  await page.waitForSelector(".lienzo-tablero, .portada-lienzo", { timeout: T_CARGA });
  if (ruta !== "#/") await page.waitForSelector(".tabla-pbi tbody tr td, .panel-sem-lienzo svg", { timeout: T_CARGA });
  await esperarEstable(page);
}

async function irA(page, ruta) {
  await page.evaluate((r) => { location.hash = r; }, ruta);
  await esperarPagina(page, ruta);
}

async function estadoFiltros(page) {
  return page.evaluate(() => {
    const sec = (t) => [...document.querySelectorAll("section.seg")].find((s) => s.querySelector("h3")?.textContent.trim() === t);
    const f = sec("Periodo de tiempo");
    const radios = (t) => { const s = sec(t); return s ? [...s.querySelectorAll("button[role=radio]")].find((b) => b.getAttribute("aria-checked") === "true")?.textContent.trim() ?? null : null; };
    const checks = (t) => { const s = sec(t); return s ? [...s.querySelectorAll("label.seg-item")].filter((l) => l.querySelector("input")?.checked).map((l) => l.textContent.trim()).filter((x) => x !== "Select all") : null; };
    const fam = sec("Familia");
    return {
      desde: f?.querySelector('input[aria-label="Desde"]')?.value ?? null,
      hasta: f?.querySelector('input[aria-label="Hasta"]')?.value ?? null,
      hDisp: radios("Var t: Disp"),
      tConf: radios("Var t: Conf."),
      disp: checks("DISP. GLOBAL"),
      familia: fam ? [...fam.querySelectorAll("label.seg-item")].find((l) => l.querySelector("input")?.checked)?.textContent.trim() ?? null : null,
    };
  });
}

async function fijarPeriodo(page, desde, hasta) {
  const ini = page.locator('input[aria-label="Desde"]');
  const fin = page.locator('input[aria-label="Hasta"]');
  const actual = await estadoFiltros(page);
  // Si el nuevo inicio queda despues del fin actual, se mueve primero el fin (la app intercambia fechas invertidas).
  if (desde > actual.hasta) {
    await fin.fill(hasta);
    await ini.fill(desde);
  } else {
    await ini.fill(desde);
    await fin.fill(hasta);
  }
}

async function fijarDisp(page, deseados) {
  const sec = seccion(page, "DISP. GLOBAL");
  for (const op of ["Mecánica", "Operacional"]) {
    if (deseados.includes(op)) await sec.getByLabel(op, { exact: true }).setChecked(true);
  }
  for (const op of ["Mecánica", "Operacional"]) {
    if (!deseados.includes(op)) await sec.getByLabel(op, { exact: true }).setChecked(false);
  }
}

async function aplicarFiltros(page, f) {
  await fijarPeriodo(page, f.desde, f.hasta);
  await page.getByRole("radiogroup", { name: "Var t: Disp" }).getByRole("radio", { name: `${f.hDisp} hrs`, exact: true }).click();
  if (f.tConf && (await page.getByRole("radiogroup", { name: "Var t: Conf." }).count())) {
    await page.getByRole("radiogroup", { name: "Var t: Conf." }).getByRole("radio", { name: `${f.tConf} hrs`, exact: true }).click();
  }
  await fijarDisp(page, f.disp);
  if (f.familia) await seccion(page, "Familia").getByLabel(f.familia, { exact: true }).check();
  await esperarEstable(page);
  const e = await estadoFiltros(page);
  const ok = e.desde === f.desde && e.hasta === f.hasta && e.hDisp === `${f.hDisp} hrs` &&
    JSON.stringify([...e.disp].sort()) === JSON.stringify([...f.disp].sort()) &&
    (!f.tConf || e.tConf === `${f.tConf} hrs`) && (!f.familia || e.familia === f.familia);
  return { ok, estado: e };
}

const leerTabla = (page, selector) =>
  page.evaluate((sel) => [...document.querySelectorAll(`${sel} tbody tr`)].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.trim())).filter((f) => f.length > 1), selector);

const SEL_TABLA = { equipo: ".tabla-resumen", familia: ".tabla-familia", paros: ".tabla-paros" };

async function leerGrafico(page) {
  return page.evaluate(() => {
    const svg = document.querySelector(".graf-lienzo svg");
    const pos = (t) => {
      const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(t.getAttribute("transform") || "");
      return { x: +m[1], y: +m[2] + Number(t.getAttribute("y") || 0) };
    };
    const textos = [...svg.querySelectorAll("text")].map((t) => ({ ...pos(t), tx: t.textContent, fill: (t.getAttribute("fill") || "").toLowerCase() }));
    const eje = textos.filter((t) => t.fill === "#605e5c");
    const cats = [...new Set(eje.map((t) => t.x))].sort((a, b) => a - b).map((x) => ({
      x, nombre: eje.filter((t) => t.x === x).sort((a, b) => a.y - b.y).map((t) => t.tx).join(" "),
    }));
    const etiquetas = textos.filter((t) => t.fill !== "#605e5c").map((t) => ({ x: t.x, tx: t.tx, serie: t.fill === "#252423" ? "disp" : "meta" }));
    return { cats, etiquetas };
  });
}

async function leerMensual(page) {
  return page.evaluate(() => {
    const xy = (t) => /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(t.getAttribute("transform") || "");
    const paneles = [...document.querySelectorAll(".panel-sem")].map((p) => {
      const svg = p.querySelector("svg");
      const puntos = { disp: [], meta: [] };
      for (const el of svg.querySelectorAll('path[transform^="matrix(0.5"]')) {
        const m = /matrix\(0\.5,0,0,0\.5,([-\d.]+),([-\d.]+)\)/.exec(el.getAttribute("transform"));
        const f = (el.getAttribute("fill") || "").toUpperCase();
        if (f === "#D9B300") puntos.disp.push({ x: +m[1], y: +m[2] });
        if (f === "#12239E") puntos.meta.push({ x: +m[1], y: +m[2] });
      }
      const etiquetas = [...svg.querySelectorAll("text")].map((t) => ({ x: +xy(t)[1], tx: t.textContent }));
      return { titulo: p.querySelector(".panel-sem-titulo").textContent.trim(), alto: +svg.getAttribute("height"), puntos, etiquetas };
    });
    const ejes = [...document.querySelectorAll(".paneles-eje svg")].map((s) => [...s.querySelectorAll("text")].map((t) => ({ tx: t.textContent.trim(), x: +/matrix\([-\d.]+,[-\d.]+,[-\d.]+,[-\d.]+,([-\d.]+),/.exec(t.getAttribute("transform"))[1] })));
    return { paneles, semanas: (ejes[0] ?? []).map((t) => t.tx), xsSemanas: (ejes[0] ?? []).map((t) => t.x) };
  });
}

// ---------------------------------------------------------------------------------------------
// Comparaciones por visual
// ---------------------------------------------------------------------------------------------
function compararResumenEquipo(c, filas, fx) {
  const web = new Map(filas.map((f) => [f[0], f]));
  const esperados = new Set();
  for (const r of fx.filas) {
    const id = String(r["DIM_EQUIPOS.IDEQUIPO"]);
    esperados.add(id);
    const w = web.get(id);
    const it = `${id} ${r["DIM_EQUIPOS.Descripcion"]}`;
    if (!w) { for (const campo of ["EQUIPO", "DENOMINACION", "MTTR", "MTBF", "Meta_Disp", "Disp %", "Confiab. %", "Prob. Falla"]) cmp(c, it, campo, "presente", "ausente"); continue; }
    const v = (k) => r[k];
    cmp(c, it, "EQUIPO", id, w[0]);
    cmp(c, it, "DENOMINACION", v("DIM_EQUIPOS.Descripcion"), w[1]);
    cmp(c, it, "MTTR_Horas", horas(v("Metricas (2).MTTR_H")), w[2], horasPbi(v("Metricas (2).MTTR_H")));
    cmp(c, it, "MTBF_Horas", horas(v("Metricas (2).MTBF_H")), w[3], horasPbi(v("Metricas (2).MTBF_H")));
    cmp(c, it, "Meta_Disp", pct0(v("Metas2026.Meta_Disp")), w[4], pct0Pbi(v("Metas2026.Meta_Disp")));
    cmp(c, it, "Disponibilidad %", pct0(v("Metricas (2).Disp Din %")), w[5], pct0Pbi(v("Metricas (2).Disp Din %")));
    cmp(c, it, "Confiabilidad %", pct2(v("Metricas.Confiabilidad_24h")), w[6], pct2Pbi(v("Metricas.Confiabilidad_24h")));
    cmp(c, it, "Prob. de Falla", pct2(v("Metricas.ProbabilidadDeFalla")), w[7], pct2Pbi(v("Metricas.ProbabilidadDeFalla")));
  }
  for (const [id, w] of web) if (!esperados.has(id)) for (let i = 0; i < 8; i++) cmp(c, `${id} ${w[1]}`, "fila sobrante en la web", "sin fila", "fila");
  if (filas.length !== fx.filas.length) c.notas.push(`Filas: Power BI ${fx.filas.length}, web ${filas.length}`);
}

function compararResumenFamilia(c, filas, fx) {
  const web = new Map(filas.map((f) => [norm(f[0]), f]));
  const esperados = new Set();
  for (const r of fx.filas) {
    const fam = norm(r["DIM_EQUIPOS.Familia"]);
    esperados.add(fam);
    const w = web.get(fam);
    if (!w) { for (const campo of ["Familia", "MTTR", "MTBF", "Disp %", "Confiab. %", "Prob. Falla"]) cmp(c, fam, campo, "presente", "ausente"); continue; }
    cmp(c, fam, "Familia", fam, w[0]);
    cmp(c, fam, "MTTR (Horas)", horas(r["Metricas (2).MTTR_H"]), w[1], horasPbi(r["Metricas (2).MTTR_H"]));
    cmp(c, fam, "MTBF (Horas)", horas(r["Metricas (2).MTBF_H"]), w[2], horasPbi(r["Metricas (2).MTBF_H"]));
    cmp(c, fam, "Disponibilidad %", pct0(r["Metricas (2).Disp Din %"]), w[3], pct0Pbi(r["Metricas (2).Disp Din %"]));
    cmp(c, fam, "Confiabilidad %", pct2(r["Metricas.Confiabilidad_24h"]), w[4], pct2Pbi(r["Metricas.Confiabilidad_24h"]));
    cmp(c, fam, "Probabilidad de Falla", pct2(r["Metricas.ProbabilidadDeFalla"]), w[5], pct2Pbi(r["Metricas.ProbabilidadDeFalla"]));
  }
  for (const [fam] of web) if (!esperados.has(fam)) for (let i = 0; i < 6; i++) cmp(c, fam, "fila sobrante en la web", "sin fila", "fila");
}

function compararGrafico(c, g, fx) {
  const porNombre = new Map(g.cats.map((k) => [norm(k.nombre), k]));
  const esperados = new Set();
  for (const r of fx.filas) {
    // La web muestra el nombre corto (src/pages/nombresCortos.ts) en el eje del grafico.
    const nombre = norm(nombreEsperado(r["DIM_EQUIPOS.Descripcion"]));
    esperados.add(nombre);
    const cat = porNombre.get(nombre);
    if (!cat) { for (const campo of ["Equipo", "Disp %", "Meta %"]) cmp(c, nombre, campo, "presente", "ausente"); continue; }
    const cerca = (serie) => g.etiquetas.filter((e) => e.serie === serie && Math.abs(e.x - cat.x) < 5).map((e) => e.tx).join("") || "(sin etiqueta)";
    const disp = r["Metricas (2).Disp Din %"];
    const meta = r["Metas2026.Meta_Disp"];
    cmp(c, nombre, "Equipo", nombre, cat.nombre);
    cmp(c, nombre, "Etiqueta Disp %", pct0(disp), cerca("disp"), pct0Pbi(disp));
    cmp(c, nombre, "Etiqueta Meta %", pct0(meta), cerca("meta"), pct0Pbi(meta));
  }
  for (const k of g.cats) if (!esperados.has(norm(k.nombre))) for (let i = 0; i < 3; i++) cmp(c, k.nombre, "columna sobrante en la web", "sin columna", "columna");
}

function compararParos(c, filas, fx) {
  const esp = fx.filas.map((r) => ({
    sap: String(r["DIM_EQUIPOS.IDEQUIPO"]),
    equipo: nombreCorto(r["DIM_EQUIPOS.IDEQUIPO"], r["HECHOS_DATAMES_NPI_PP.DesEquipo"]), // columna Equipo: nombre corto por id
    aviso: String(r["Sum(HECHOS_DATAMES_NPI_PP.Aviso)"]),
    desc: r["HECHOS_DATAMES_NPI_PP.Desc de Paro"],
    ini: fechaHora(r["HECHOS_DATAMES_NPI_PP._F/H Inicio"]),
    fin: fechaHora(r["HECHOS_DATAMES_NPI_PP._F/H Fin"]),
    hrs: horas(r["Metricas (2).Hrs Paro Ventana"]),
    hrsPbi: horasPbi(r["Metricas (2).Hrs Paro Ventana"]),
    resp: r["HECHOS_DATAMES_NPI_PP.Responsable"],
    tipo: r["HECHOS_DATAMES_NPI_PP.Tipo de Paro(PP/NPI)"],
  }));
  const clave = (sap, aviso, ini, fin) => `${sap}|${aviso}|${ini}|${fin}`;
  const web = new Map();
  for (const f of filas) {
    const k = clave(f[0], f[2], f[4], f[5]);
    (web.get(k) ?? web.set(k, []).get(k)).push(f);
  }
  const campos = ["Sap", "Equipo", "Aviso", "Descripción del Paro", "Inicio del Paro", "Fin del Paro", "Hrs de Paro", "Responsable", "Tipo de Paro"];
  for (const e of esp) {
    const k = clave(e.sap, e.aviso, e.ini, e.fin);
    const it = `${e.sap} aviso ${e.aviso} ${e.ini}`;
    const lista = web.get(k);
    const w = lista?.shift();
    if (!w) { for (const campo of campos) cmp(c, it, `fila ausente en la web (${campo})`, "presente", "ausente"); continue; }
    cmp(c, it, campos[0], e.sap, w[0]);
    cmp(c, it, campos[1], e.equipo, w[1]);
    cmp(c, it, campos[2], e.aviso, w[2]);
    cmp(c, it, campos[3], e.desc, w[3]);
    cmp(c, it, campos[4], e.ini, w[4]);
    cmp(c, it, campos[5], e.fin, w[5]);
    cmp(c, it, campos[6], e.hrs, w[6], e.hrsPbi);
    cmp(c, it, campos[7], e.resp, w[7]);
    cmp(c, it, campos[8], e.tipo, w[8]);
  }
  for (const lista of web.values()) for (const w of lista) for (const campo of campos) cmp(c, `${w[0]} aviso ${w[2]} ${w[4]}`, `fila sobrante en la web (${campo})`, "sin fila", "fila");
  if (filas.length !== esp.length) c.notas.push(`Filas: Power BI ${esp.length}, web ${filas.length}`);
}

function compararMensual(c, m, fx) {
  const semanasPbi = [...new Map(fx.filas.map((r) => [r["DIM_TIEMPO.NbSemana_orden"], r["DIM_TIEMPO.NbSemana"]])).entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  semanasPbi.forEach((s, i) => cmp(c, `semana ${i + 1}`, "Etiqueta de semana", s, m.semanas[i] ?? "(ausente)"));
  if (m.semanas.length > semanasPbi.length) for (const s of m.semanas.slice(semanasPbi.length)) cmp(c, s, "semana sobrante en la web", "sin semana", s);
  const porEquipo = new Map();
  for (const r of fx.filas) (porEquipo.get(r["DIM_EQUIPOS.Descripcion"]) ?? porEquipo.set(r["DIM_EQUIPOS.Descripcion"], []).get(r["DIM_EQUIPOS.Descripcion"])).push(r);
  const webPorTitulo = new Map(m.paneles.map((p) => [norm(p.titulo), p]));
  const titulosEsperados = new Set([...porEquipo.keys()].map((d) => norm(nombreEsperado(d))));
  let ocultas = 0;
  let visibles = 0;
  for (const [equipo, filas] of porEquipo) {
    // El titulo del panel es el nombre corto del equipo.
    const tituloEsperado = norm(nombreEsperado(equipo));
    const p = webPorTitulo.get(tituloEsperado);
    if (!p) { cmp(c, equipo, "Panel del equipo", "presente", "ausente"); continue; }
    cmp(c, equipo, "Panel del equipo", tituloEsperado, p.titulo);
    const porSemana = new Map(filas.map((r) => [r["DIM_TIEMPO.NbSemana"], r]));
    // Calibracion del eje Y de los paneles (src/components/PanelesSemanales.tsx): arriba 40, abajo 13, maximo = 1.06 (valores <= 1).
    const altoTrazo = p.alto - 40 - 13;
    const y0 = 40 + altoTrazo;
    const maximo = Math.max(1, ...filas.map((r) => Math.max(r["Metricas (2).Disp Din %"] ?? 0, r["Metas2026.Meta_Disp"] ?? 0))) * 1.06;
    const valorDe = (y) => ((y0 - y) / altoTrazo) * maximo;
    const xs = m.xsSemanas;
    const indice = (x) => { let k = 0; for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[k] - x)) k = i; return k; };
    const bolsa = new Map(); // etiquetas visibles por columna
    for (const e of p.etiquetas) (bolsa.get(indice(e.x)) ?? bolsa.set(indice(e.x), []).get(indice(e.x))).push(e.tx);
    const puntoEn = (serie, i) => p.puntos[serie].find((q) => indice(q.x) === i);
    semanasPbi.forEach((sem, i) => {
      const r = porSemana.get(sem);
      if (!r) return;
      const it = `${equipo} ${sem}`;
      const disp = r["Metricas (2).Disp Din %"];
      const meta = r["Metas2026.Meta_Disp"];
      // Posicion del punto en el SVG convertida a % (con 4 decimales de pixel, resolucion de ~0.0001 %).
      const comoPunto = (pt, esp) => {
        if (!pt) return esp == null ? "(sin punto)" : "(sin punto)";
        const v = valorDe(pt.y) * 100;
        return esp != null && Math.abs(v - esp * 100) < 0.01 ? (esp * 100).toFixed(2) : v.toFixed(2);
      };
      const esperadoPunto = (v) => (v == null ? "(sin punto)" : (v * 100).toFixed(2));
      cmp(c, it, "Punto Disp % (posición en el SVG)", esperadoPunto(disp), comoPunto(puntoEn("disp", i), disp));
      cmp(c, it, "Punto Meta % (posición en el SVG)", esperadoPunto(meta), comoPunto(puntoEn("meta", i), meta));
      const visiblesAqui = bolsa.get(i) ?? [];
      const permitidos = [pct0(disp), pct0(meta)].filter((x) => x !== "");
      const alt = [pct0Pbi(disp), pct0Pbi(meta)];
      for (const tx of visiblesAqui) {
        visibles++;
        const j = permitidos.indexOf(tx);
        if (j >= 0) { permitidos.splice(j, 1); alt.splice(j, 1); cmp(c, it, "Etiqueta visible", tx, tx); }
        else cmp(c, it, "Etiqueta visible (debía ser Disp o Meta)", `${pct0(disp)} o ${pct0(meta)}`, tx);
      }
      ocultas += permitidos.length;
    });
  }
  for (const p of m.paneles) if (!titulosEsperados.has(norm(p.titulo))) cmp(c, p.titulo, "panel sobrante en la web", "sin panel", "panel");
  c.notas.push(`Etiquetas de % visibles: ${visibles}; sin mostrar por solape (hideOverlap): ${ocultas}. Los puntos (Disp y Meta de cada semana) se leen de la geometría del SVG, así que quedan comprobados aunque su etiqueta se oculte.`);
}

// ---------------------------------------------------------------------------------------------
// Ejecucion de la comparacion
// ---------------------------------------------------------------------------------------------
async function comparacion(page, lista) {
  // Agrupa por (pagina, filtros) para fijar los filtros una sola vez por grupo.
  const grupos = new Map();
  for (const x of lista) {
    const k = `${x.pagina}|${JSON.stringify(x.filtros)}`;
    (grupos.get(k) ?? grupos.set(k, []).get(k)).push(x);
  }
  for (const [, xs] of grupos) {
    const { pagina, filtros } = xs[0];
    await irA(page, PAGINAS[pagina].ruta);
    const { ok, estado } = await aplicarFiltros(page, filtros);
    if (!ok) R.notas.push(`No se pudieron fijar los filtros de ${xs.map((x) => x.fixture).join(", ")} en ${pagina}: ${JSON.stringify(estado)}`);
    for (const x of xs) {
      const c = nuevaComparacion(x);
      if (!ok) c.notas.push(`Filtros de la interfaz distintos a los pedidos: ${JSON.stringify(estado)}`);
      try {
        if (x.visual === "resumen_equipo") compararResumenEquipo(c, await leerTabla(page, SEL_TABLA.equipo), x.fx);
        else if (x.visual === "resumen_familia") compararResumenFamilia(c, await leerTabla(page, SEL_TABLA.familia), x.fx);
        else if (x.visual === "grafico") compararGrafico(c, await leerGrafico(page), x.fx);
        else if (x.visual === "tabla") compararParos(c, await leerTabla(page, SEL_TABLA.paros), x.fx);
        else if (x.visual === "mensual") compararMensual(c, await leerMensual(page), x.fx);
      } catch (e) {
        c.diferencias.push({ item: "(lectura)", campo: "error de lectura", powerbi: "-", web: String(e.message).slice(0, 200) });
        c.comparados++;
      }
      R.comparaciones.push(c);
      console.log(`${c.diferencias.length ? "DIF  " : "ok   "} ${x.esc.padEnd(14)} ${x.fixture.padEnd(28)} ${c.iguales}/${c.comparados}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Comprobaciones funcionales
// ---------------------------------------------------------------------------------------------
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function validarDataActualizada(texto) {
  const m = /^Data actualizada: (.+)$/.exec(texto.trim());
  if (!m) return { ok: false, motivo: `no empieza con "Data actualizada:": "${texto}"` };
  const t = m[1];
  const mes = `(${MESES.join("|")})`;
  const fecha = (d, mm, a) => {
    const mi = MESES.indexOf(mm);
    const dt = new Date(Date.UTC(+a, mi, +d));
    return dt.getUTCFullYear() === +a && dt.getUTCMonth() === mi && dt.getUTCDate() === +d ? dt.getTime() : NaN;
  };
  let r;
  let a, b;
  if ((r = new RegExp(`^(\\d{2}) al (\\d{2}) de ${mes} (\\d{4})$`).exec(t))) { a = fecha(r[1], r[3], r[4]); b = fecha(r[2], r[3], r[4]); }
  else if ((r = new RegExp(`^(\\d{2}) de ${mes} al (\\d{2}) de ${mes} (\\d{4})$`).exec(t))) { a = fecha(r[1], r[2], r[5]); b = fecha(r[3], r[4], r[5]); }
  else if ((r = new RegExp(`^(\\d{2}) de ${mes} (\\d{4}) al (\\d{2}) de ${mes} (\\d{4})$`).exec(t))) { a = fecha(r[1], r[2], r[3]); b = fecha(r[4], r[5], r[6]); }
  else if ((r = new RegExp(`^(\\d{2}) de ${mes} (\\d{4})$`).exec(t))) { a = b = fecha(r[1], r[2], r[3]); }
  else return { ok: false, motivo: `formato de rango no reconocido: "${t}"` };
  if (Number.isNaN(a) || Number.isNaN(b)) return { ok: false, motivo: `fecha inexistente en "${t}"` };
  if (a > b) return { ok: false, motivo: `rango invertido en "${t}"` };
  return { ok: true, rango: t };
}

const esNoDecreciente = (xs) => xs.every((x, i) => i === 0 || xs[i - 1] >= x);

async function funcionales(browser, contexto, page) {
  const SIN_CARGAR = "Cargar datos";

  // F-Portada: texto del rango de datos y botones.
  await irA(page, "#/");
  // Mientras llegan los datos la Portada dice "sin datos cargados": se espera al texto definitivo (hasta 5 min).
  const tPortada = Date.now();
  let fechaTxt = await page.locator(".portada-fecha").innerText();
  const primeraLectura = fechaTxt;
  while (/sin datos cargados/.test(fechaTxt) && Date.now() - tPortada < T_CARGA) {
    await page.waitForTimeout(300);
    fechaTxt = await page.locator(".portada-fecha").innerText();
  }
  const msPortada = Date.now() - tPortada;
  if (primeraLectura !== fechaTxt) R.notas.push(`Portada: al abrir la web mostró "${primeraLectura}" y el texto definitivo apareció a los ${(msPortada / 1000).toFixed(1)} s.`);
  const v = validarDataActualizada(fechaTxt);
  funcional("F04", "Portada: 'Data actualizada:' seguido de un rango de fechas válido", v.ok, v.ok ? `${fechaTxt}${primeraLectura !== fechaTxt ? ` (la primera lectura fue "${primeraLectura}"; el texto definitivo llegó a los ${(msPortada / 1000).toFixed(1)} s)` : ""}` : v.motivo);
  const rutas = { "DISP SIMBA": "#/simba", "DISP JUMBO": "#/jumbo", "DISP SOSTENIMIENTO": "#/sostenimiento", "DISP SCOOTRAM ST3.5": "#/st35", "DISP SCOOTRAM ST1030": "#/st1030", "RESUMEN DISP.": "#/resumen", "DISP MENSUAL": "#/mensual" };
  const malos = [];
  for (const [texto, ruta] of Object.entries(rutas)) {
    await page.evaluate(() => { location.hash = "#/"; });
    await page.locator(".portada-boton", { hasText: texto }).click();
    await page.waitForTimeout(250);
    const h = await page.evaluate(() => location.hash);
    if (h !== ruta) malos.push(`${texto} -> ${h}`);
  }
  funcional("F04b", "Portada: los 7 botones llevan a su página", malos.length === 0, malos.join("; "));

  // Periodo inicial coherente entre Portada y Resumen (primera carga, sin tocar filtros).
  await irA(page, "#/resumen");
  const ini = await estadoFiltros(page);
  R.periodoInicial = { desde: ini.desde, hasta: ini.hasta, portada: fechaTxt };
  const mensualIni = await (async () => { await irA(page, "#/mensual"); return estadoFiltros(page); })();
  R.periodoInicial.mensual = { desde: mensualIni.desde, hasta: mensualIni.hasta };

  // Capturas a 1600x900 con los filtros iniciales (antes de que las pruebas los muevan).
  fs.mkdirSync(CAPTURAS, { recursive: true });
  for (const [clave, pg] of [["portada", { ruta: "#/" }], ...Object.entries(PAGINAS)]) {
    await irA(page, pg.ruta);
    await page.screenshot({ path: path.join(CAPTURAS, `${clave}_1600x900.png`) });
  }

  // F01: filtros encadenados. Se cambian en Simba y se navega con los enlaces de la propia app (Portada -> botón).
  await irA(page, "#/simba");
  const cambio = { desde: "2026-10-01", hasta: "2026-10-31", hDisp: 18, tConf: null, disp: ["Operacional"], familia: null };
  const ap = await aplicarFiltros(page, cambio);
  const alcanzar = async (texto) => {
    await page.locator("a.lienzo-volver").click();
    await page.locator(".portada-boton", { hasText: texto }).click();
    await page.waitForSelector(".tabla-pbi tbody tr td, .panel-sem-lienzo svg", { timeout: T_CARGA });
    await esperarEstable(page);
  };
  const conservan = [];
  const leidos = {};
  for (const [texto, clave] of [["DISP JUMBO", "jumbo"], ["DISP SOSTENIMIENTO", "sostenimiento"], ["DISP SCOOTRAM ST3.5", "st35"], ["DISP SCOOTRAM ST1030", "st1030"], ["RESUMEN DISP.", "resumen"]]) {
    await alcanzar(texto);
    const e = await estadoFiltros(page);
    leidos[clave] = e;
    const bien = e.desde === cambio.desde && e.hasta === cambio.hasta && e.hDisp === "18 hrs" && JSON.stringify(e.disp) === JSON.stringify(["Operacional"]);
    if (!bien) conservan.push(`${clave}: ${JSON.stringify(e)}`);
  }
  funcional("F01a", "Filtros encadenados: período, Var t: Disp y DISP de Simba se conservan en Jumbo, Sostenimiento, ST3.5, ST1030 y Resumen", ap.ok && conservan.length === 0, ap.ok ? conservan.join(" | ") : `no se pudieron fijar en Simba: ${JSON.stringify(ap.estado)}`);

  // Los datos de esas páginas también usan el filtro: la disponibilidad de Resumen (por equipo) debe igualar la etiqueta del gráfico de cada página.
  const resumen = await leerTabla(page, SEL_TABLA.equipo);
  // Los graficos muestran el nombre corto y Resumen el completo: se une por id (col. 0 de Resumen).
  const dispResumen = new Map(resumen.map((f) => [norm(nombreCorto(f[0], f[1])), f[5]]));
  const incoherentes = [];
  for (const clave of ["simba", "jumbo", "sostenimiento", "st35", "st1030"]) {
    await irA(page, PAGINAS[clave].ruta);
    const g = await leerGrafico(page);
    for (const k of g.cats) {
      const et = g.etiquetas.filter((e) => e.serie === "disp" && Math.abs(e.x - k.x) < 5).map((e) => e.tx).join("");
      if (dispResumen.get(norm(k.nombre)) !== et) incoherentes.push(`${clave} ${k.nombre}: gráfico ${et}, Resumen ${dispResumen.get(norm(k.nombre))}`);
    }
  }
  funcional("F01b", "Con los filtros cambiados, Disp % de cada gráfico de familia coincide con la de Resumen", incoherentes.length === 0, incoherentes.join(" | "));

  // Var t: Conf. (solo en Resumen) también se conserva al salir y volver.
  await irA(page, "#/resumen");
  await page.getByRole("radiogroup", { name: "Var t: Conf." }).getByRole("radio", { name: "12 hrs", exact: true }).click();
  await esperarEstable(page);
  await irA(page, "#/jumbo");
  await irA(page, "#/resumen");
  const conf = (await estadoFiltros(page)).tConf;
  funcional("F01c", "Var t: Conf. de Resumen se conserva al salir y volver", conf === "12 hrs", `Var t: Conf. = ${conf}`);

  // Disp Mensual: período propio. No hereda el general; el suyo no cambia el general; Var t: Disp y DISP sí son compartidos.
  await irA(page, "#/mensual");
  const m1 = await estadoFiltros(page);
  const periodoMensualPrevio = { desde: m1.desde, hasta: m1.hasta };
  funcional("F01d", "Disp Mensual no hereda el período general (Oct 2026 en Simba)", m1.desde === R.periodoInicial.mensual.desde && m1.hasta === R.periodoInicial.mensual.hasta && !(m1.desde === cambio.desde && m1.hasta === cambio.hasta), `Mensual muestra ${m1.desde} a ${m1.hasta}; inicial ${R.periodoInicial.mensual.desde} a ${R.periodoInicial.mensual.hasta}`);
  funcional("F01e", "Disp Mensual comparte Var t: Disp y DISP con el resto (18 hrs y Operacional)", m1.hDisp === "18 hrs" && JSON.stringify(m1.disp) === JSON.stringify(["Operacional"]), `Var t: Disp ${m1.hDisp}, DISP ${JSON.stringify(m1.disp)}`);
  await fijarPeriodo(page, "2026-08-03", "2026-11-09");
  await esperarEstable(page);
  await irA(page, "#/simba");
  const s1 = await estadoFiltros(page);
  funcional("F01f", "Cambiar el período de Disp Mensual no cambia el período general", s1.desde === cambio.desde && s1.hasta === cambio.hasta, `Simba muestra ${s1.desde} a ${s1.hasta}`);
  await fijarPeriodo(page, "2026-09-07", "2026-09-27");
  await esperarEstable(page);
  await irA(page, "#/mensual");
  const m2 = await estadoFiltros(page);
  funcional("F01g", "Disp Mensual conserva su período al cambiar el general y volver", m2.desde === "2026-08-03" && m2.hasta === "2026-11-09", `Mensual muestra ${m2.desde} a ${m2.hasta} (previo ${periodoMensualPrevio.desde} a ${periodoMensualPrevio.hasta})`);

  // F02: filtro cruzado en Simba (con los filtros por defecto del reporte).
  await irA(page, "#/simba");
  await aplicarFiltros(page, { desde: "2026-11-01", hasta: "2026-11-20", hDisp: 24, tConf: null, disp: ["Mecánica"], familia: null });
  const todas = await leerTabla(page, SEL_TABLA.paros);
  const g = await leerGrafico(page);
  const equipos = [...new Set(todas.map((f) => f[1]))];
  const detalleCruzado = [];
  let cruzadoOk = true;
  const barras = () => page.evaluate(() => [...document.querySelectorAll('.graf-lienzo svg path')].filter((p) => ["#F89221", "#00493C"].includes((p.getAttribute("fill") || "").toUpperCase())).map((p) => { const r = p.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.7 }; }).sort((a, b) => a.x - b.x));
  const bs = await barras();
  if (bs.length !== g.cats.length) { cruzadoOk = false; detalleCruzado.push(`barras ${bs.length} y categorías ${g.cats.length}`); }
  const objetivo = 1; // segunda columna
  const nombreObjetivo = g.cats[objetivo]?.nombre;
  const esperadas = todas.filter((f) => norm(f[1]) === norm(nombreObjetivo)).length;
  await page.mouse.click(bs[objetivo].x, bs[objetivo].y);
  await esperarEstable(page, 500);
  const filtradas = await leerTabla(page, SEL_TABLA.paros);
  const soloEse = filtradas.length > 0 && filtradas.every((f) => norm(f[1]) === norm(nombreObjetivo));
  if (!soloEse || filtradas.length !== esperadas) { cruzadoOk = false; detalleCruzado.push(`tras el primer clic: ${filtradas.length} filas (equipos: ${[...new Set(filtradas.map((f) => f[1]))].join(", ")}); se esperaban ${esperadas} de "${nombreObjetivo}"`); }
  const opac = await page.evaluate(() => [...document.querySelectorAll('.graf-lienzo svg path')].filter((p) => ["#F89221", "#00493C"].includes((p.getAttribute("fill") || "").toUpperCase())).map((p) => p.getAttribute("fill-opacity") ?? p.getAttribute("opacity")));
  detalleCruzado.push(`opacidad de las columnas tras el clic: ${JSON.stringify(opac)}`);
  await page.mouse.click(bs[objetivo].x, bs[objetivo].y);
  await esperarEstable(page, 500);
  const sueltas = await leerTabla(page, SEL_TABLA.paros);
  if (sueltas.length !== todas.length) { cruzadoOk = false; detalleCruzado.push(`tras el segundo clic: ${sueltas.length} filas; se esperaban ${todas.length}`); }
  funcional("F02", "Filtro cruzado: clic en una columna de Simba deja solo ese equipo en la tabla de paros; el segundo clic lo suelta", cruzadoOk, `${detalleCruzado.join(" | ")} (equipos con paros: ${equipos.length}; filas totales ${todas.length})`);

  // F03: orden de la tabla de paros.
  const horasDe = (filas) => filas.map((f) => parseFloat(f[6]));
  const ordenIni = horasDe(todas);
  const ariaIni = await page.locator(".tabla-paros th", { hasText: "Hrs de Paro" }).getAttribute("aria-sort");
  funcional("F03a", "Tabla de paros ordenada de mayor a menor Hrs Paro Ventana al abrir", esNoDecreciente(ordenIni) && ariaIni === "descending", `${todas.length} filas, primera ${ordenIni[0]}, última ${ordenIni.at(-1)}, aria-sort ${ariaIni}`);
  const cabecera = (t) => page.locator(".tabla-paros th button", { hasText: t });
  await cabecera("Hrs de Paro").click();
  await esperarEstable(page, 400);
  const asc = horasDe(await leerTabla(page, SEL_TABLA.paros));
  funcional("F03b", "Clic en la cabecera Hrs de Paro la pasa a ascendente", esNoDecreciente([...asc].reverse()) && asc[0] <= asc.at(-1), `primera ${asc[0]}, última ${asc.at(-1)}`);
  await cabecera("Equipo").click();
  await esperarEstable(page, 400);
  const porEquipo = (await leerTabla(page, SEL_TABLA.paros)).map((f) => f[1]);
  const col = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
  const ordenado = porEquipo.every((x, i) => i === 0 || col.compare(porEquipo[i - 1], x) <= 0);
  funcional("F03c", "Clic en la cabecera Equipo ordena la tabla por equipo (ascendente)", ordenado, `primero "${porEquipo[0]}", último "${porEquipo.at(-1)}"`);
  await cabecera("Equipo").click();
  await esperarEstable(page, 400);
  const desc = (await leerTabla(page, SEL_TABLA.paros)).map((f) => f[1]);
  funcional("F03d", "Segundo clic en Equipo invierte el orden (descendente)", desc.every((x, i) => i === 0 || col.compare(desc[i - 1], x) >= 0) && desc[0] !== porEquipo[0], `primero "${desc[0]}", último "${desc.at(-1)}"`);
  await cabecera("Sap").click();
  await esperarEstable(page, 400);
  const sap = (await leerTabla(page, SEL_TABLA.paros)).map((f) => Number(f[0]));
  funcional("F03e", "Clic en la cabecera Sap ordena numéricamente (ascendente)", sap.every((x, i) => i === 0 || sap[i - 1] <= x), `primero ${sap[0]}, último ${sap.at(-1)}`);

  // F05: sin scroll vertical del documento.
  for (const [w, h] of [[1600, 900], [1366, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    const falla = [];
    for (const [clave, p] of [["portada", { ruta: "#/" }], ...Object.entries(PAGINAS)]) {
      await irA(page, p.ruta);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => ({ alto: document.documentElement.scrollHeight, ventana: innerHeight, ancho: document.documentElement.scrollWidth, anchoVentana: innerWidth, bodyAlto: document.body.scrollHeight }));
      if (m.alto > m.ventana || m.ancho > m.anchoVentana) falla.push(`${clave}: documento ${m.ancho}x${m.alto} en ventana ${m.anchoVentana}x${m.ventana}`);
    }
    funcional(`F05_${w}`, `Las 8 páginas sin scroll de documento a ${w}x${h}`, falla.length === 0, falla.join(" | "));
  }
  await page.setViewportSize(VENTANA);

  // F05c: el pie con los enlaces de sesión cabe dentro de la ventana (a 1600x900 se ve cortado en la captura de Resumen).
  const fuera = new Map();
  for (const [w, h] of [[1600, 900], [1366, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const [clave, p] of [["portada", { ruta: "#/" }], ...Object.entries(PAGINAS)]) {
      await irA(page, p.ruta);
      const cajas = await page.evaluate(() => [...document.querySelectorAll(".lienzo-pie a, .lienzo-pie button, .portada-enlaces a, .portada-enlaces button")].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), der: Math.round(r.right), izq: Math.round(r.left), ancho: innerWidth }; }));
      for (const c of cajas) {
        if (c.der <= c.ancho && c.izq >= 0) continue;
        const k = `${w}x${h}: "${c.t}" termina en x=${c.der} (la ventana mide ${c.ancho}); páginas`;
        (fuera.get(k) ?? fuera.set(k, []).get(k)).push(clave);
      }
    }
  }
  await page.setViewportSize(VENTANA);
  funcional("F05c", "Enlaces del pie (Exportar PDF, Ingresar) completos dentro de la ventana", fuera.size === 0, [...fuera].map(([k, v]) => `${k} ${v.join(", ")}`).join(" | "));

  // F08: invitado.
  const visibles = [];
  for (const [clave, p] of [["portada", { ruta: "#/" }], ...Object.entries(PAGINAS)]) {
    await irA(page, p.ruta);
    const n = await page.getByText(SIN_CARGAR).count();
    const enlaces = await page.locator('a[href="#/cargar"]').count();
    if (n || enlaces) visibles.push(clave);
  }
  const ingresar = await page.getByRole("link", { name: "Ingresar" }).count();
  funcional("F08a", "Un invitado no ve 'Cargar datos' en ninguna página", visibles.length === 0, visibles.join(", ") || `enlace "Ingresar" presente: ${ingresar > 0}`);
  await page.evaluate(() => { location.hash = "#/cargar"; });
  let destino = "";
  try {
    await page.waitForFunction(() => location.hash === "#/login", null, { timeout: 30_000 });
    destino = "#/login";
  } catch { destino = await page.evaluate(() => location.hash); }
  const hayForm = await page.locator('input[type="email"]').count();
  funcional("F08b", "#/cargar manda a #/login a un invitado", destino === "#/login" && hayForm > 0, `destino ${destino}, formulario de ingreso: ${hayForm > 0}`);
}

// ---------------------------------------------------------------------------------------------
// Comprobaciones de la version con navegador de paginas, nombres cortos, tabla de paros de anchos fijos,
// cabeceras alineadas, PDF sin barras y Portada contra la configuracion guardada (F10 a F18)
// ---------------------------------------------------------------------------------------------
const FAMILIAS = ["simba", "jumbo", "sostenimiento", "st35", "st1030"];
const TODAS_LAS_PAGINAS = ORDEN_PAGINAS.map((p) => ({ clave: p.ruta === "/" ? "portada" : p.ruta.slice(1), ruta: `#${p.ruta}`, titulo: p.titulo }));
const TOL_ALINEACION = 1.5; // px en coordenadas de lienzo (1280x720)
let TMP = null;
const dirTemporal = () => (TMP ??= fs.mkdtempSync(path.join(os.tmpdir(), "e2e-dimelco-")));

/** Corre un bloque que registra sus propias comprobaciones; si lanza una excepcion registra una falla con el id del bloque. */
async function bloque(id, nombre, fn) {
  try {
    await fn();
  } catch (e) {
    funcional(id, nombre, false, `Excepcion durante la prueba: ${String(e.message).split("\n")[0].slice(0, 300)}`);
  }
}

/** Corre una comprobacion; si lanza una excepcion la registra como falla con el mensaje (error de la prueba o de carga). */
async function seguro(id, nombre, fn) {
  try {
    const r = await fn();
    funcional(id, nombre, r.ok, r.detalle);
  } catch (e) {
    funcional(id, nombre, false, `Excepcion durante la prueba: ${String(e.message).split("\n")[0].slice(0, 300)}`);
  }
}

const estadoNav = (page) =>
  page.evaluate(() => {
    const n = document.querySelector('nav[aria-label="Navegador de páginas"]');
    if (!n) return null;
    const [ant, sig] = [...n.querySelectorAll("button")];
    return {
      hash: location.hash,
      texto: (n.querySelector(".nav-paginas-texto")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      antDeshabilitado: ant.disabled,
      sigDeshabilitado: sig.disabled,
      etiquetas: [ant.getAttribute("aria-label"), sig.getAttribute("aria-label")],
    };
  });

async function pulsarNav(page, sentido, rutaEsperada) {
  await page.getByRole("button", { name: sentido === "sig" ? "Página siguiente" : "Página anterior", exact: true }).click();
  await esperarPagina(page, rutaEsperada);
}

/** Pone en la interfaz el periodo completo de los datos (limites de los input de fecha). */
async function periodoCompleto(page) {
  const r = await page.evaluate(() => ({ min: document.querySelector('input[aria-label="Desde"]').min, max: document.querySelector('input[aria-label="Hasta"]').max }));
  await fijarPeriodo(page, r.min, r.max);
  await esperarEstable(page);
  return r;
}

const opcionesFamilia = (page) =>
  page.evaluate(() => {
    const s = [...document.querySelectorAll("section.seg")].find((x) => x.querySelector("h3")?.textContent.trim() === "Familia");
    return s ? [...s.querySelectorAll("label.seg-item")].map((l) => ({ texto: l.textContent.trim(), marcada: Boolean(l.querySelector("input")?.checked) })) : [];
  });

// Lectura de geometria en coordenadas de lienzo (1280x720): se descuenta la posicion y la escala del lienzo.
const GEOMETRIA = `
  const L = document.querySelector(".lienzo").getBoundingClientRect();
  const s = L.width / 1280;
  const rel = (r) => ({ l: (r.left - L.left) / s, t: (r.top - L.top) / s, r: (r.right - L.left) / s, b: (r.bottom - L.top) / s });
  const texto = (el) => { const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect(); };
`;

// F10 ---------------------------------------------------------------------------------------------
async function f10(page) {
  const rutas = TODAS_LAS_PAGINAS.map((p) => p.ruta);
  const n = rutas.length;
  const fallos = [];
  await irA(page, "#/");
  await page.evaluate(() => { window.__sinRecarga = true; });
  const revisar = async (i, tramo) => {
    const e = await estadoNav(page);
    const ok = e && e.hash === rutas[i] && e.texto === `${i + 1} de ${n}` && e.antDeshabilitado === (i === 0) && e.sigDeshabilitado === (i === n - 1) && e.etiquetas[0] === "Página anterior" && e.etiquetas[1] === "Página siguiente";
    if (!ok) fallos.push(`${tramo}, página ${i + 1}: esperado {${rutas[i]}, "${i + 1} de ${n}", anterior ${i === 0 ? "deshabilitado" : "habilitado"}, siguiente ${i === n - 1 ? "deshabilitado" : "habilitado"}}, obtenido ${JSON.stringify(e)}`);
  };
  await revisar(0, "ida");
  for (let i = 0; i < n - 1; i++) { await pulsarNav(page, "sig", rutas[i + 1]); await revisar(i + 1, "ida"); }
  for (let i = n - 1; i > 0; i--) { await pulsarNav(page, "ant", rutas[i - 1]); await revisar(i - 1, "vuelta"); }
  const sinRecarga = await page.evaluate(() => window.__sinRecarga === true);
  if (!sinRecarga) fallos.push("el recorrido recargó la página (se perdió el estado de la sesión)");
  return { ok: fallos.length === 0 && n === 8, detalle: fallos.length ? fallos.join(" | ") : `${n} páginas, ida con "›" y vuelta con "‹": ${rutas.join(" > ")}; textos "1 de 8" a "8 de 8"; "‹" deshabilitado en la primera y "›" en la última; sin recargar` };
}

// F11 ---------------------------------------------------------------------------------------------
async function f11(page) {
  const fallos = [];
  const general = { desde: "2026-10-05", hasta: "2026-10-25", hDisp: 18, tConf: null, disp: ["Operacional"], familia: null };
  const generalOk = (e) => e.desde === general.desde && e.hasta === general.hasta && e.hDisp === "18 hrs" && JSON.stringify(e.disp) === JSON.stringify(["Operacional"]);
  const mensual = { desde: "2026-07-06", hasta: "2026-10-04" };
  const rutas = TODAS_LAS_PAGINAS.map((p) => p.ruta);
  const idx = (clave) => TODAS_LAS_PAGINAS.findIndex((p) => p.clave === clave);
  const revisarGeneral = async (clave, nota = "") => {
    const e = await estadoFiltros(page);
    if (!generalOk(e)) fallos.push(`${clave}${nota}: ${JSON.stringify({ desde: e.desde, hasta: e.hasta, hDisp: e.hDisp, disp: e.disp })}`);
    return e;
  };

  await irA(page, "#/simba");
  const ap = await aplicarFiltros(page, general);
  if (!ap.ok) throw new Error(`no se pudieron fijar los filtros en Simba: ${JSON.stringify(ap.estado)}`);
  // Simba -> Jumbo -> Sostenimiento -> ST3.5 -> ST1030 -> Resumen con el boton "›".
  for (let i = idx("simba"); i < idx("resumen"); i++) { await pulsarNav(page, "sig", rutas[i + 1]); await revisarGeneral(TODAS_LAS_PAGINAS[i + 1].clave, " (con ›)"); }
  // Var t: Conf. es solo de Resumen: se cambia y se comprueba al salir y volver con el navegador.
  const tConfInicial = (await estadoFiltros(page)).tConf;
  await page.getByRole("radiogroup", { name: "Var t: Conf." }).getByRole("radio", { name: "24 hrs", exact: true }).click();
  await esperarEstable(page);
  // Resumen -> Mensual.
  await pulsarNav(page, "sig", "#/mensual");
  const mIni = await estadoFiltros(page);
  if (mIni.hDisp !== "18 hrs" || JSON.stringify(mIni.disp) !== JSON.stringify(["Operacional"])) fallos.push(`mensual no conservó Var t: Disp y DISP: ${JSON.stringify({ hDisp: mIni.hDisp, disp: mIni.disp })}`);
  if (mIni.desde === general.desde && mIni.hasta === general.hasta) fallos.push(`mensual heredó el período general (${mIni.desde} a ${mIni.hasta})`);
  // Lo propio de Mensual: su período y su familia.
  const fams = await opcionesFamilia(page);
  const famInicial = fams.find((f) => f.marcada)?.texto ?? null;
  const famNueva = fams.find((f) => !f.marcada)?.texto ?? null;
  await fijarPeriodo(page, mensual.desde, mensual.hasta);
  if (famNueva) await seccion(page, "Familia").getByLabel(famNueva, { exact: true }).check();
  await esperarEstable(page);
  const mProp = await estadoFiltros(page);
  if (mProp.desde !== mensual.desde || mProp.hasta !== mensual.hasta || (famNueva && mProp.familia !== famNueva)) fallos.push(`mensual no tomó lo suyo: ${JSON.stringify({ desde: mProp.desde, hasta: mProp.hasta, familia: mProp.familia })}`);
  // Mensual -> Resumen: el período general sigue igual y Var t: Conf. se conservó.
  await pulsarNav(page, "ant", "#/resumen");
  const eRes = await revisarGeneral("resumen", " (tras visitar Mensual con otro período)");
  if (eRes.tConf !== "24 hrs") fallos.push(`resumen: Var t: Conf. = ${eRes.tConf} (se esperaba 24 hrs)`);
  // Resumen -> Mensual: conserva lo suyo.
  await pulsarNav(page, "sig", "#/mensual");
  const mVuelta = await estadoFiltros(page);
  if (mVuelta.desde !== mensual.desde || mVuelta.hasta !== mensual.hasta || (famNueva && mVuelta.familia !== famNueva)) fallos.push(`mensual al volver: ${JSON.stringify({ desde: mVuelta.desde, hasta: mVuelta.hasta, familia: mVuelta.familia })}`);
  // Mensual -> ... -> Simba con "‹": el general no cambió en ninguna.
  for (let i = idx("mensual"); i > idx("simba"); i--) { await pulsarNav(page, "ant", rutas[i - 1]); if (i - 1 !== idx("mensual")) await revisarGeneral(TODAS_LAS_PAGINAS[i - 1].clave, " (con ‹)"); }
  // Un paso mas atras y adelante por la Portada no pierde nada.
  await pulsarNav(page, "ant", "#/");
  await pulsarNav(page, "sig", "#/simba");
  await revisarGeneral("simba", " (tras pasar por Portada)");
  // Se deja Var t: Conf. como estaba.
  if (tConfInicial && tConfInicial !== "24 hrs") { await irA(page, "#/resumen"); await page.getByRole("radiogroup", { name: "Var t: Conf." }).getByRole("radio", { name: tConfInicial, exact: true }).click(); await esperarEstable(page); }
  // Se deja la familia de Mensual como estaba.
  if (famNueva && famInicial) { await irA(page, "#/mensual"); await seccion(page, "Familia").getByLabel(famInicial, { exact: true }).check(); await esperarEstable(page); }
  return { ok: fallos.length === 0, detalle: fallos.length ? fallos.join(" | ") : `general ${general.desde} a ${general.hasta}, 18 hrs, Operacional puesto en Simba y conservado en Jumbo, Sostenimiento, ST3.5, ST1030, Resumen y Mensual (ida y vuelta con el navegador); Var t: Conf. 24 hrs de Resumen conservado; Mensual con lo suyo (${mensual.desde} a ${mensual.hasta}, familia "${famNueva}") sin tocar el general y conservado al volver` };
}

// F12 ---------------------------------------------------------------------------------------------
async function f12(page) {
  const fallos = [];
  const soltarFoco = () => page.evaluate(() => document.activeElement?.blur?.());
  const hash = () => page.evaluate(() => location.hash);
  const pulsar = async (k, ruta) => {
    await soltarFoco();
    await page.keyboard.press(k);
    await esperarPagina(page, ruta);
    const h = await hash();
    if (h !== ruta) fallos.push(`${k}: la ruta quedó en ${h} y se esperaba ${ruta}`);
    const e = await estadoNav(page);
    const i = TODAS_LAS_PAGINAS.findIndex((p) => p.ruta === ruta);
    if (!e || e.texto !== `${i + 1} de 8`) fallos.push(`${k}: texto del navegador "${e?.texto}" y se esperaba "${i + 1} de 8"`);
  };
  const sinCambio = async (descripcion, accion) => {
    await soltarFoco();
    const antes = await hash();
    await accion();
    await page.waitForTimeout(600);
    const despues = await hash();
    if (antes !== despues) fallos.push(`${descripcion}: la ruta pasó de ${antes} a ${despues}`);
  };
  await irA(page, "#/simba");
  await pulsar("ArrowRight", "#/jumbo");
  await pulsar("ArrowRight", "#/sostenimiento");
  await pulsar("ArrowLeft", "#/jumbo");
  await pulsar("ArrowLeft", "#/simba");
  await irA(page, "#/");
  await sinCambio("ArrowLeft en la primera página", () => page.keyboard.press("ArrowLeft"));
  await sinCambio("Ctrl+ArrowRight", () => page.keyboard.press("Control+ArrowRight"));
  await sinCambio("Shift+ArrowRight", () => page.keyboard.press("Shift+ArrowRight"));
  await pulsar("ArrowRight", "#/simba");
  const desde0 = await page.locator('input[aria-label="Desde"]').inputValue();
  await sinCambio("ArrowRight con el foco en el campo de fecha Desde", async () => {
    await page.locator('input[aria-label="Desde"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
  });
  const desde1 = await page.locator('input[aria-label="Desde"]').inputValue();
  if (desde0 !== desde1) fallos.push(`las flechas con el foco en la fecha cambiaron su valor (${desde0} a ${desde1})`);
  await irA(page, "#/mensual");
  await sinCambio("ArrowRight en la última página", () => page.keyboard.press("ArrowRight"));
  await pulsar("ArrowLeft", "#/resumen");
  return { ok: fallos.length === 0, detalle: fallos.length ? fallos.join(" | ") : "ArrowRight y ArrowLeft cambian de página; no hacen nada en los extremos, con Ctrl o Shift, ni con el foco en un campo de fecha" };
}

// F13 ---------------------------------------------------------------------------------------------
async function medirSolapes(page) {
  return page.evaluate((GEO) => {
    const f = new Function(`${GEO}
      const nav = document.querySelector('nav.nav-paginas');
      if (!nav) return { presente: false };
      const cs = getComputedStyle(nav);
      const n = rel(nav.getBoundingClientRect());
      const caja = nav.closest('.lienzo');
      const obst = [];
      const poner = (nombre, r) => { if (r.width > 0 && r.height > 0) obst.push({ nombre, ...rel(r) }); };
      document.querySelectorAll('.lienzo-pie p, .portada-fecha').forEach((e) => poner('texto del pie', texto(e)));
      document.querySelectorAll('.lienzo-enlaces a, .lienzo-enlaces button, .portada-enlaces a, .portada-enlaces button').forEach((e) => poner('enlace "' + e.textContent.trim() + '"', e.getBoundingClientRect()));
      const cajas = { '.tabla-pbi': 'tabla', '.graf-familia': 'gráfico', '.graf-lienzo': 'gráfico (lienzo)', '.paneles': 'paneles de Mensual', '.paneles-rejilla': 'rejilla de paneles de Mensual', '.paneles-ejes': 'ejes de Mensual', 'section.seg': 'segmentador', '.chip': 'leyenda', '.portada-boton': 'botón de Portada', '.portada-h1': 'título de Portada' };
      for (const [sel, nombre] of Object.entries(cajas)) document.querySelectorAll(sel).forEach((e) => poner(nombre, e.getBoundingClientRect()));
      const solapes = obst.filter((o) => n.l < o.r - 0.5 && n.r > o.l + 0.5 && n.t < o.b - 0.5 && n.b > o.t + 0.5).map((o) => o.nombre + ' (x ' + o.l.toFixed(0) + '-' + o.r.toFixed(0) + ', y ' + o.t.toFixed(0) + '-' + o.b.toFixed(0) + ')');
      return { presente: true, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && n.r > n.l, dentroDelLienzo: Boolean(caja), n, centradoX: (n.l + n.r) / 2, solapes };`);
    return f();
  }, GEOMETRIA);
}

async function f13(page, ancho, alto) {
  await page.setViewportSize({ width: ancho, height: alto });
  const fallos = [];
  const filas = [];
  for (const p of TODAS_LAS_PAGINAS) {
    await irA(page, p.ruta);
    const m = await medirSolapes(page);
    if (!m.presente) { fallos.push(`${p.clave}: no hay navegador`); continue; }
    filas.push(`${p.clave} y ${m.n.t.toFixed(0)}-${m.n.b.toFixed(0)}`);
    if (!m.visible) fallos.push(`${p.clave}: navegador no visible`);
    if (!m.dentroDelLienzo || m.n.l < 0 || m.n.r > 1280 || m.n.t < 0 || m.n.b > 720) fallos.push(`${p.clave}: fuera del lienzo (x ${m.n.l.toFixed(1)}-${m.n.r.toFixed(1)}, y ${m.n.t.toFixed(1)}-${m.n.b.toFixed(1)})`);
    if (Math.abs(m.centradoX - 640) > 2) fallos.push(`${p.clave}: no está centrado (centro x ${m.centradoX.toFixed(1)}, lienzo 640)`);
    if (m.n.b < 640) fallos.push(`${p.clave}: no está abajo (y ${m.n.t.toFixed(1)})`);
    if (m.solapes.length) fallos.push(`${p.clave}: se solapa con ${m.solapes.join("; ")}`);
  }
  await page.setViewportSize(VENTANA);
  return { ok: fallos.length === 0, detalle: fallos.length ? fallos.join(" | ") : `8 páginas a ${ancho}x${alto}: navegador centrado (x 560-720 del lienzo), abajo, dentro del lienzo y sin cruzarse con el texto del pie, los enlaces, tablas, gráficos ni segmentadores (${filas.join("; ")})` };
}

// F14 ---------------------------------------------------------------------------------------------
async function f14(page) {
  // Estado de partida: todo el periodo de los datos, 24 hrs, Mecanica y Operacional (la mayor cantidad de paros).
  await irA(page, "#/simba");
  const rango = await periodoCompleto(page);
  await aplicarFiltros(page, { desde: rango.min, hasta: rango.max, hDisp: 24, tConf: null, disp: ["Mecánica", "Operacional"], familia: null });
  // Mapa id -> nombre completo, de la propia tabla de Resumen (que trae id y denominacion completa).
  await irA(page, "#/resumen");
  const filasResumen = await leerTabla(page, SEL_TABLA.equipo);
  const completos = new Map(filasResumen.map((f) => [f[0], norm(f[1])]));
  const cortosEsperados = new Set(filasResumen.map((f) => norm(nombreCorto(f[0], f[1]))));
  const dif = (a, b) => [...a].filter((x) => !b.has(x));

  // F14a: los 5 graficos muestran solo nombres cortos y entre todos cubren los 18 equipos.
  const usadosGraf = new Set();
  const falloG = [];
  const porPagina = [];
  for (const clave of FAMILIAS) {
    await irA(page, PAGINAS[clave].ruta);
    const g = await leerGrafico(page);
    const nombres = g.cats.map((k) => norm(k.nombre));
    nombres.forEach((x) => usadosGraf.add(x));
    porPagina.push(`${clave}: ${nombres.join(" / ")}`);
    const malos = nombres.filter((x) => !cortosEsperados.has(x));
    if (malos.length) falloG.push(`${clave}: no son nombres cortos: ${malos.join(", ")}`);
    if (nombres.length === 0) falloG.push(`${clave}: sin columnas`);
  }
  const faltan = dif(cortosEsperados, usadosGraf);
  if (faltan.length) falloG.push(`equipos sin columna en ningún gráfico: ${faltan.join(", ")}`);
  funcional("F14a", "Nombres cortos en el eje de los 5 gráficos de familia (los 18 equipos, ninguno con nombre completo)", falloG.length === 0 && cortosEsperados.size === 18, falloG.length ? falloG.join(" | ") : `${usadosGraf.size} nombres: ${porPagina.join(" | ")}`);

  // F14b: columna Equipo de las tablas de paros = nombre corto del Sap de la fila.
  const falloT = [];
  const resumenT = [];
  for (const clave of FAMILIAS) {
    await irA(page, PAGINAS[clave].ruta);
    const filas = await leerTabla(page, SEL_TABLA.paros);
    const vistos = new Set();
    let sinMapa = 0;
    for (const f of filas) {
      vistos.add(f[1]);
      const esp = NOMBRES_CORTOS.get(String(Number(f[0])));
      if (esp === undefined) { sinMapa++; continue; }
      if (norm(f[1]) !== norm(esp)) falloT.push(`${clave}: Sap ${f[0]} aviso ${f[2]} muestra "${f[1]}" y se esperaba "${esp}"`);
    }
    if (filas.length === 0) falloT.push(`${clave}: tabla sin filas con el período completo`);
    if (sinMapa) falloT.push(`${clave}: ${sinMapa} filas con un Sap que no está en el mapa de nombres cortos`);
    resumenT.push(`${clave} ${filas.length} filas, ${vistos.size} equipos`);
  }
  funcional("F14b", "Columna Equipo de las tablas de paros con el nombre corto (por Sap) en las 5 páginas, con todos los paros del período completo", falloT.length === 0, falloT.length ? falloT.slice(0, 8).join(" | ") : resumenT.join("; "));

  // F14c: Resumen conserva el nombre completo.
  await irA(page, "#/resumen");
  const falloR = [];
  for (const f of await leerTabla(page, SEL_TABLA.equipo)) {
    const corto = norm(nombreCorto(f[0], f[1]));
    if (norm(f[1]) === corto || norm(f[1]).length <= corto.length || cortosEsperados.has(norm(f[1]))) falloR.push(`${f[0]}: Resumen muestra "${f[1]}" (nombre corto "${corto}")`);
  }
  funcional("F14c", "Resumen Disp. muestra el nombre completo de los 18 equipos (no el corto)", falloR.length === 0 && completos.size === 18, falloR.length ? falloR.join(" | ") : `${completos.size} equipos, p. ej. "${[...completos.values()][0]}" y no "${[...cortosEsperados][0]}"`);

  // F14d: titulos de los paneles de Disp Mensual, para cada familia.
  await irA(page, "#/mensual");
  const fams = await opcionesFamilia(page);
  const inicial = fams.find((f) => f.marcada)?.texto;
  const falloM = [];
  const usadosM = new Set();
  const detalleM = [];
  for (const fam of fams) {
    await seccion(page, "Familia").getByLabel(fam.texto, { exact: true }).check();
    await esperarEstable(page);
    const m = await leerMensual(page);
    const titulos = m.paneles.map((p) => norm(p.titulo));
    titulos.forEach((x) => usadosM.add(x));
    detalleM.push(`${fam.texto}: ${titulos.join(" / ")}`);
    const malos = titulos.filter((x) => !cortosEsperados.has(x));
    if (malos.length) falloM.push(`${fam.texto}: títulos que no son nombres cortos: ${malos.join(", ")}`);
    if (titulos.length === 0) falloM.push(`${fam.texto}: sin paneles`);
  }
  if (inicial) { await seccion(page, "Familia").getByLabel(inicial, { exact: true }).check(); await esperarEstable(page); }
  const faltanM = dif(cortosEsperados, usadosM);
  if (faltanM.length) falloM.push(`equipos sin panel en ninguna familia: ${faltanM.join(", ")}`);
  funcional("F14d", "Títulos de los paneles de Disp Mensual con nombre corto (todas las familias)", falloM.length === 0, falloM.length ? falloM.join(" | ") : `${usadosM.size} títulos: ${detalleM.join(" | ")}`);
}

// F15 ---------------------------------------------------------------------------------------------
async function f15(page) {
  // Se mide con todo el periodo (mucho paro, barra vertical presente): el peor caso para el ancho de la tabla.
  await irA(page, "#/simba");
  const rango = await periodoCompleto(page);
  await aplicarFiltros(page, { desde: rango.min, hasta: rango.max, hDisp: 24, tConf: null, disp: ["Mecánica", "Operacional"], familia: null });
  const lineas = [];
  for (const [w, h, id] of [[1600, 900, "F15a"], [1366, 768, "F15b"]]) {
    await page.setViewportSize({ width: w, height: h });
    const fallos = [];
    const filas = [];
    for (const clave of FAMILIAS) {
      await irA(page, PAGINAS[clave].ruta);
      const m = await page.evaluate((GEO) => {
        const f = new Function(`${GEO}
          const t = document.querySelector('.tabla-paros');
          const tab = t.querySelector('table');
          const b = [...t.querySelectorAll('th button')].find((x) => x.textContent.includes('Hrs de Paro'));
          const g = document.createRange();
          g.selectNodeContents(b.firstChild);
          const tops = new Set([...g.getClientRects()].map((r) => Math.round(r.top)));
          const th = b.closest('th').getBoundingClientRect();
          return { sw: t.scrollWidth, cw: t.clientWidth, sh: t.scrollHeight, ch: t.clientHeight, tablaAncho: tab.offsetWidth, filas: tab.tBodies[0].rows.length, lineas: tops.size, anchoTh: th.width / s, titulo: b.firstChild.textContent };`);
        return f();
      }, GEOMETRIA);
      filas.push(`${clave}: scrollWidth ${m.sw} / clientWidth ${m.cw}, ${m.filas} filas, barra vertical ${m.sh > m.ch ? "sí" : "no"}`);
      if (m.sw > m.cw) fallos.push(`${clave}: barra horizontal, scrollWidth ${m.sw} > clientWidth ${m.cw}`);
      if (m.tablaAncho > m.cw + 0.5) fallos.push(`${clave}: la tabla mide ${m.tablaAncho} px y su contenedor ${m.cw}`);
      if (m.filas === 0) fallos.push(`${clave}: sin filas`);
      lineas.push({ pagina: clave, ventana: `${w}x${h}`, lineas: m.lineas, anchoTh: m.anchoTh, titulo: m.titulo });
      if (id === "F15a" && clave === "simba") await page.screenshot({ path: path.join(dirTemporal(), "simba_con_barra.png") }); // para el control de F17
    }
    funcional(id, `Tabla de paros sin barra horizontal (scrollWidth <= clientWidth) en las 5 páginas de familia a ${w}x${h}, con el período completo`, fallos.length === 0, fallos.length ? fallos.join(" | ") : filas.join("; "));
  }
  await page.setViewportSize(VENTANA);
  const malas = lineas.filter((l) => l.lineas > 1 || l.lineas < 1 || l.titulo !== "Hrs de Paro");
  funcional("F15c", "Título 'Hrs de Paro' de la tabla de paros en una línea (5 páginas, 1600x900 y 1366x768)", malas.length === 0, malas.length ? malas.map((l) => `${l.pagina} ${l.ventana}: ${l.lineas} líneas ("${l.titulo}")`).join(" | ") : `${lineas.length} medidas, todas en ${[...new Set(lineas.map((l) => l.lineas))].join(" o ")} líneas; ancho de la columna ${lineas[0].anchoTh.toFixed(0)} px de lienzo`);
}

// F16 ---------------------------------------------------------------------------------------------
async function medirAlineacion(page) {
  return page.evaluate(async (GEO) => {
    const f = new (Object.getPrototypeOf(async function () {}).constructor)(`${GEO}
      const fondo = getComputedStyle(document.querySelector('.lienzo')).backgroundImage.replace(/^url\\("?|"?\\)$/g, '');
      const img = new Image();
      img.src = fondo;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      // Borde inferior de la banda: primera fila clara bajo la banda oscura, en 3 columnas sin texto de la banda.
      const bordes = [300, 600, 1000].map((x) => { for (let y = 1; y < 300; y++) { const d = g.getImageData(x, y, 1, 1).data; if (d[0] + d[1] + d[2] > 600) return y; } return null; });
      const top = (sel) => { const e = document.querySelector(sel); return e ? rel(e.getBoundingClientRect()).t : null; };
      const seg = [...document.querySelectorAll('h3.seg-cabecera')].find((h) => h.textContent.trim() === 'Periodo de tiempo');
      return { bordes, banda: bordes.sort((a, b) => a - b)[1], segPeriodo: seg ? rel(seg.getBoundingClientRect()).t : null, tablaResumen: top('.tabla-resumen th'), tablaFamilia: top('.tabla-familia th'), graficoTitulo: top('.graf-titulo'), tablaParos: top('.tabla-paros th') };`);
    return f();
  }, GEOMETRIA);
}

async function f16(page) {
  await page.setViewportSize(VENTANA);
  await irA(page, "#/resumen");
  const r = await medirAlineacion(page);
  const dRes = [["cabecera de la tabla de Resumen", r.tablaResumen], ["borde inferior de la banda", r.banda], ["cabecera 'Periodo de tiempo'", r.segPeriodo]];
  const maxDif = Math.max(...dRes.flatMap(([, a]) => dRes.map(([, b]) => Math.abs(a - b))));
  const texto = dRes.map(([n, v]) => `${n} y=${v.toFixed(2)}`).join("; ");
  funcional("F16a", `Resumen: borde superior de la tabla = borde inferior de la banda = borde superior de 'Periodo de tiempo' (tolerancia ${TOL_ALINEACION} px de lienzo)`, maxDif <= TOL_ALINEACION, `${texto}; mayor diferencia ${maxDif.toFixed(2)} px (la tabla por familia empieza en y=${r.tablaFamilia?.toFixed(2)})`);
  const fallos = [];
  const filas = [];
  for (const clave of FAMILIAS) {
    await irA(page, PAGINAS[clave].ruta);
    const m = await medirAlineacion(page);
    const d = Math.abs(m.graficoTitulo - m.segPeriodo);
    filas.push(`${clave}: gráfico y=${m.graficoTitulo.toFixed(2)}, 'Periodo de tiempo' y=${m.segPeriodo.toFixed(2)}`);
    if (d > TOL_ALINEACION) fallos.push(`${clave}: cabecera del gráfico y=${m.graficoTitulo.toFixed(2)} y 'Periodo de tiempo' y=${m.segPeriodo.toFixed(2)} (diferencia ${d.toFixed(2)} px)`);
  }
  await irA(page, "#/mensual");
  const mm = await medirAlineacion(page);
  funcional("F16b", `Páginas de familia: cabecera del gráfico alineada con la del segmentador de período (tolerancia ${TOL_ALINEACION} px de lienzo)`, fallos.length === 0, `${fallos.length ? fallos.join(" | ") : filas.join("; ")}. Informativo, fuera de la comprobación: en Disp Mensual el título de los paneles está en y=${mm.graficoTitulo.toFixed(2)} y 'Periodo de tiempo' en y=${mm.segPeriodo.toFixed(2)}`);
}

// F17 ---------------------------------------------------------------------------------------------
const PY_IMAGEN = `
import sys, json
import numpy as np
from PIL import Image
ruta, escala, nav_y, pie_y = sys.argv[1], None, int(sys.argv[3]), int(sys.argv[4])
im = np.asarray(Image.open(ruta).convert("RGB")).astype(int)
H, W, _ = im.shape
escala = W / 1280.0
r, g, b = im[..., 0], im[..., 1], im[..., 2]
gris = (abs(r - g) <= 8) & (abs(g - b) <= 8) & (g >= 120) & (g <= 156)
corr = np.zeros(W, int); mejor = np.zeros(W, int); fin = np.zeros(W, int)
for y in range(H):
    corr = np.where(gris[y], corr + 1, 0)
    sube = corr > mejor
    mejor = np.where(sube, corr, mejor); fin = np.where(sube, y, fin)
min_run = int(round(8 * escala)); min_cols = int(round(5 * escala))
cand = mejor >= min_run
barra = None; x = 0
while x < W:
    if cand[x]:
        x0 = x
        while x < W and cand[x]: x += 1
        if x - x0 >= min_cols and (barra is None or x - x0 > barra["cols"]):
            sl = slice(x0, x)
            barra = {"cols": x - x0, "x0": round(x0 / escala, 1), "x1": round(x / escala, 1), "run": round(int(mejor[sl].max()) / escala, 1), "y1": round(int(fin[sl][np.argmax(mejor[sl])]) / escala, 1)}
    else:
        x += 1
lum = 0.299 * r + 0.587 * g + 0.114 * b
def reg(x0, x1, y0, y1):
    return lum[int(y0 * escala):int(y1 * escala), int(x0 * escala):int(x1 * escala)]
nav = reg(560, 720, nav_y, nav_y + 16)
fila = reg(600, 1280, pie_y + 2, pie_y + 14)
oscuros = np.argwhere(fila < 170)
cols = np.unique(oscuros[:, 1]) if len(oscuros) else np.array([], int)
pie = None if len(cols) == 0 else {"minX": round(600 + cols.min() / escala, 1), "maxX": round(600 + cols.max() / escala, 1), "maxHueco": round(float(np.diff(cols).max() if len(cols) > 1 else 0) / escala, 1)}
print(json.dumps({"w": W, "h": H, "escala": escala, "barra": barra, "nav": {"pixeles": int((nav < 200).sum()), "minLum": int(nav.min())}, "pie": pie}))
`;
const analizarImagen = (png, navY = 674, pieY = 674) => JSON.parse(execFileSync("python3", ["-I", "-c", PY_IMAGEN, png, "0", String(navY), String(pieY)], { encoding: "utf8" }));

async function f17(page) {
  await page.setViewportSize(VENTANA);
  await irA(page, "#/simba");
  const ap = await aplicarFiltros(page, { desde: "2026-11-01", hasta: "2026-11-20", hDisp: 24, tConf: null, disp: ["Mecánica"], familia: null });
  const est = await estadoFiltros(page);
  const nombreEsperado = `Indicadores_Dimelco_${est.desde}_${est.hasta}.pdf`;
  const filasSimba = (await leerTabla(page, SEL_TABLA.paros)).length;
  // Muestreo del DOM mientras se genera: enlaces de sesion, flecha, navegador e indicador de guardado deben estar ocultos.
  await page.evaluate(() => {
    window.__pdf = { muestras: 0, hojas: 0, visibles: {}, desbordes: {}, nav: 0 };
    window.__pdfTimer = setInterval(() => {
      const raiz = document.querySelector(".exportando-pdf");
      if (!raiz) return;
      const hojas = [...raiz.querySelectorAll("[data-hoja-pdf]")];
      if (hojas.length !== 8 || !hojas.every((h) => h.querySelector(".lienzo"))) return;
      const P = window.__pdf;
      P.muestras++;
      P.hojas = hojas.length;
      P.nav = raiz.querySelectorAll(".nav-paginas").length;
      // Visible = ocupa espacio en pantalla (un hijo de un ancestro con display:none no tiene cajas).
      const visible = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      for (const e of raiz.querySelectorAll(".lienzo-enlaces, .portada-enlaces, .lienzo-volver, .nav-paginas, .guardado-periodo, .boton-exportar-pdf, a[href='#/login']")) {
        if (visible(e)) P.visibles[e.className || e.tagName] = (P.visibles[e.className || e.tagName] ?? 0) + 1;
      }
      for (const e of raiz.querySelectorAll(".tabla-pbi, .paneles-rejilla")) {
        const o = getComputedStyle(e).overflowY;
        if (o !== "hidden") P.desbordes[e.className + ":" + o] = (P.desbordes[e.className + ":" + o] ?? 0) + 1;
      }
    }, 40);
  });
  const t0 = Date.now();
  const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 240_000 }), page.locator("button.boton-exportar-pdf").click()]);
  const ms = Date.now() - t0;
  const archivo = path.join(dirTemporal(), "exportado.pdf");
  await descarga.saveAs(archivo);
  const dom = await page.evaluate(() => { clearInterval(window.__pdfTimer); return window.__pdf; });
  R.tiempos.pdfMs = ms;
  funcional("F17a", "Exportar PDF como invitado: descarga con el nombre Indicadores_Dimelco_<desde>_<hasta>.pdf", descarga.suggestedFilename() === nombreEsperado && ap.ok, `archivo "${descarga.suggestedFilename()}" (esperado "${nombreEsperado}"), generado y descargado en ${(ms / 1000).toFixed(1)} s; filtros fijados: ${ap.ok}`);

  const info = execFileSync("pdfinfo", [archivo], { encoding: "utf8" });
  const paginas = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  const tam = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(info);
  funcional("F17b", "El PDF exportado tiene 8 páginas (pdfinfo)", paginas === 8, `Pages: ${paginas}; tamaño de página ${tam ? `${tam[1]} x ${tam[2]} pts` : "?"}; ${(fs.statSync(archivo).size / 1024).toFixed(0)} KB`);

  const base = path.join(dirTemporal(), "pag");
  execFileSync("pdftoppm", ["-r", "144", "-png", archivo, base]);
  const imagenes = fs.readdirSync(dirTemporal()).filter((n) => /^pag-\d+\.png$/.test(n)).sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4))).map((n) => path.join(dirTemporal(), n));
  fs.mkdirSync(CAPTURAS, { recursive: true });
  if (imagenes[1]) fs.copyFileSync(imagenes[1], path.join(CAPTURAS, "pdf_pagina2.png"));
  const analisis = imagenes.map((img, i) => (i === 0 ? null : analizarImagen(img, i === 6 ? 704 : 674, i === 6 ? 704 : 674)));
  const conBarra = analisis.map((a, i) => (a && a.barra ? `página ${i + 1}: barra gris de ${a.barra.cols} columnas x ${a.barra.run} px en x=${a.barra.x0}-${a.barra.x1}` : null)).filter(Boolean);
  const p2 = analisis[1];
  funcional("F17c", "Páginas 2 a 8 del PDF sin barras de desplazamiento (píxeles; imagen de la página 2 en capturas_e2e/pdf_pagina2.png)", imagenes.length === 8 && conBarra.length === 0, conBarra.length ? conBarra.join(" | ") : `${imagenes.length} páginas convertidas con pdftoppm a ${p2?.w}x${p2?.h}; sin barras en ninguna (la tabla de paros de Simba tenía ${filasSimba} filas en pantalla)`);
  const conNav = analisis.map((a, i) => (a && a.nav.pixeles > 0 ? `página ${i + 1}: ${a.nav.pixeles} píxeles no blancos en la zona del navegador` : null)).filter(Boolean);
  funcional("F17d", "Páginas 2 a 8 del PDF sin el navegador '‹ n de 8 ›' (zona central del pie vacía)", imagenes.length === 8 && conNav.length === 0, conNav.length ? conNav.join(" | ") : "zona x 560-720 del lienzo, a la altura del pie, en blanco en las 7 páginas");
  // Con los enlaces (Exportar PDF, Ingresar) el texto del pie termina cerca de x=1136 y los enlaces ocupan hasta x=1272,
  // separados del texto por un hueco de 14 px. Sin ellos el texto es un solo bloque pegado al borde derecho (x=1272).
  const pieMal = analisis.map((a, i) => (a && (!a.pie || Math.abs(a.pie.maxX - 1272) > 4 || a.pie.maxHueco >= 8 || a.pie.minX < 1000) ? `página ${i + 1}: pie en x=${a?.pie?.minX}-${a?.pie?.maxX}, hueco máximo ${a?.pie?.maxHueco}` : null)).filter(Boolean);
  funcional("F17e", "Páginas 2 a 8 del PDF sin los enlaces de sesión (el texto del pie queda como un solo bloque pegado al borde derecho)", imagenes.length === 8 && pieMal.length === 0, pieMal.length ? pieMal.join(" | ") : `texto del pie en x=${analisis[1]?.pie?.minX}-${analisis[1]?.pie?.maxX}, un solo bloque (hueco máximo ${analisis[1]?.pie?.maxHueco} px); con los enlaces habría un bloque aparte entre x=1150 y 1272`);
  const visibles = Object.entries(dom.visibles ?? {});
  const desb = Object.entries(dom.desbordes ?? {});
  funcional("F17f", "Durante la generación: enlaces de sesión, botón Exportar PDF, flecha, navegador e indicador de guardado ocultos; tablas con overflow oculto", dom.muestras > 0 && dom.hojas === 8 && visibles.length === 0 && desb.length === 0, dom.muestras === 0 ? "no se pudo muestrear el contenedor de exportación" : visibles.length || desb.length ? `visibles: ${JSON.stringify(dom.visibles)}; sin overflow oculto: ${JSON.stringify(dom.desbordes)}` : `${dom.muestras} muestras con las 8 hojas montadas; ${dom.nav} navegadores presentes pero ocultos por CSS`);
  const control = fs.existsSync(path.join(dirTemporal(), "simba_con_barra.png")) ? analizarImagen(path.join(dirTemporal(), "simba_con_barra.png")) : null;
  funcional("F17g", "Control del detector: encuentra la barra de desplazamiento de la tabla de paros en la captura de la página en pantalla", Boolean(control?.barra), control?.barra ? `barra de ${control.barra.cols} columnas x ${control.barra.run} px en x=${control.barra.x0}-${control.barra.x1} (captura de Simba con el período completo); en el PDF no aparece ninguna` : "el detector no encontró barra en la captura en pantalla (no sirve de control)");
}

// F18 ---------------------------------------------------------------------------------------------
const textoDataActualizada = (desde, hasta) => {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  const dd = (n) => String(n).padStart(2, "0");
  if (a1 === a2 && m1 === m2 && d1 === d2) return `Data actualizada: ${dd(d1)} de ${MESES[m1 - 1]} ${a1}`;
  if (a1 !== a2) return `Data actualizada: ${dd(d1)} de ${MESES[m1 - 1]} ${a1} al ${dd(d2)} de ${MESES[m2 - 1]} ${a2}`;
  if (m1 !== m2) return `Data actualizada: ${dd(d1)} de ${MESES[m1 - 1]} al ${dd(d2)} de ${MESES[m2 - 1]} ${a2}`;
  return `Data actualizada: ${dd(d1)} al ${dd(d2)} de ${MESES[m2 - 1]} ${a2}`;
};

function leerConfiguracion() {
  const flujo = fs.readFileSync(path.join(RAIZ, ".github/workflows/web.yml"), "utf8");
  const llave = /VITE_SUPABASE_ANON_KEY:\s*(\S+)/.exec(flujo)?.[1];
  const url = /VITE_SUPABASE_URL:\s*(\S+)/.exec(flujo)?.[1];
  if (!llave || !url) throw new Error("no se encontró la URL o la llave anon en .github/workflows/web.yml");
  const cuerpo = execFileSync("curl", ["-sS", "--fail", "--max-time", "60", `${url}/rest/v1/configuracion?select=*`, "-H", `apikey: ${llave}`, "-H", `Authorization: Bearer ${llave}`], { encoding: "utf8" });
  return JSON.parse(cuerpo);
}

async function f18(page) {
  const filas = leerConfiguracion();
  const c = filas.find((f) => f.id === 1) ?? filas[0];
  if (!c) throw new Error("la tabla configuracion no devolvió filas");
  R.configuracion = { periodo_ini: c.periodo_ini, periodo_fin: c.periodo_fin, mensual_ini: c.mensual_ini, mensual_fin: c.mensual_fin, actualizado: c.actualizado };
  if (!c.periodo_ini || !c.periodo_fin) return { ok: false, detalle: `la configuración no tiene período general guardado (periodo_ini ${c.periodo_ini}, periodo_fin ${c.periodo_fin}); la Portada mostraría el período calculado de los datos` };
  const esperado = textoDataActualizada(c.periodo_ini, c.periodo_fin);
  await irA(page, "#/");
  let obtenido = "";
  const limite = Date.now() + 30_000;
  while (Date.now() < limite) {
    obtenido = norm(await page.locator(".portada-fecha").innerText());
    if (obtenido === esperado) break;
    await page.waitForTimeout(500);
  }
  return { ok: obtenido === esperado, detalle: `configuracion (GET /rest/v1/configuracion, llave anon): periodo_ini ${c.periodo_ini}, periodo_fin ${c.periodo_fin}; Portada: "${obtenido}"; esperado: "${esperado}"` };
}

async function funcionalesNuevas(browser, ctx, page, vigilar) {
  await page.setViewportSize(VENTANA);
  if (!omitido("F10")) await seguro("F10", "Navegador de páginas: recorrido de las 8 páginas con '›' y regreso con '‹' (ruta, texto 'n de 8', extremos deshabilitados)", () => f10(page));
  if (!omitido("F11")) await seguro("F11", "Filtros conservados al navegar con el navegador de páginas (período, Var t: Disp, DISP, Var t: Conf.; Mensual con lo suyo)", () => f11(page));
  if (!omitido("F12")) await seguro("F12", "Teclas flecha derecha e izquierda cambian de página (y no actúan en los extremos ni dentro de un campo)", () => f12(page));
  if (!omitido("F13")) await seguro("F13a", "Navegador dentro del lienzo y sin solaparse con pie, enlaces, tablas ni gráficos en las 8 páginas a 1600x900", () => f13(page, 1600, 900));
  if (!omitido("F13")) await seguro("F13b", "Navegador dentro del lienzo y sin solaparse con pie, enlaces, tablas ni gráficos en las 8 páginas a 1366x768", () => f13(page, 1366, 768));
  await page.setViewportSize(VENTANA);
  if (!omitido("F14")) await bloque("F14", "Nombres cortos (F14a a F14d)", () => f14(page));
  if (!omitido("F16")) await bloque("F16", "Alineación de cabeceras (F16a y F16b)", () => f16(page));
  // F15 y F17 en un navegador con las barras de desplazamiento visibles (barras de 8 px de src/components/lienzo.css).
  const conBarras = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  try {
    const ctxB = await conBarras.newContext({ viewport: VENTANA, acceptDownloads: true });
    const pageB = await ctxB.newPage();
    vigilar(pageB);
    await pageB.goto(`${BASE}#/`);
    await bloque("F15", "Tabla de paros de anchos fijos (F15a a F15c)", () => f15(pageB));
    await pageB.setViewportSize(VENTANA);
    await bloque("F17", "Exportar PDF (F17a a F17g)", () => f17(pageB));
    await ctxB.close();
  } finally {
    await conBarras.close();
  }
  await seguro("F18", "Portada: 'Data actualizada' igual al período guardado en la tabla configuracion", () => f18(page));
}

// Control negativo: con un filtro distinto al del fixture, la comparacion debe detectar diferencias.
// Si no las detectara, "todo coincide" no probaria nada.
async function controlNegativo(page, lista) {
  const casos = [
    ["a_resumen_equipo", "resumen", { hDisp: 24 }, "Resumen por equipo con Var t: Disp 24 h contra el fixture de 18 h"],
    ["a_tabla_simba", "simba", { disp: ["Operacional"] }, "Tabla de paros de Simba con DISP Operacional contra el fixture de Mecánica"],
    ["a_grafico_sostenimiento", "sostenimiento", { desde: "2026-11-01", hasta: "2026-11-10" }, "Gráfico de Sostenimiento con otro período"],
    ["e_mensual", "mensual", { hDisp: 18 }, "Disp Mensual con Var t: Disp 18 h contra el fixture de 24 h"],
  ];
  R.control = [];
  for (const [id, pagina, cambio, texto] of casos) {
    const x = lista.find((l) => l.fixture === id);
    await irA(page, PAGINAS[pagina].ruta);
    await aplicarFiltros(page, { ...x.filtros, ...cambio });
    const c = nuevaComparacion(x);
    if (x.visual === "resumen_equipo") compararResumenEquipo(c, await leerTabla(page, SEL_TABLA.equipo), x.fx);
    else if (x.visual === "tabla") compararParos(c, await leerTabla(page, SEL_TABLA.paros), x.fx);
    else if (x.visual === "grafico") compararGrafico(c, await leerGrafico(page), x.fx);
    else compararMensual(c, await leerMensual(page), x.fx);
    R.control.push({ caso: texto, comparados: c.comparados, diferencias: c.diferencias.length });
  }
  funcional("F09", "Control negativo: con filtros distintos a los del fixture, la comparación detecta diferencias", R.control.every((k) => k.diferencias > 0), R.control.map((k) => `${k.caso}: ${k.diferencias} de ${k.comparados}`).join(" | "));
}

async function tiempos(browser) {
  const ms = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await browser.newContext({ viewport: VENTANA }); // contexto nuevo = caché fría
    const p = await ctx.newPage();
    const t0 = Date.now();
    await p.goto(`${BASE}#/resumen`, { waitUntil: "commit" });
    await p.waitForFunction(() => {
      const td = document.querySelectorAll(".tabla-resumen tbody tr td");
      return td.length >= 8 && /\d+\.\d\d/.test(td[2].innerText);
    }, null, { timeout: T_CARGA, polling: 50 });
    ms.push(Date.now() - t0);
    console.log(`Tiempo ${i + 1}: ${ms[i]} ms`);
    await ctx.close();
  }
  R.tiempos = { resumenMs: ms, promedioMs: Math.round(ms.reduce((a, b) => a + b, 0) / ms.length), minimoMs: Math.min(...ms), maximoMs: Math.max(...ms) };
  funcional("F07", "Tiempo desde abrir la web hasta ver números en Resumen (3 mediciones)", true, `${ms.join(" ms, ")} ms (informativo; sin umbral)`);
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const browser = await chromium.launch();
  R.navegador = `Chromium ${browser.version()}`;
  const ctx = await browser.newContext({ viewport: VENTANA });
  const page = await ctx.newPage();
  const consola = [];
  const vigilar = (pg) => {
    const marcar = (tipo, texto) => consola.push({ tipo, texto: texto.slice(0, 300), pagina: pg.url().split("#")[1] ?? "" });
    pg.on("console", (m) => { if (m.type() === "error") marcar("console.error", m.text()); });
    pg.on("pageerror", (e) => marcar("pageerror", e.message));
    pg.on("requestfailed", (r) => marcar("requestfailed", `${r.url()} ${r.failure()?.errorText ?? ""}`));
    pg.on("response", (r) => { if (r.status() >= 400) marcar("http", `${r.status()} ${r.url()}`); });
  };
  vigilar(page);

  const t0 = Date.now();
  await page.goto(`${BASE}#/`);
  const lista = fixturesComparables();
  const jsPrincipal = await page.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => /assets\/index-.*\.js/.test(s)) ?? "");
  R.jsPrincipal = jsPrincipal.split("/").pop();
  console.log(`Web: ${BASE} (${R.jsPrincipal}); ${lista.length} fixtures de Power BI`);

  if (SOLO !== "comparacion" && !omitido("antiguas")) await funcionales(browser, ctx, page);
  if (SOLO !== "funcional") {
    await irA(page, "#/resumen");
    await comparacion(page, lista);
  }
  if (SOLO !== "funcional") await controlNegativo(page, lista);
  // Las comprobaciones nuevas van despues de la comparacion: sus recorridos por Disp Mensual (otros periodos y familias)
  // cambian cuantas etiquetas de % oculta hideOverlap en la comparacion siguiente (+-2 de 389, con los mismos valores).
  if (SOLO !== "comparacion") await funcionalesNuevas(browser, ctx, page, vigilar);
  R.consola = consola;
  funcional("F06", "Sin errores de consola, de página ni respuestas HTTP de error durante toda la sesión", consola.length === 0, consola.slice(0, 6).map((c) => `[${c.pagina}] ${c.tipo}: ${c.texto}`).join(" | "));
  await ctx.close();
  if (SOLO !== "comparacion" && SOLO !== "funcional") await tiempos(browser);
  await browser.close();
  R.duracionS = Math.round((Date.now() - t0) / 1000);
  const orden = new Intl.Collator("es", { numeric: true });
  R.funcionales.sort((a, b) => orden.compare(a.id.replace(/_/g, ""), b.id.replace(/_/g, "")));
  if (TMP) fs.rmSync(TMP, { recursive: true, force: true });

  const tot = R.comparaciones.reduce((a, c) => ({ comparados: a.comparados + c.comparados, iguales: a.iguales + c.iguales }), { comparados: 0, iguales: 0 });
  R.resumen = { ...tot, diferencias: tot.comparados - tot.iguales, funcionalesPasan: R.funcionales.filter((f) => f.ok).length, funcionalesTotal: R.funcionales.length, fixtures: R.comparaciones.length };
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify(R, null, 1));
  console.log(`\nValores comparados: ${tot.comparados}; iguales: ${tot.iguales}; diferencias: ${tot.comparados - tot.iguales}`);
  console.log(`Comprobaciones funcionales: ${R.resumen.funcionalesPasan}/${R.resumen.funcionalesTotal}`);
  console.log(`Resultados: ${SALIDA}`);
  process.exit(tot.comparados === tot.iguales && R.resumen.funcionalesPasan === R.resumen.funcionalesTotal ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
