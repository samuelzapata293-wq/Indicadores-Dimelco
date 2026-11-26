# Informe de pruebas de punta a punta sobre la web publicada

Fecha de ejecución: 2026-11-26. Web: https://samuelzapata293-wq.github.io/Indicadores-Dimelco/ (JS principal `index-BFj2Adwi.js`). Navegador: Chromium 157.0.8103.78, ventana 1600x900, como invitado. Duración de la corrida: 270 s. Script: `tests/e2e/publicada.mjs`; datos crudos: `docs/pruebas/resultados_e2e.json`.

## Resumen

- **Valores comparados contra Power BI: 10 466.** Iguales: **10 466**. Diferencias: **0**.
- Fixtures de Power BI usados: 56 (13 de las capturas originales y 43 de los escenarios a, b, c, c_sindisp, d_conf12, d_conf24, e, f, g_tirolargo y g_sostenimiento).
- **Comprobaciones funcionales: 44 de 45 pasaron.** Fallaron: F16a (detalle más abajo).
- Tiempo desde abrir la web hasta ver números en Resumen (3 mediciones con caché fría): 1.98 s, 1.70 s, 1.70 s; promedio 1.79 s.
- Control negativo: con filtros distintos a los del fixture, la comparación sí detecta diferencias (72 de 144; 630 de 630; 3 de 12; 43 de 126), así que "0 diferencias" no es una comparación vacía.

## Qué se comparó y cómo se leyó cada visual

Para cada fixture se abre la página, se ponen en la interfaz los filtros del fixture (período, Var t: Disp, Var t: Conf., DISP. GLOBAL y familia, leídos del propio fixture) y se lee lo que se ve. Se verifica que la interfaz quedó con esos filtros antes de leer. Los números esperados son los del fixture redondeados como los muestra la app: horas con 2 decimales, Meta y Disponibilidad % sin decimales, Confiabilidad y Probabilidad % con 2 decimales y espacio antes del signo, fechas como `m/d/aaaa h:mm:ss AM/PM`. No se usa tolerancia: el texto debe ser idéntico (mayúsculas y espacios incluidos, salvo espacios repetidos).

Desde esta versión de la web, los gráficos de familia (eje), la columna Equipo de las tablas de paros y los títulos de los paneles de Disp Mensual muestran el **nombre corto** del equipo (`src/pages/nombresCortos.ts`, indexado por id_equipo); Resumen Disp. conserva el nombre completo. El valor esperado se calcula con la misma regla: el script lee el mapa de ese archivo (no lo duplica) y usa `nombreCorto(id, descripción del fixture)`. Las filas de Resumen por equipo y de la tabla de paros se emparejan por id (`IDEQUIPO` y `Sap`); los fixtures de gráfico y de Disp Mensual traen solo la descripción, así que su id sale de los fixtures de Resumen y de paros, que traen id y descripción.

| Visual | De dónde se lee | Valores comparados por fila |
|---|---|---|
| Resumen por equipo | texto de la tabla (`.tabla-resumen`) | 8: equipo, denominación, MTTR, MTBF, Meta, Disp, Confiabilidad, Prob. de falla |
| Resumen por familia | texto de la tabla por familia | 6: familia y las 5 medidas |
| Gráficos de familia | SVG de ECharts: etiquetas del eje (equipo) y de cada serie | 3: nombre corto del equipo, etiqueta Disp %, etiqueta Meta % |
| Tabla de paros | texto de `.tabla-paros`; las filas se emparejan por Sap, aviso, inicio y fin | 9: Sap, Equipo (nombre corto del Sap), Aviso, Descripción, inicio, fin, Hrs Paro Ventana, Responsable, Tipo de Paro; una fila que falte o sobre cuenta como 9 diferencias |
| Disp Mensual | SVG de los paneles: título, etiquetas de semana, puntos y etiquetas de %. Los puntos Disp y Meta se leen de su posición en el SVG (convertida a %), así que quedan comprobados aunque la etiqueta se oculte por solape | por equipo y semana: punto Disp, punto Meta y cada etiqueta visible; más el panel de cada equipo (título con nombre corto) y la etiqueta de cada semana |

## Resultado por escenario y página

### Escenario orig: Capturas originales: 01 al 20/11/2026, 24 h, Mecánica, Conf. 18 h (Mensual 01/07 al 05/11)

