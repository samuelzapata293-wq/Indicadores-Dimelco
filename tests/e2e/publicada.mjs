// Pruebas de punta a punta sobre la web publicada (React + HashRouter + datos reales en Supabase),
// como invitado, comparando lo que se ve con los valores reales de Power BI (tests/fixtures).
//
// Uso:   NODE_PATH=$(npm root -g) node tests/e2e/publicada.mjs
// Opciones por variable de entorno:
//   URL_PUBLICADA   direccion de la web (por defecto la de GitHub Pages)
//   SOLO            "comparacion" o "funcional" para correr solo una parte
//   SALIDA          ruta del JSON de resultados (por defecto docs/pruebas/resultados_e2e.json)
//   CAPTURAS        carpeta de capturas (por defecto docs/pruebas/capturas_e2e)
//
// Salida: JSON con todos los resultados (lo consume tests/e2e/informe.mjs) y un resumen por consola.
// Codigo de salida 0 si todo coincide y todas las comprobaciones pasan, 1 si hay diferencias.

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = process.env.URL_PUBLICADA ?? "https://samuelzapata293-wq.github.io/Indicadores-Dimelco/";
const SOLO = process.env.SOLO ?? "";
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
  for (const x of lista) x.filtros = filtrosDe(x.fx);
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
    "DISP. GLOBAL: la lista de casillas no tiene role ni aria-label (los radiogroup de Var t: Disp, Var t: Conf. y Familia sí). Se usó section.seg con su h3 'DISP. GLOBAL' y getByLabel('Mecánica'|'Operacional').",
    "Periodo de tiempo: los dos input[type=date] tienen aria-label 'Desde' y 'Hasta' (estables); la sección que los contiene no tiene role ni nombre.",
    "Tablas: no tienen caption ni aria-label. Se usaron las clases .tabla-paros y .tabla-resumen (tabla por equipo); la tabla por familia de Resumen no tiene clase propia (se usó '.caja-tabla .tabla-pbi:not(.tabla-resumen)').",
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

async function irA(page, ruta) {
  await page.evaluate((r) => { location.hash = r; }, ruta);
  await page.waitForFunction((r) => location.hash === r, ruta);
  await page.waitForSelector(".lienzo-tablero, .portada-lienzo", { timeout: T_CARGA });
  if (ruta !== "#/") await page.waitForSelector(".tabla-pbi tbody tr td, .panel-sem-lienzo svg", { timeout: T_CARGA });
  await esperarEstable(page);
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

const SEL_TABLA = { equipo: ".tabla-resumen", familia: ".caja-tabla .tabla-pbi:not(.tabla-resumen)", paros: ".tabla-paros" };

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
    const nombre = norm(r["DIM_EQUIPOS.Descripcion"]);
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
    equipo: r["HECHOS_DATAMES_NPI_PP.DesEquipo"],
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
  const campos = ["Sap", "Equipo", "Aviso", "Descripción del Paro", "_F/H Inicio", "_F/H Fin", "Hrs Paro Ventana", "Responsable", "Tipo de Paro"];
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
  let ocultas = 0;
  let visibles = 0;
  for (const [equipo, filas] of porEquipo) {
    const p = webPorTitulo.get(norm(equipo));
    if (!p) { cmp(c, equipo, "Panel del equipo", "presente", "ausente"); continue; }
    cmp(c, equipo, "Panel del equipo", norm(equipo), p.titulo);
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
  for (const p of m.paneles) if (!porEquipo.has(p.titulo)) cmp(c, p.titulo, "panel sobrante en la web", "sin panel", "panel");
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
  const fechaTxt = await page.locator(".portada-fecha").innerText();
  const v = validarDataActualizada(fechaTxt);
  funcional("F04", "Portada: 'Data actualizada:' seguido de un rango de fechas válido", v.ok, v.ok ? fechaTxt : v.motivo);
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
  const dispResumen = new Map(resumen.map((f) => [norm(f[1]), f[5]]));
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
  const ariaIni = await page.locator(".tabla-paros th", { hasText: "Hrs Paro Ventana" }).getAttribute("aria-sort");
  funcional("F03a", "Tabla de paros ordenada de mayor a menor Hrs Paro Ventana al abrir", esNoDecreciente(ordenIni) && ariaIni === "descending", `${todas.length} filas, primera ${ordenIni[0]}, última ${ordenIni.at(-1)}, aria-sort ${ariaIni}`);
  const cabecera = (t) => page.locator(".tabla-paros th button", { hasText: t });
  await cabecera("Hrs Paro Ventana").click();
  await esperarEstable(page, 400);
  const asc = horasDe(await leerTabla(page, SEL_TABLA.paros));
  funcional("F03b", "Clic en la cabecera Hrs Paro Ventana la pasa a ascendente", esNoDecreciente([...asc].reverse()) && asc[0] <= asc.at(-1), `primera ${asc[0]}, última ${asc.at(-1)}`);
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
  const marcar = (tipo, texto) => consola.push({ tipo, texto: texto.slice(0, 300), pagina: page.url().split("#")[1] ?? "" });
  page.on("console", (m) => { if (m.type() === "error") marcar("console.error", m.text()); });
  page.on("pageerror", (e) => marcar("pageerror", e.message));
  page.on("requestfailed", (r) => marcar("requestfailed", `${r.url()} ${r.failure()?.errorText ?? ""}`));
  page.on("response", (r) => { if (r.status() >= 400) marcar("http", `${r.status()} ${r.url()}`); });

  const t0 = Date.now();
  await page.goto(`${BASE}#/`);
  const lista = fixturesComparables();
  const jsPrincipal = await page.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => /assets\/index-.*\.js/.test(s)) ?? "");
  R.jsPrincipal = jsPrincipal.split("/").pop();
  console.log(`Web: ${BASE} (${R.jsPrincipal}); ${lista.length} fixtures de Power BI`);

  if (SOLO !== "comparacion") await funcionales(browser, ctx, page);
  if (SOLO !== "funcional") {
    await irA(page, "#/resumen");
    await comparacion(page, lista);
  }
  if (SOLO !== "funcional") await controlNegativo(page, lista);
  R.consola = consola;
  funcional("F06", "Sin errores de consola, de página ni respuestas HTTP de error durante toda la sesión", consola.length === 0, consola.slice(0, 6).map((c) => `[${c.pagina}] ${c.tipo}: ${c.texto}`).join(" | "));
  await ctx.close();
  if (SOLO !== "comparacion" && SOLO !== "funcional") await tiempos(browser);
  await browser.close();
  R.duracionS = Math.round((Date.now() - t0) / 1000);

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
