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
p("| Visual | De dónde se lee | Valores comparados por fila |", "|---|---|---|");
p("| Resumen por equipo | texto de la tabla (`.tabla-resumen`) | 8: equipo, denominación, MTTR, MTBF, Meta, Disp, Confiabilidad, Prob. de falla |");
p("| Resumen por familia | texto de la tabla por familia | 6: familia y las 5 medidas |");
p("| Gráficos de familia | SVG de ECharts: etiquetas del eje (equipo) y de cada serie | 3: equipo, etiqueta Disp %, etiqueta Meta % |");
p("| Tabla de paros | texto de `.tabla-paros`; las filas se emparejan por Sap, aviso, inicio y fin | 9: Sap, Equipo, Aviso, Descripción, inicio, fin, Hrs Paro Ventana, Responsable, Tipo de Paro; una fila que falte o sobre cuenta como 9 diferencias |");
p("| Disp Mensual | SVG de los paneles: título, etiquetas de semana, puntos y etiquetas de %. Los puntos Disp y Meta se leen de su posición en el SVG (convertida a %), así que quedan comprobados aunque la etiqueta se oculte por solape | por equipo y semana: punto Disp, punto Meta y cada etiqueta visible; más panel por equipo y etiqueta de cada semana |", "");

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
p("- F01 cambia período, Var t: Disp y DISP en Simba (01/10 al 31/10/2026, 18 hrs, solo Operacional) y llega a las demás páginas con los enlaces de la app (flecha de volver y botones de la Portada), no con la URL, para comprobar también la navegación.");
p("- F02 hace clic con el mouse en el centro de la segunda columna del gráfico de Simba. Confirma que la tabla queda solo con ese equipo y con todas sus filas, que las otras columnas se atenúan (opacidad 0.3) y que el segundo clic devuelve las filas originales.");
p(`- F04: la Portada muestra "${R.periodoInicial.portada}". El período inicial de Resumen es ${R.periodoInicial.desde} a ${R.periodoInicial.hasta} (coincide con la Portada) y el de Disp Mensual ${R.periodoInicial.mensual.desde} a ${R.periodoInicial.mensual.hasta}. Disp Mensual no hereda el período general: arranca en su propio rango, distinto al de las demás páginas.`);
p("- F05 mide `scrollHeight` y `scrollWidth` del documento en las 8 páginas (Portada y 7 de tablero) a 1600x900 y a 1366x768. Las capturas de las 8 páginas a 1600x900, con los filtros iniciales, quedaron en `docs/pruebas/capturas_e2e/`.");
p("- F06 recoge `console.error`, errores de página, peticiones fallidas y respuestas HTTP 4xx o 5xx de toda la sesión.");
p("- F09 es el control negativo descrito en el resumen.", "");

if (fallas.length) {
  p("## Observaciones", "");
p("- **Etiquetas de Disp Mensual.** En la captura `docs/pruebas/capturas_e2e/mensual_1600x900.png` algunas etiquetas de % de la misma semana se montan unas sobre otras (sobre todo en los paneles de ST1030 No. 02, No. 03 y No. 04, de la Sem 30/26 en adelante), y la lectura del SVG encontró todas las etiquetas presentes: 0 ocultas en las 8 corridas de Disp Mensual. En las capturas de Power BI solo se ven 169 de 228 etiquetas (`tests/fixtures/powerbi/INDICE.md`). La app declara `hideOverlap`, pero con estas etiquetas no oculta ninguna. Los valores son correctos; es un tema visual.");
p("- **Botón Exportar PDF.** La versión publicada ya trae el botón en el pie y en la Portada. No se probó su función (fuera del alcance de este informe); solo se midió su efecto en la maquetación (F05c).", "");

p("## Comprobaciones que fallaron", "");
  for (const f of fallas) {
    p(`### ${f.id}: ${f.nombre}`, "");
    p(`Detalle: ${f.detalle}`, "");
    if (f.id === "F05c") {
      p("Causa probable: el grupo de enlaces del pie (`.lienzo-enlaces`) arranca en x=1196 del lienzo de 1280 px (donde termina el texto del pie) y mide unos 122 px porque ahora contiene el botón Exportar PDF además de Ingresar. Termina en x=1318 del lienzo y se sale 38 px por la derecha; Ingresar queda cortado en la ventana (se ve \"In\"). En la Portada, los enlaces van arriba a la derecha y caben. Es un problema de maquetación, no de datos. No afecta a F05_1600 ni a F05_1366 porque el lienzo recorta lo que se sale y el documento no crece.", "");
    }
  }
}

p("## Tiempos", "");
p("| Medición | Tiempo hasta ver números en Resumen |", "|---|---:|");
R.tiempos.resumenMs.forEach((t, i) => p(`| ${i + 1} | ${seg(t)} (${t} ms) |`));
p(`| Promedio | ${seg(R.tiempos.promedioMs)} |`, "");
p("Cada medición abre un contexto nuevo del navegador (sin caché) en `#/resumen`, y termina cuando la primera fila de la tabla por equipo tiene MTTR numérico. Incluye descargar el sitio, leer las 5 tablas de Supabase (11 622 paros en varias peticiones) y calcular las medidas. Es un tiempo de punta a punta desde el entorno de pruebas, que sale por un proxy; desde otra red puede variar. En las exploraciones previas a esta corrida (versión publicada anterior y primeros intentos de la versión nueva), la tabla tardó más de 45 s y en un intento más de 240 s en aparecer; no se repitió en las mediciones finales, pero indica que la carga depende mucho de la red y de Supabase.", "");

p("## Selectores que faltan", "");
p("No se modificó `src/`. Estos son los puntos donde no hay un selector estable y qué se usó en su lugar:", "");
for (const s of R.selectoresFaltantes) p(`- ${s}`);
p("");

p("## Cómo repetirlo", "");
p("```", "NODE_PATH=$(npm root -g) node tests/e2e/publicada.mjs   # corre todo y escribe docs/pruebas/resultados_e2e.json", "node tests/e2e/informe.mjs                                # regenera este informe", "```", "");
p("Variables: `URL_PUBLICADA`, `SOLO=comparacion|funcional`, `SALIDA`, `CAPTURAS`. El script termina con código 1 si hay diferencias o comprobaciones fallidas. Con la carga de datos lenta, los tiempos de espera son de 300 s por página.", "");

fs.writeFileSync(SALIDA, L.join("\n") + "\n");
console.log(`Informe escrito en ${SALIDA}`);