Valores comparados: 3 425; iguales: 3 425; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Resumen Disp. | resumen_equipo | `q_001_0` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `q_000_1` | 30 | 30 | 0 |
| Disp Simba | grafico | `q_021_0` | 9 | 9 | 0 |
| Disp Simba | tabla | `q_022_1` | 441 | 441 | 0 |
| Disp Jumbo | grafico | `q_018_0` | 9 | 9 | 0 |
| Disp Jumbo | tabla | `q_017_1` | 531 | 531 | 0 |
| Disp Sostenimiento | grafico | `q_013_0` | 12 | 12 | 0 |
| Disp Sostenimiento | tabla | `q_014_1` | 558 | 558 | 0 |
| Disp Scooptram ST3.5 | grafico | `q_008_0` | 6 | 6 | 0 |
| Disp Scooptram ST3.5 | tabla | `q_010_0` | 639 | 639 | 0 |
| Disp Scooptram ST1030 | grafico | `q_006_0` | 18 | 18 | 0 |
| Disp Scooptram ST1030 | tabla | `q_007_1` | 639 | 639 | 0 |
| Disp Mensual | mensual | `q_024_0` | 389 | 389 | 0 |

### Escenario a: 01 al 20/11/2026, Var t: Disp 18 h, Mecánica, Conf 18 h

Valores comparados: 1 269; iguales: 1 269; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Disp Simba | grafico | `a_grafico_simba` | 9 | 9 | 0 |
| Disp Simba | tabla | `a_tabla_simba` | 441 | 441 | 0 |
| Disp Sostenimiento | grafico | `a_grafico_sostenimiento` | 12 | 12 | 0 |
| Disp Sostenimiento | tabla | `a_tabla_sostenimiento` | 558 | 558 | 0 |
| Disp Mensual | mensual | `a_mensual` | 75 | 75 | 0 |
| Resumen Disp. | resumen_equipo | `a_resumen_equipo` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `a_resumen_familia` | 30 | 30 | 0 |

### Escenario b: 01 al 20/11/2026, 24 h, Operacional

Valores comparados: 585; iguales: 585; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Disp Simba | grafico | `b_grafico_simba` | 9 | 9 | 0 |
| Disp Simba | tabla | `b_tabla_simba` | 189 | 189 | 0 |
| Disp Sostenimiento | grafico | `b_grafico_sostenimiento` | 12 | 12 | 0 |
| Disp Sostenimiento | tabla | `b_tabla_sostenimiento` | 126 | 126 | 0 |
| Disp Mensual | mensual | `b_mensual` | 75 | 75 | 0 |
| Resumen Disp. | resumen_equipo | `b_resumen_equipo` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `b_resumen_familia` | 30 | 30 | 0 |

### Escenario c: 01 al 20/11/2026, 24 h, Mecánica y Operacional

Valores comparados: 1 584; iguales: 1 584; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Disp Simba | grafico | `c_grafico_simba` | 9 | 9 | 0 |
| Disp Simba | tabla | `c_tabla_simba` | 630 | 630 | 0 |
| Disp Sostenimiento | grafico | `c_grafico_sostenimiento` | 12 | 12 | 0 |
| Disp Sostenimiento | tabla | `c_tabla_sostenimiento` | 684 | 684 | 0 |
| Disp Mensual | mensual | `c_mensual` | 75 | 75 | 0 |
| Resumen Disp. | resumen_equipo | `c_resumen_equipo` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `c_resumen_familia` | 30 | 30 | 0 |

### Escenario c_sindisp: 01 al 20/11/2026, 24 h, sin filtro de DISP (incluye los códigos sueltos); solo Resumen

Valores comparados: 174; iguales: 174; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Resumen Disp. | resumen_equipo | `c_sindisp_resumen_equipo` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `c_sindisp_resumen_familia` | 30 | 30 | 0 |

### Escenario d_conf12: 01 al 20/11/2026, 24 h, Mecánica, Var t: Conf. 12 h (solo Resumen)

Valores comparados: 174; iguales: 174; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Resumen Disp. | resumen_equipo | `d_conf12_resumen_equipo` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `d_conf12_resumen_familia` | 30 | 30 | 0 |

### Escenario d_conf24: 01 al 20/11/2026, 24 h, Mecánica, Var t: Conf. 24 h (solo Resumen)

Valores comparados: 174; iguales: 174; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Resumen Disp. | resumen_equipo | `d_conf24_resumen_equipo` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `d_conf24_resumen_familia` | 30 | 30 | 0 |

### Escenario e: Octubre 2026 completo, 24 h, Mecánica, Conf 18 h

Valores comparados: 1 382; iguales: 1 382; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Disp Simba | grafico | `e_grafico_simba` | 9 | 9 | 0 |
| Disp Simba | tabla | `e_tabla_simba` | 531 | 531 | 0 |
| Disp Sostenimiento | grafico | `e_grafico_sostenimiento` | 12 | 12 | 0 |
| Disp Sostenimiento | tabla | `e_tabla_sostenimiento` | 531 | 531 | 0 |
| Disp Mensual | mensual | `e_mensual` | 125 | 125 | 0 |
| Resumen Disp. | resumen_equipo | `e_resumen_equipo` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `e_resumen_familia` | 30 | 30 | 0 |

