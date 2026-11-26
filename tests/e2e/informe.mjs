// Genera docs/pruebas/informe_2026-11.md a partir de docs/pruebas/resultados_e2e.json
// (salida de tests/e2e/publicada.mjs). Uso: node tests/e2e/informe.mjs
// Las tablas y los números salen del JSON; el texto fijo explica cómo se leyó cada visual.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRADA = process.env.ENTRADA ?? path.join(RAIZ, "docs/pruebas/resultados_e2e.json");
const SALIDA = process.env.SALIDA_MD ?? path.join(RAIZ, "docs/pruebas/informe_2026-11.md");
const R = JSON.parse(fs.readFileSync(ENTRADA, "utf8"));

const n = (x) => x.toLocaleString("es-CO").replace(/\./g, " ");
const celda = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const seg = (ms) => `${(ms / 1000).toFixed(2)} s`;
const fecha = R.fecha.slice(0, 10);

const total = R.resumen;
const dif = R.comparaciones.flatMap((c) => c.diferencias.map((d) => ({ ...d, esc: c.esc, fixture: c.fixture, pagina: c.pagina })));
const inf = R.comparaciones.flatMap((c) => c.informativas.map((d) => ({ ...d, esc: c.esc, fixture: c.fixture, pagina: c.pagina })));
const fallas = R.funcionales.filter((f) => !f.ok);

const L = [];
const p = (...x) => L.push(...x);

p("# Informe de pruebas de punta a punta sobre la web publicada", "");
p(`Fecha de ejecución: ${fecha}. Web: ${R.url} (JS principal \`${R.jsPrincipal}\`). Navegador: ${R.navegador}, ventana 1600x900, como invitado. Duración de la corrida: ${R.duracionS} s. Script: \`tests/e2e/publicada.mjs\`; datos crudos: \`docs/pruebas/resultados_e2e.json\`.`, "");

p("## Resumen", "");
p(`- **Valores comparados contra Power BI: ${n(total.comparados)}.** Iguales: **${n(total.iguales)}**. Diferencias: **${total.diferencias}**.`);
p(`- Fixtures de Power BI usados: ${total.fixtures} (13 de las capturas originales y 43 de los escenarios a, b, c, c_sindisp, d_conf12, d_conf24, e, f, g_tirolargo y g_sostenimiento).`);
p(`- **Comprobaciones funcionales: ${total.funcionalesPasan} de ${total.funcionalesTotal} pasaron.** ${fallas.length ? `Fallaron: ${fallas.map((f) => f.id).join(", ")} (detalle más abajo).` : "No falló ninguna."}`);
p(`- Tiempo desde abrir la web hasta ver números en Resumen (3 mediciones con caché fría): ${R.tiempos.resumenMs.map(seg).join(", ")}; promedio ${seg(R.tiempos.promedioMs)}.`);
p(`- Control negativo: con filtros distintos a los del fixture, la comparación sí detecta diferencias (${R.control.map((k) => `${k.diferencias} de ${k.comparados}`).join("; ")}), así que "0 diferencias" no es una comparación vacía.`, "");