### Escenario f: 15/09 al 15/10/2026 (cruza meses), 24 h, Mecánica

Valores comparados: 1 176; iguales: 1 176; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Disp Simba | grafico | `f_grafico_simba` | 9 | 9 | 0 |
| Disp Simba | tabla | `f_tabla_simba` | 324 | 324 | 0 |
| Disp Sostenimiento | grafico | `f_grafico_sostenimiento` | 12 | 12 | 0 |
| Disp Sostenimiento | tabla | `f_tabla_sostenimiento` | 531 | 531 | 0 |
| Disp Mensual | mensual | `f_mensual` | 126 | 126 | 0 |
| Resumen Disp. | resumen_equipo | `f_resumen_equipo` | 144 | 144 | 0 |
| Resumen Disp. | resumen_familia | `f_resumen_familia` | 30 | 30 | 0 |

### Escenario g_sostenimiento: Disp Mensual 01/07 al 20/11/2026, familia EQUIPOS DE SOSTENIMIENTO, 24 h, Mecánica

Valores comparados: 296; iguales: 296; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Disp Mensual | mensual | `g_sostenimiento_mensual` | 296 | 296 | 0 |

### Escenario g_tirolargo: Disp Mensual 01/07 al 20/11/2026, familia TIRO LARGO, 24 h, Mecánica

Valores comparados: 227; iguales: 227; diferencias: 0.

| Página | Visual | Fixture | Valores comparados | Iguales | Diferencias |
|---|---|---|---:|---:|---:|
| Disp Mensual | mensual | `g_tirolargo_mensual` | 227 | 227 | 0 |

## Diferencias entre la web y Power BI

**No hay ninguna diferencia** en los valores comparados. Los puntos que conviene dejar claros:

- **Redondeo.** Se compara contra el redondeo de la app (`toFixed` y `Math.round`) y, aparte, contra la mitad hacia arriba que usa Power BI al mostrar. Casos en que los dos redondeos habrían dado un texto distinto: **0**. Ningún valor cae en un empate decimal, así que el redondeo en pantalla no produce ninguna diferencia visible.
- **Valores en blanco.** En los escenarios b (solo Operacional) Power BI devuelve MTTR y MTBF en blanco para los 18 equipos y las 5 familias (no hay fallas mecánicas). La web los muestra como celdas vacías, igual que el fixture (46 valores en blanco comparados, todos coinciden).
- **Disp Mensual.** 8 fixtures de este visual. La web muestra el mismo conjunto de equipos y semanas que el fixture, los puntos de Disp y Meta coinciden y las etiquetas visibles son siempre la Disp o la Meta de su semana.
- **Tablas de paros.** Se compara cada celda de cada fila (Descripción incluida, con las mismas mayúsculas que Power BI). El orden de la tabla de ST1030 en Power BI era por equipo y el de la web es por Hrs Paro Ventana; por eso las filas se emparejan por clave y no por posición. El orden de la web se verifica aparte (F03).

## Comprobaciones funcionales