p("## Qué se comparó y cómo se leyó cada visual", "");
p("Para cada fixture se abre la página, se ponen en la interfaz los filtros del fixture (período, Var t: Disp, Var t: Conf., DISP. GLOBAL y familia, leídos del propio fixture) y se lee lo que se ve. Se verifica que la interfaz quedó con esos filtros antes de leer. Los números esperados son los del fixture redondeados como los muestra la app: horas con 2 decimales, Meta y Disponibilidad % sin decimales, Confiabilidad y Probabilidad % con 2 decimales y espacio antes del signo, fechas como `m/d/aaaa h:mm:ss AM/PM`. No se usa tolerancia: el texto debe ser idéntico (mayúsculas y espacios incluidos, salvo espacios repetidos).", "");
p("Desde esta versión de la web, los gráficos de familia (eje), la columna Equipo de las tablas de paros y los títulos de los paneles de Disp Mensual muestran el **nombre corto** del equipo (`src/pages/nombresCortos.ts`, indexado por id_equipo); Resumen Disp. conserva el nombre completo. El valor esperado se calcula con la misma regla: el script lee el mapa de ese archivo (no lo duplica) y usa `nombreCorto(id, descripción del fixture)`. Las filas de Resumen por equipo y de la tabla de paros se emparejan por id (`IDEQUIPO` y `Sap`); los fixtures de gráfico y de Disp Mensual traen solo la descripción, así que su id sale de los fixtures de Resumen y de paros, que traen id y descripción.", "");
p("| Visual | De dónde se lee | Valores comparados por fila |", "|---|---|---|");
p("| Resumen por equipo | texto de la tabla (`.tabla-resumen`) | 8: equipo, denominación, MTTR, MTBF, Meta, Disp, Confiabilidad, Prob. de falla |");
p("| Resumen por familia | texto de la tabla por familia | 6: familia y las 5 medidas |");
p("| Gráficos de familia | SVG de ECharts: etiquetas del eje (equipo) y de cada serie | 3: nombre corto del equipo, etiqueta Disp %, etiqueta Meta % |");
p("| Tabla de paros | texto de `.tabla-paros`; las filas se emparejan por Sap, aviso, inicio y fin | 9: Sap, Equipo (nombre corto del Sap), Aviso, Descripción, inicio, fin, Hrs Paro Ventana, Responsable, Tipo de Paro; una fila que falte o sobre cuenta como 9 diferencias |");
p("| Disp Mensual | SVG de los paneles: título, etiquetas de semana, puntos y etiquetas de %. Los puntos Disp y Meta se leen de su posición en el SVG (convertida a %), así que quedan comprobados aunque la etiqueta se oculte por solape | por equipo y semana: punto Disp, punto Meta y cada etiqueta visible; más el panel de cada equipo (título con nombre corto) y la etiqueta de cada semana |", "");

p("## Resultado por escenario y página", "");
const porEsc = new Map();
for (const c of R.comparaciones) (porEsc.get(c.esc) ?? porEsc.set(c.esc, []).get(c.esc)).push(c);
for (const [esc, cs] of porEsc) {
  const comp = cs.reduce((a, c) => a + c.comparados, 0);
  const ig = cs.reduce((a, c) => a + c.iguales, 0);
  p(`### Escenario ${esc}: ${cs[0].descripcion}`, "");
  p(`Valores comparados: ${n(comp)}; iguales: ${n(ig)}; diferencias: ${comp - ig}.`, "");
  p("| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |", "|---|---|---|---:|---:|---:|");
  for (const c of cs) p(`| ${c.pagina} | ${celda(c.visual)} | \`${c.fixture}\` | ${c.comparados} | ${c.iguales} | ${c.comparados - c.iguales} |`);
  p("");
}

p("## Diferencias entre la web y Power BI", "");
if (dif.length === 0) {
  p("**No hay ninguna diferencia** en los valores comparados. Los puntos que conviene dejar claros:", "");
} else {
  p("| Escenario | Página | Fixture | Equipo o fila | Campo | Power BI | Web | Causa probable |", "|---|---|---|---|---|---|---|---|");
  for (const d of dif) p(`| ${d.esc} | ${d.pagina} | \`${d.fixture}\` | ${celda(d.item)} | ${celda(d.campo)} | ${celda(d.powerbi)} | ${celda(d.web)} | ${d.redondeoPbi ? `Redondeo en pantalla: la web muestra ${celda(d.redondeoPbi)} al redondear con mitad hacia arriba` : "por analizar"} |`);
  p("");
}
p(`- **Redondeo.** Se compara contra el redondeo de la app (\`toFixed\` y \`Math.round\`) y, aparte, contra la mitad hacia arriba que usa Power BI al mostrar. Casos en que los dos redondeos habrían dado un texto distinto: **${inf.length}**. ${inf.length ? "Se listan abajo." : "Ningún valor cae en un empate decimal, así que el redondeo en pantalla no produce ninguna diferencia visible."}`);
const fxB = R.comparaciones.filter((c) => c.fixture.startsWith("b_resumen"));
const blancos = fxB.length ? 46 : 0; // MTTR y MTBF nulos: 18 equipos x 2 + 5 familias x 2
const blancosDif = fxB.flatMap((c) => c.diferencias).filter((d) => /MTTR|MTBF/.test(d.campo)).length;
p(`- **Valores en blanco.** En los escenarios b (solo Operacional) Power BI devuelve MTTR y MTBF en blanco para los 18 equipos y las 5 familias (no hay fallas mecánicas). La web los muestra como celdas vacías, igual que el fixture (${blancos} valores en blanco comparados${blancosDif ? `, ${blancosDif} con diferencia` : ", todos coinciden"}).`);
const mens = R.comparaciones.filter((c) => c.visual === "mensual");
const mensDif = mens.flatMap((c) => c.diferencias).length;
p(`- **Disp Mensual.** ${mens.length} fixtures de este visual. ${mensDif === 0 ? "La web muestra el mismo conjunto de equipos y semanas que el fixture, los puntos de Disp y Meta coinciden y las etiquetas visibles son siempre la Disp o la Meta de su semana." : `Hay ${mensDif} diferencias, listadas arriba.`}`);
p("- **Tablas de paros.** Se compara cada celda de cada fila (Descripción incluida, con las mismas mayúsculas que Power BI). El orden de la tabla de ST1030 en Power BI era por equipo y el de la web es por Hrs Paro Ventana; por eso las filas se emparejan por clave y no por posición. El orden de la web se verifica aparte (F03).", "");
if (inf.length) {
  p("| Escenario | Página | Fixture | Fila | Campo | Redondeo de la app | Mitad hacia arriba | Web |", "|---|---|---|---|---|---|---|---|");
  for (const d of inf) p(`| ${d.esc} | ${d.pagina} | \`${d.fixture}\` | ${celda(d.item)} | ${celda(d.campo)} | ${celda(d.appRedondeo)} | ${celda(d.pbiRedondeo)} | ${celda(d.web)} |`);
  p("");
}

p("## Comprobaciones funcionales", "");
p("| Id | Comprobación | Resultado | Detalle |", "|---|---|---|---|");
for (const f of R.funcionales) p(`| ${f.id} | ${celda(f.nombre)} | ${f.ok ? "pasa" : "**falla**"} | ${celda(f.detalle).slice(0, 400)} |`);
p("");
p("Notas de método:", "");
p("- F01 cambia período, Var t: Disp y DISP en Simba (01/10 al 31/10/2026, 18 hrs, solo Operacional) y llega a las demás páginas con los enlaces de la propia app (flecha de volver y botones de la Portada), no con la URL, para comprobar también la navegación.");
p("- F02 hace clic con el mouse en el centro de la segunda columna del gráfico de Simba. Confirma que la tabla queda solo con ese equipo y con todas sus filas, que las otras columnas se atenúan (opacidad 0.3) y que el segundo clic devuelve las filas originales.");
p(`- F04: la Portada muestra "${R.periodoInicial.portada}". El período inicial de Resumen es ${R.periodoInicial.desde} a ${R.periodoInicial.hasta} (coincide con la Portada) y el de Disp Mensual ${R.periodoInicial.mensual.desde} a ${R.periodoInicial.mensual.hasta}. Disp Mensual no hereda el período general: arranca en su propio rango, distinto al de las demás páginas.`);
p("- F05 mide `scrollHeight` y `scrollWidth` del documento en las 8 páginas (Portada y 7 de tablero) a 1600x900 y a 1366x768. Las capturas de las 8 páginas a 1600x900, con los filtros iniciales, quedaron en `docs/pruebas/capturas_e2e/`.");
p("- F06 recoge `console.error`, errores de página, peticiones fallidas y respuestas HTTP 4xx o 5xx de toda la sesión (también la del segundo navegador de F15 y F17).");
p("- F09 es el control negativo descrito en el resumen.");
p("- F10 va de la Portada a Disp Mensual con el botón \"Página siguiente\" (›) y regresa con \"Página anterior\" (‹). En cada paso verifica la ruta (el orden se lee de `src/pages/ordenPaginas.ts`), el texto \"n de 8\", que ‹ esté deshabilitado en la primera página y › en la última, y que no se haya recargado la página (una marca en `window` sobrevive al recorrido).");
p("- F11 pone en Simba un período (05/10 al 25/10/2026), Var t: Disp 18 hrs y DISP Operacional distintos a los que tenía la sesión, avanza con › por Jumbo, Sostenimiento, ST3.5, ST1030, Resumen y Mensual y regresa con ‹ comprobando en cada página los filtros compartidos. En Resumen cambia Var t: Conf. y en Mensual su propio período (06/07 al 04/10/2026) y su familia: el período general no cambia, Mensual conserva lo suyo al volver y Var t: Conf. se conserva.");
p("- F12 pulsa ArrowRight y ArrowLeft con el foco fuera de los campos, y comprueba que no hacen nada en la Portada (←), en Disp Mensual (→), con Ctrl o Shift, ni con el foco en el campo de fecha Desde (que además conserva su valor).");
p("- F13 mide en coordenadas de lienzo (1280x720) la caja del navegador (`nav.nav-paginas`) y la cruza con el texto del pie (por rango de texto), los enlaces del pie, las tablas, los gráficos, los paneles y ejes de Mensual, los segmentadores y, en la Portada, la fecha, los botones y el título. Pide que quede dentro del lienzo, centrado (x=640) y abajo, sin solape de más de 0.5 px.");
p("- F14 usa el período completo de los datos (límites de los campos de fecha), 24 hrs y Mecánica más Operacional para que las tablas lleven todos los paros. F14a compara los nombres del eje de los 5 gráficos con el nombre corto de cada equipo (id y denominación salen de la tabla de Resumen) y exige que entre los 5 aparezcan los 18. F14b exige que en cada fila de las tablas de paros la columna Equipo sea el nombre corto del Sap de esa fila. F14c exige en Resumen el nombre completo de los 18. F14d recorre las 5 familias de Disp Mensual y exige que los 18 títulos sean nombres cortos.");
p("- F15 y F17 corren en un segundo navegador con las barras de desplazamiento visibles (Playwright las oculta por defecto), con el período completo para que haya barra vertical. F15a y F15b leen `scrollWidth` y `clientWidth` de `.tabla-paros` (y el ancho de la tabla) en las 5 páginas de familia; F15c cuenta las líneas del título \"Hrs Paro Ventana\" con un rango de texto.");
p("- F16 mide el borde inferior de la banda sobre la propia imagen de fondo del lienzo (`plantilla_cabecera.jpg`: primera fila clara bajo la banda oscura, mediana de 3 columnas) y los bordes superiores de la cabecera de la tabla de Resumen, de la cabecera \"Periodo de tiempo\" y del título del gráfico, todo en coordenadas de lienzo. Tolerancia 1.5 px.");
p("- F17 exporta el PDF como invitado desde Simba (01/11 al 20/11/2026, 24 hrs, Mecánica). F17a revisa el nombre de la descarga; F17b usa `pdfinfo`; F17c a F17e convierten las 8 páginas con `pdftoppm` a 144 dpi (2560x1440) y analizan los píxeles con Python (PIL y numpy): una barra de desplazamiento es una franja de gris de la barra (#8a8a8a) de al menos 5 px de ancho y 8 px de alto en coordenadas de lienzo; el navegador se busca como cualquier píxel que no sea blanco en su zona del pie; los enlaces del pie, porque el texto del pie debe quedar como un solo bloque pegado al borde derecho. F17f muestrea el DOM del contenedor de exportación mientras se genera el PDF. F17g es el control del detector: debe encontrar la barra en una captura de la página en pantalla. La imagen de la página 2 está en `docs/pruebas/capturas_e2e/pdf_pagina2.png`.");
p("- F18 lee la tabla `configuracion` de Supabase con la llave anon de `.github/workflows/web.yml` (GET `/rest/v1/configuracion?select=*`), arma el texto \"Data actualizada: ...\" a partir de `periodo_ini` y `periodo_fin` y lo compara con el de la Portada.", "");