| Id | Comprobación | Resultado | Detalle |
|---|---|---|---|
| F01a | Filtros encadenados: período, Var t: Disp y DISP de Simba se conservan en Jumbo, Sostenimiento, ST3.5, ST1030 y Resumen | pasa |  |
| F01b | Con los filtros cambiados, Disp % de cada gráfico de familia coincide con la de Resumen | pasa |  |
| F01c | Var t: Conf. de Resumen se conserva al salir y volver | pasa | Var t: Conf. = 12 hrs |
| F01d | Disp Mensual no hereda el período general (Oct 2026 en Simba) | pasa | Mensual muestra 2026-07-01 a 2026-11-20; inicial 2026-07-01 a 2026-11-20 |
| F01e | Disp Mensual comparte Var t: Disp y DISP con el resto (18 hrs y Operacional) | pasa | Var t: Disp 18 hrs, DISP ["Operacional"] |
| F01f | Cambiar el período de Disp Mensual no cambia el período general | pasa | Simba muestra 2026-10-01 a 2026-10-31 |
| F01g | Disp Mensual conserva su período al cambiar el general y volver | pasa | Mensual muestra 2026-08-03 a 2026-11-09 (previo 2026-07-01 a 2026-11-20) |
| F02 | Filtro cruzado: clic en una columna de Simba deja solo ese equipo en la tabla de paros; el segundo clic lo suelta | pasa | opacidad de las columnas tras el clic: ["0.3","0.3"] (equipos con paros: 3; filas totales 49) |
| F03a | Tabla de paros ordenada de mayor a menor Hrs Paro Ventana al abrir | pasa | 49 filas, primera 46.33, última 0.17, aria-sort descending |
| F03b | Clic en la cabecera Hrs Paro Ventana la pasa a ascendente | pasa | primera 0.17, última 46.33 |
| F03c | Clic en la cabecera Equipo ordena la tabla por equipo (ascendente) | pasa | primero "SIMBA S7 N°1", último "SIMBA S7 N°3" |
| F03d | Segundo clic en Equipo invierte el orden (descendente) | pasa | primero "SIMBA S7 N°3", último "SIMBA S7 N°1" |
| F03e | Clic en la cabecera Sap ordena numéricamente (ascendente) | pasa | primero 100618, último 618487 |
| F04 | Portada: 'Data actualizada:' seguido de un rango de fechas válido | pasa | Data actualizada: 01 al 20 de noviembre 2026 |
| F04b | Portada: los 7 botones llevan a su página | pasa |  |
| F05c | Enlaces del pie (Exportar PDF, Ingresar) completos dentro de la ventana | pasa |  |
| F06 | Sin errores de consola, de página ni respuestas HTTP de error durante toda la sesión | pasa |  |
| F07 | Tiempo desde abrir la web hasta ver números en Resumen (3 mediciones) | pasa | 1977 ms, 1704 ms, 1698 ms (informativo; sin umbral) |
| F08a | Un invitado no ve 'Cargar datos' en ninguna página | pasa | enlace "Ingresar" presente: true |
| F08b | #/cargar manda a #/login a un invitado | pasa | destino #/login, formulario de ingreso: true |
| F09 | Control negativo: con filtros distintos a los del fixture, la comparación detecta diferencias | pasa | Resumen por equipo con Var t: Disp 24 h contra el fixture de 18 h: 72 de 144 \| Tabla de paros de Simba con DISP Operacional contra el fixture de Mecánica: 630 de 630 \| Gráfico de Sostenimiento con otro período: 3 de 12 \| Disp Mensual con Var t: Disp 18 h contra el fixture de 24 h: 43 de 126 |
| F10 | Navegador de páginas: recorrido de las 8 páginas con '›' y regreso con '‹' (ruta, texto 'n de 8', extremos deshabilitados) | pasa | 8 páginas, ida con "›" y vuelta con "‹": #/ > #/simba > #/jumbo > #/sostenimiento > #/st35 > #/st1030 > #/resumen > #/mensual; textos "1 de 8" a "8 de 8"; "‹" deshabilitado en la primera y "›" en la última; sin recargar |
| F11 | Filtros conservados al navegar con el navegador de páginas (período, Var t: Disp, DISP, Var t: Conf.; Mensual con lo suyo) | pasa | general 2026-10-05 a 2026-10-25, 18 hrs, Operacional puesto en Simba y conservado en Jumbo, Sostenimiento, ST3.5, ST1030, Resumen y Mensual (ida y vuelta con el navegador); Var t: Conf. 24 hrs de Resumen conservado; Mensual con lo suyo (2026-07-06 a 2026-10-04, familia "CARGADORAS BP FLOTA 3.5") sin tocar el general y conservado al volver |
| F12 | Teclas flecha derecha e izquierda cambian de página (y no actúan en los extremos ni dentro de un campo) | pasa | ArrowRight y ArrowLeft cambian de página; no hacen nada en los extremos, con Ctrl o Shift, ni con el foco en un campo de fecha |
| F13a | Navegador dentro del lienzo y sin solaparse con pie, enlaces, tablas ni gráficos en las 8 páginas a 1600x900 | pasa | 8 páginas a 1600x900: navegador centrado (x 560-720 del lienzo), abajo, dentro del lienzo y sin cruzarse con el texto del pie, los enlaces, tablas, gráficos ni segmentadores (portada y 693-709; simba y 674-690; jumbo y 674-690; sostenimiento y 674-690; st35 y 674-690; st1030 y 674-690; resumen y 704-718; mensual y 674-690) |
| F13b | Navegador dentro del lienzo y sin solaparse con pie, enlaces, tablas ni gráficos en las 8 páginas a 1366x768 | pasa | 8 páginas a 1366x768: navegador centrado (x 560-720 del lienzo), abajo, dentro del lienzo y sin cruzarse con el texto del pie, los enlaces, tablas, gráficos ni segmentadores (portada y 693-709; simba y 674-690; jumbo y 674-690; sostenimiento y 674-690; st35 y 674-690; st1030 y 674-690; resumen y 704-718; mensual y 674-690) |
| F14a | Nombres cortos en el eje de los 5 gráficos de familia (los 18 equipos, ninguno con nombre completo) | pasa | 18 nombres: simba: SIMBA S7 N°1 / SIMBA S7 N°2 / SIMBA S7 N°3 \| jumbo: BOOMER 282 No. 01 / BOOMER 282 No. 02 / BOOMER 282 No. 03 \| sostenimiento: SCALEMIN / SCALEMIN No.2 / BOLTEC N°1 / BOLTEC S10 N°2 \| st35: SCOOP 3.50 N°5 (WAGNER) / SCOOP 3.50 N°6 \| st1030: ST1030 No. 01 / ST1030 No. 02 / ST1030 No. 03 / ST1030 No. 04 / ST1030 No. 05 / ST1030 No. 06 |
| F14b | Columna Equipo de las tablas de paros con el nombre corto (por Sap) en las 5 páginas, con todos los paros del período completo | pasa | simba 2223 filas, 3 equipos; jumbo 1834 filas, 3 equipos; sostenimiento 2290 filas, 4 equipos; st35 3464 filas, 8 equipos; st1030 3464 filas, 8 equipos |
| F14c | Resumen Disp. muestra el nombre completo de los 18 equipos (no el corto) | pasa | 18 equipos, p. ej. "CARGADOR FRONTAL BP SCOOP 3.50 N°5 (WAGNER)" y no "SCOOP 3.50 N°5 (WAGNER)" |
| F14d | Títulos de los paneles de Disp Mensual con nombre corto (todas las familias) | pasa | 18 títulos: CARGADORAS BP: ST1030 No. 01 / ST1030 No. 02 / ST1030 No. 03 / ST1030 No. 04 / ST1030 No. 05 / ST1030 No. 06 \| CARGADORAS BP FLOTA 3.5: SCOOP 3.50 N°5 (WAGNER) / SCOOP 3.50 N°6 \| EQUIPOS DE SOSTENIMIENTO: SCALEMIN / SCALEMIN No.2 / BOLTEC N°1 / BOLTEC S10 N°2 \| PERFORACION MECANIZADA: BOOMER 282 No. 01 / BOOMER 282 No. 02 / BOOMER 282 No. 03 \| TIRO LARGO: SIMBA S7 N°1 / SIMBA S7 N° |
| F15a | Tabla de paros sin barra horizontal (scrollWidth <= clientWidth) en las 5 páginas de familia a 1600x900, con el período completo | pasa | simba: scrollWidth 1260 / clientWidth 1260, 2223 filas, barra vertical sí; jumbo: scrollWidth 1260 / clientWidth 1260, 1834 filas, barra vertical sí; sostenimiento: scrollWidth 1260 / clientWidth 1260, 2290 filas, barra vertical sí; st35: scrollWidth 1260 / clientWidth 1260, 3464 filas, barra vertical sí; st1030: scrollWidth 1260 / clientWidth 1260, 3464 filas, barra vertical sí |
| F15b | Tabla de paros sin barra horizontal (scrollWidth <= clientWidth) en las 5 páginas de familia a 1366x768, con el período completo | pasa | simba: scrollWidth 1260 / clientWidth 1260, 2223 filas, barra vertical sí; jumbo: scrollWidth 1260 / clientWidth 1260, 1834 filas, barra vertical sí; sostenimiento: scrollWidth 1260 / clientWidth 1260, 2290 filas, barra vertical sí; st35: scrollWidth 1260 / clientWidth 1260, 3464 filas, barra vertical sí; st1030: scrollWidth 1260 / clientWidth 1260, 3464 filas, barra vertical sí |
| F15c | Título 'Hrs Paro Ventana' de la tabla de paros en máximo 2 líneas (5 páginas, 1600x900 y 1366x768) | pasa | 10 medidas, todas en 2 líneas; ancho de la columna 78 px de lienzo |
| F16a | Resumen: borde superior de la tabla = borde inferior de la banda = borde superior de 'Periodo de tiempo' (tolerancia 1.5 px de lienzo) | **falla** | cabecera de la tabla de Resumen y=106.00; borde inferior de la banda y=108.00; cabecera 'Periodo de tiempo' y=107.00; mayor diferencia 2.00 px (la tabla por familia empieza en y=546.00) |
| F16b | Páginas de familia: cabecera del gráfico alineada con la del segmentador de período (tolerancia 1.5 px de lienzo) | pasa | simba: gráfico y=107.00, 'Periodo de tiempo' y=107.00; jumbo: gráfico y=107.00, 'Periodo de tiempo' y=107.00; sostenimiento: gráfico y=107.00, 'Periodo de tiempo' y=107.00; st35: gráfico y=107.00, 'Periodo de tiempo' y=107.00; st1030: gráfico y=107.00, 'Periodo de tiempo' y=107.00. Informativo, fuera de la comprobación: en Disp Mensual el título de los paneles está en y=105.00 y 'Periodo de tiempo |
| F17a | Exportar PDF como invitado: descarga con el nombre Indicadores_Dimelco_<desde>_<hasta>.pdf | pasa | archivo "Indicadores_Dimelco_2026-11-01_2026-11-20.pdf" (esperado "Indicadores_Dimelco_2026-11-01_2026-11-20.pdf"), generado y descargado en 9.5 s; filtros fijados: true |
| F17b | El PDF exportado tiene 8 páginas (pdfinfo) | pasa | Pages: 8; tamaño de página 1280 x 720 pts; 3196 KB |
| F17c | Páginas 2 a 8 del PDF sin barras de desplazamiento (píxeles; imagen de la página 2 en capturas_e2e/pdf_pagina2.png) | pasa | 8 páginas convertidas con pdftoppm a 2560x1440; sin barras en ninguna (la tabla de paros de Simba tenía 49 filas en pantalla) |
| F17d | Páginas 2 a 8 del PDF sin el navegador '‹ n de 8 ›' (zona central del pie vacía) | pasa | zona x 560-720 del lienzo, a la altura del pie, en blanco en las 7 páginas |
| F17e | Páginas 2 a 8 del PDF sin los enlaces de sesión (el texto del pie queda como un solo bloque pegado al borde derecho) | pasa | texto del pie en x=1053.5-1271, un solo bloque (hueco máximo 4.5 px); con los enlaces habría un bloque aparte entre x=1150 y 1272 |
| F17f | Durante la generación: enlaces de sesión, botón Exportar PDF, flecha, navegador e indicador de guardado ocultos; tablas con overflow oculto | pasa | 30 muestras con las 8 hojas montadas; 8 navegadores presentes pero ocultos por CSS |
| F17g | Control del detector: encuentra la barra de desplazamiento de la tabla de paros en la captura de la página en pantalla | pasa | barra de 10 columnas x 16.8 px en x=1266.4-1274.4 (captura de Simba con el período completo); en el PDF no aparece ninguna |
| F18 | Portada: 'Data actualizada' igual al período guardado en la tabla configuracion | pasa | configuracion (GET /rest/v1/configuracion, llave anon): periodo_ini 2026-11-01, periodo_fin 2026-11-20; Portada: "Data actualizada: 01 al 20 de noviembre 2026"; esperado: "Data actualizada: 01 al 20 de noviembre 2026" |
| F05_1366 | Las 8 páginas sin scroll de documento a 1366x768 | pasa |  |
| F05_1600 | Las 8 páginas sin scroll de documento a 1600x900 | pasa |  |