const mensualNotas = R.comparaciones.filter((c) => c.visual === "mensual").flatMap((c) => c.notas.map((t) => ({ fixture: c.fixture, t })));
const sumas = mensualNotas.map((x) => /visibles: (\d+); sin mostrar por solape \(hideOverlap\): (\d+)/.exec(x.t)).filter(Boolean).map((m) => ({ vis: +m[1], oc: +m[2] }));
const totVis = sumas.reduce((a, x) => a + x.vis, 0);
const totOc = sumas.reduce((a, x) => a + x.oc, 0);
const q24 = mensualNotas.find((x) => x.fixture === "q_024_0");
const q24m = q24 && /visibles: (\d+); sin mostrar por solape \(hideOverlap\): (\d+)/.exec(q24.t);
p("## Observaciones", "");
p(`- **Etiquetas de Disp Mensual.** La web oculta por solape (\`hideOverlap\`) ${totOc} de las ${totVis + totOc} etiquetas de % de los ${sumas.length} fixtures de Mensual${q24m ? `; en la captura original (\`q_024_0\`) muestra ${q24m[1]} y oculta ${q24m[2]}, mientras que Power BI mostraba 169 de 228 (\`tests/fixtures/powerbi/INDICE.md\`)` : ""}. Los puntos de Disp y Meta se leen de la geometría del SVG y todos coinciden; solo cambia cuántas etiquetas caben, y eso depende del ancho del panel (la cifra exacta cambia en ±2 según lo que se haya recorrido antes en la misma sesión: en una corrida con otros pasos previos por Disp Mensual, \`q_024_0\` mostró 2 etiquetas menos con los mismos valores; por eso las comprobaciones nuevas corren después de la comparación). Es un tema visual, no de valores.`);
p("- **Tabla de paros en el PDF.** En el PDF las tablas no llevan barra y salen solo las filas que caben en su caja: la página 2 (Simba, 01/11 al 20/11/2026) muestra solo las primeras filas de las que tenía la tabla en pantalla (ver F17c). Es el comportamiento descrito en `src/components/lienzo.css`; se anota por si se espera ver todos los paros en el PDF.");
for (const n of R.notas) p(`- ${n}`);
p("");
if (fallas.length) {
  p("## Comprobaciones que fallaron", "");
  for (const f of fallas) {
    p(`### ${f.id}: ${f.nombre}`, "");
    p(`Detalle: ${f.detalle}`, "");
    if (f.id === "F16a") {
      p("Origen: la web, no el script. Medido sobre la imagen de fondo (`plantilla_cabecera.jpg`) y sobre el DOM del lienzo: la banda verde termina en y=108 (filas 0 a 107 oscuras, la 108 ya es blanca), la cabecera \"Periodo de tiempo\" empieza en y=107 (`.seg-cabecera` lleva `margin-top: 1px` sobre la caja de y=106) y la cabecera de la tabla de Resumen empieza en y=106 (la caja `tablaEquipo` de `src/pages/disenos.ts` está en y=106 y `.caja-tabla` ya no tiene margen superior). Así la tabla queda 2 px por encima del borde de la banda (tapa los 2 últimos píxeles de la banda) y 1 px por encima de la cabecera del segmentador; la diferencia de 2 px supera la tolerancia de 1.5 px. Se ve en la captura a 1600x900 como un escalón entre la cabecera de la tabla y la del segmentador. En las páginas de familia el gráfico y el segmentador sí coinciden (ambos en y=107), de modo que la tabla de Resumen necesitaría 1 o 2 px más abajo (por ejemplo, `tablaEquipo` en y=107 o 108).", "");
    }
  }
}

p("## Tiempos", "");
p("| Medición | Tiempo hasta ver números en Resumen |", "|---|---:|");
R.tiempos.resumenMs.forEach((t, i) => p(`| ${i + 1} | ${seg(t)} (${t} ms) |`));
p(`| Promedio | ${seg(R.tiempos.promedioMs)} |`, "");
if (R.tiempos.pdfMs) p(`Exportar PDF (8 páginas, desde que se pulsa el botón hasta que llega la descarga, con los datos ya cargados): ${seg(R.tiempos.pdfMs)}.`, "");
p("Cada medición abre un contexto nuevo del navegador (sin caché) en `#/resumen`, y termina cuando la primera fila de la tabla por equipo tiene MTTR numérico. Incluye descargar el sitio, leer las 5 tablas de Supabase (11 622 paros en varias peticiones) y calcular las medidas. Es un tiempo de punta a punta desde el entorno de pruebas, que sale por un proxy; desde otra red puede variar. En las exploraciones previas a esta corrida (versión publicada anterior y primeros intentos de la versión nueva), la tabla tardó más de 45 s y en un intento más de 240 s en aparecer; no se repitió en las mediciones finales, pero indica que la carga depende mucho de la red y de Supabase.", "");

p("## Selectores que faltan", "");
p("No se modificó `src/`. Estos son los puntos donde no hay un selector estable y qué se usó en su lugar:", "");
for (const s of R.selectoresFaltantes) p(`- ${s}`);
p("");

p("## Cómo repetirlo", "");
p("```", "NODE_PATH=$(npm root -g) node tests/e2e/publicada.mjs   # corre todo y escribe docs/pruebas/resultados_e2e.json", "node tests/e2e/informe.mjs                                # regenera este informe", "```", "");
p("Además de Playwright, F17 usa `pdfinfo` y `pdftoppm` (poppler) y `python3` con PIL y numpy.", "");
p("Variables: `URL_PUBLICADA`, `SOLO=comparacion|funcional`, `SALIDA`, `CAPTURAS`. El script termina con código 1 si hay diferencias o comprobaciones fallidas. Con la carga de datos lenta, los tiempos de espera son de 300 s por página.", "");

fs.writeFileSync(SALIDA, L.join("\n") + "\n");
console.log(`Informe escrito en ${SALIDA}`);