Notas de método:

- F01 cambia período, Var t: Disp y DISP en Simba (01/10 al 31/10/2026, 18 hrs, solo Operacional) y llega a las demás páginas con los enlaces de la propia app (flecha de volver y botones de la Portada), no con la URL, para comprobar también la navegación.
- F02 hace clic con el mouse en el centro de la segunda columna del gráfico de Simba. Confirma que la tabla queda solo con ese equipo y con todas sus filas, que las otras columnas se atenúan (opacidad 0.3) y que el segundo clic devuelve las filas originales.
- F04: la Portada muestra "Data actualizada: 01 al 20 de noviembre 2026". El período inicial de Resumen es 2026-11-01 a 2026-11-20 (coincide con la Portada) y el de Disp Mensual 2026-07-01 a 2026-11-20. Disp Mensual no hereda el período general: arranca en su propio rango, distinto al de las demás páginas.
- F05 mide `scrollHeight` y `scrollWidth` del documento en las 8 páginas (Portada y 7 de tablero) a 1600x900 y a 1366x768. Las capturas de las 8 páginas a 1600x900, con los filtros iniciales, quedaron en `docs/pruebas/capturas_e2e/`.
- F06 recoge `console.error`, errores de página, peticiones fallidas y respuestas HTTP 4xx o 5xx de toda la sesión (también la del segundo navegador de F15 y F17).
- F09 es el control negativo descrito en el resumen.
- F10 va de la Portada a Disp Mensual con el botón "Página siguiente" (›) y regresa con "Página anterior" (‹). En cada paso verifica la ruta (el orden se lee de `src/pages/ordenPaginas.ts`), el texto "n de 8", que ‹ esté deshabilitado en la primera página y › en la última, y que no se haya recargado la página (una marca en `window` sobrevive al recorrido).
- F11 pone en Simba un período (05/10 al 25/10/2026), Var t: Disp 18 hrs y DISP Operacional distintos a los que tenía la sesión, avanza con › por Jumbo, Sostenimiento, ST3.5, ST1030, Resumen y Mensual y regresa con ‹ comprobando en cada página los filtros compartidos. En Resumen cambia Var t: Conf. y en Mensual su propio período (06/07 al 04/10/2026) y su familia: el período general no cambia, Mensual conserva lo suyo al volver y Var t: Conf. se conserva.
- F12 pulsa ArrowRight y ArrowLeft con el foco fuera de los campos, y comprueba que no hacen nada en la Portada (←), en Disp Mensual (→), con Ctrl o Shift, ni con el foco en el campo de fecha Desde (que además conserva su valor).
- F13 mide en coordenadas de lienzo (1280x720) la caja del navegador (`nav.nav-paginas`) y la cruza con el texto del pie (por rango de texto), los enlaces del pie, las tablas, los gráficos, los paneles y ejes de Mensual, los segmentadores y, en la Portada, la fecha, los botones y el título. Pide que quede dentro del lienzo, centrado (x=640) y abajo, sin solape de más de 0.5 px.
- F14 usa el período completo de los datos (límites de los campos de fecha), 24 hrs y Mecánica más Operacional para que las tablas lleven todos los paros. F14a compara los nombres del eje de los 5 gráficos con el nombre corto de cada equipo (id y denominación salen de la tabla de Resumen) y exige que entre los 5 aparezcan los 18. F14b exige que en cada fila de las tablas de paros la columna Equipo sea el nombre corto del Sap de esa fila. F14c exige en Resumen el nombre completo de los 18. F14d recorre las 5 familias de Disp Mensual y exige que los 18 títulos sean nombres cortos.
- F15 y F17 corren en un segundo navegador con las barras de desplazamiento visibles (Playwright las oculta por defecto), con el período completo para que haya barra vertical. F15a y F15b leen `scrollWidth` y `clientWidth` de `.tabla-paros` (y el ancho de la tabla) en las 5 páginas de familia; F15c cuenta las líneas del título "Hrs Paro Ventana" con un rango de texto.
- F16 mide el borde inferior de la banda sobre la propia imagen de fondo del lienzo (`plantilla_cabecera.jpg`: primera fila clara bajo la banda oscura, mediana de 3 columnas) y los bordes superiores de la cabecera de la tabla de Resumen, de la cabecera "Periodo de tiempo" y del título del gráfico, todo en coordenadas de lienzo. Tolerancia 1.5 px.
- F17 exporta el PDF como invitado desde Simba (01/11 al 20/11/2026, 24 hrs, Mecánica). F17a revisa el nombre de la descarga; F17b usa `pdfinfo`; F17c a F17e convierten las 8 páginas con `pdftoppm` a 144 dpi (2560x1440) y analizan los píxeles con Python (PIL y numpy): una barra de desplazamiento es una franja de gris de la barra (#8a8a8a) de al menos 5 px de ancho y 8 px de alto en coordenadas de lienzo; el navegador se busca como cualquier píxel que no sea blanco en su zona del pie; los enlaces del pie, porque el texto del pie debe quedar como un solo bloque pegado al borde derecho. F17f muestrea el DOM del contenedor de exportación mientras se genera el PDF. F17g es el control del detector: debe encontrar la barra en una captura de la página en pantalla. La imagen de la página 2 está en `docs/pruebas/capturas_e2e/pdf_pagina2.png`.
- F18 lee la tabla `configuracion` de Supabase con la llave anon de `.github/workflows/web.yml` (GET `/rest/v1/configuracion?select=*`), arma el texto "Data actualizada: ..." a partir de `periodo_ini` y `periodo_fin` y lo compara con el de la Portada.

## Observaciones

- **Etiquetas de Disp Mensual.** La web oculta por solape (`hideOverlap`) 235 de las 750 etiquetas de % de los 8 fixtures de Mensual; en la captura original (`q_024_0`) muestra 136 y oculta 92, mientras que Power BI mostraba 169 de 228 (`tests/fixtures/powerbi/INDICE.md`). Los puntos de Disp y Meta se leen de la geometría del SVG y todos coinciden; solo cambia cuántas etiquetas caben, y eso depende del ancho del panel (la cifra exacta cambia en ±2 según lo que se haya recorrido antes en la misma sesión: en una corrida con otros pasos previos por Disp Mensual, `q_024_0` mostró 2 etiquetas menos con los mismos valores; por eso las comprobaciones nuevas corren después de la comparación). Es un tema visual, no de valores.
- **Tabla de paros en el PDF.** En el PDF las tablas no llevan barra y salen solo las filas que caben en su caja: la página 2 (Simba, 01/11 al 20/11/2026) muestra solo las primeras filas de las que tenía la tabla en pantalla (ver F17c). Es el comportamiento descrito en `src/components/lienzo.css`; se anota por si se espera ver todos los paros en el PDF.

## Comprobaciones que fallaron

### F16a: Resumen: borde superior de la tabla = borde inferior de la banda = borde superior de 'Periodo de tiempo' (tolerancia 1.5 px de lienzo)

Detalle: cabecera de la tabla de Resumen y=106.00; borde inferior de la banda y=108.00; cabecera 'Periodo de tiempo' y=107.00; mayor diferencia 2.00 px (la tabla por familia empieza en y=546.00)

Origen: la web, no el script. Medido sobre la imagen de fondo (`plantilla_cabecera.jpg`) y sobre el DOM del lienzo: la banda verde termina en y=108 (filas 0 a 107 oscuras, la 108 ya es blanca), la cabecera "Periodo de tiempo" empieza en y=107 (`.seg-cabecera` lleva `margin-top: 1px` sobre la caja de y=106) y la cabecera de la tabla de Resumen empieza en y=106 (la caja `tablaEquipo` de `src/pages/disenos.ts` está en y=106 y `.caja-tabla` ya no tiene margen superior). Así la tabla queda 2 px por encima del borde de la banda (tapa los 2 últimos píxeles de la banda) y 1 px por encima de la cabecera del segmentador; la diferencia de 2 px supera la tolerancia de 1.5 px. Se ve en la captura a 1600x900 como un escalón entre la cabecera de la tabla y la del segmentador. En las páginas de familia el gráfico y el segmentador sí coinciden (ambos en y=107), de modo que la tabla de Resumen necesitaría 1 o 2 px más abajo (por ejemplo, `tablaEquipo` en y=107 o 108).

## Tiempos

| Medición | Tiempo hasta ver números en Resumen |
|---|---:|
| 1 | 1.98 s (1977 ms) |
| 2 | 1.70 s (1704 ms) |
| 3 | 1.70 s (1698 ms) |
| Promedio | 1.79 s |

Cada medición abre un contexto nuevo del navegador (sin caché) en `#/resumen`, y termina cuando la primera fila de la tabla por equipo tiene MTTR numérico. Incluye descargar el sitio, leer las 5 tablas de Supabase (11 622 paros en varias peticiones) y calcular las medidas. Es un tiempo de punta a punta desde el entorno de pruebas, que sale por un proxy; desde otra red puede variar. En las exploraciones previas a esta corrida (versión publicada anterior y primeros intentos de la versión nueva), la tabla tardó más de 45 s y en un intento más de 240 s en aparecer; no se repitió en las mediciones finales, pero indica que la carga depende mucho de la red y de Supabase.

## Selectores que faltan

No se modificó `src/`. Estos son los puntos donde no hay un selector estable y qué se usó en su lugar:

- Periodo de tiempo: los dos input[type=date] tienen aria-label 'Desde' y 'Hasta' (estables); la sección que los contiene no tiene role ni nombre.
- Tablas: tienen aria-label (Tabla de paros, Resumen por equipo, Resumen por familia); la de familia usa la clase .tabla-familia.
- Gráfico de columnas: el contenedor tiene role=img y aria-label, pero los números solo existen dentro del SVG de ECharts, sin data-attributes. Se distinguen las series por el color del texto (#252423 Disp, #fff Meta) y el equipo por la posición x del eje.
- Disp Mensual: sin data-attributes en los puntos. Se leen los círculos del SVG por su relleno (#D9B300 Disp, #12239E Meta) y se convierte la posición y a % con la calibración del eje de PanelesSemanales.tsx (arriba 40 px, abajo 13 px, máximo 1.06). Si cambian esos márgenes la comparación de puntos hay que recalibrarla.
- Portada: el rango de fechas se lee de .portada-fecha y los botones de .portada-boton (clases, sin data-testid); la flecha de volver es a.lienzo-volver (tiene aria-label 'Volver a Portada').

## Cómo repetirlo

```
NODE_PATH=$(npm root -g) node tests/e2e/publicada.mjs   # corre todo y escribe docs/pruebas/resultados_e2e.json
node tests/e2e/informe.mjs                                # regenera este informe
```

Además de Playwright, F17 usa `pdfinfo` y `pdftoppm` (poppler) y `python3` con PIL y numpy.

Variables: `URL_PUBLICADA`, `SOLO=comparacion|funcional`, `SALIDA`, `CAPTURAS`. El script termina con código 1 si hay diferencias o comprobaciones fallidas. Con la carga de datos lenta, los tiempos de espera son de 300 s por página.

