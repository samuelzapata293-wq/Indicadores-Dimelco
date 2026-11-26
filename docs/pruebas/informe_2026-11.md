# Informe de pruebas de punta a punta sobre la web publicada

Fecha de ejecución: 2026-11-26. Web: https://samuelzapata293-wq.github.io/Indicadores-Dimelco/ (JS principal `index-1enDnb4W.js`). Navegador: Chromium 157.0.8103.78, ventana 1600x900, como invitado. Duración de la corrida: 141 s. Script: `tests/e2e/publicada.mjs`; datos crudos: `docs/pruebas/resultados_e2e.json`.

## Resumen

- **Valores comparados contra Power BI: 10 466.** Iguales: **10 466**. Diferencias: **0**.
- Fixtures de Power BI usados: 56 (13 de las capturas originales y 43 de los escenarios a, b, c, c_sindisp, d_conf12, d_conf24, e, f, g_tirolargo y g_sostenimiento).
- **Comprobaciones funcionales: 23 de 23 pasaron.** No falló ninguna.
- Tiempo desde abrir la web hasta ver números en Resumen (3 mediciones con caché fría): 3.37 s, 1.90 s, 1.81 s; promedio 2.36 s.
- Control negativo: con filtros distintos a los del fixture, la comparación sí detecta diferencias (72 de 144; 630 de 630; 3 de 12; 43 de 126), así que "0 diferencias" no es una comparación vacía.

## Qué se comparó y cómo se leyó cada visual

Para cada fixture se abre la página, se ponen en la interfaz los filtros del fixture (período, Var t: Disp, Var t: Conf., DISP. GLOBAL y familia, leídos del propio fixture) y se lee lo que se ve. Se verifica que la interfaz quedó con esos filtros antes de leer. Los números esperados son los del fixture redondeados como los muestra la app: horas con 2 decimales, Meta y Disponibilidad % sin decimales, Confiabilidad y Probabilidad % con 2 decimales y espacio antes del signo, fechas como `m/d/aaaa h:mm:ss AM/PM`. No se usa tolerancia: el texto debe ser idéntico (mayúsculas y espacios incluidos, salvo espacios repetidos).

| Visual | De dónde se lee | Valores comparados por fila |
|---|---|---|
| Resumen por equipo | texto de la tabla (`.tabla-resumen`) | 8: equipo, denominación, MTTR, MTBF, Meta, Disp, Confiabilidad, Prob. de falla |
| Resumen por familia | texto de la tabla por familia | 6: familia y las 5 medidas |
| Gráficos de familia | SVG de ECharts: etiquetas del eje (equipo) y de cada serie | 3: equipo, etiqueta Disp %, etiqueta Meta % |
| Tabla de paros | texto de `.tabla-paros`; las filas se emparejan por Sap, aviso, inicio y fin | 9: Sap, Equipo, Aviso, Descripción, inicio, fin, Hrs Paro Ventana, Responsable, Tipo de Paro; una fila que falte o sobre cuenta como 9 diferencias |
| Disp Mensual | SVG de los paneles: título, etiquetas de semana, puntos y etiquetas de %. Los puntos Disp y Meta se leen de su posición en el SVG (convertida a %), así que quedan comprobados aunque la etiqueta se oculte por solape | por equipo y semana: punto Disp, punto Meta y cada etiqueta visible; más panel por equipo y etiqueta de cada semana |

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
| F04 | Portada: 'Data actualizada:' seguido de un rango de fechas válido | pasa | Data actualizada: 01 al 20 de noviembre 2026 |
| F04b | Portada: los 7 botones llevan a su página | pasa |  |
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
| F03c | Clic en la cabecera Equipo ordena la tabla por equipo (ascendente) | pasa | primero "JUMBO DE PERFORACION ATLAS SIMBA S7 N°1", último "JUMBO DE PERFORACION ATLAS SIMBA S7 N°3" |
| F03d | Segundo clic en Equipo invierte el orden (descendente) | pasa | primero "JUMBO DE PERFORACION ATLAS SIMBA S7 N°3", último "JUMBO DE PERFORACION ATLAS SIMBA S7 N°1" |
| F03e | Clic en la cabecera Sap ordena numéricamente (ascendente) | pasa | primero 100618, último 618487 |
| F05_1600 | Las 8 páginas sin scroll de documento a 1600x900 | pasa |  |
| F05_1366 | Las 8 páginas sin scroll de documento a 1366x768 | pasa |  |
| F05c | Enlaces del pie (Exportar PDF, Ingresar) completos dentro de la ventana | pasa |  |
| F08a | Un invitado no ve 'Cargar datos' en ninguna página | pasa | enlace "Ingresar" presente: true |
| F08b | #/cargar manda a #/login a un invitado | pasa | destino #/login, formulario de ingreso: true |
| F09 | Control negativo: con filtros distintos a los del fixture, la comparación detecta diferencias | pasa | Resumen por equipo con Var t: Disp 24 h contra el fixture de 18 h: 72 de 144 \| Tabla de paros de Simba con DISP Operacional contra el fixture de Mecánica: 630 de 630 \| Gráfico de Sostenimiento con otro período: 3 de 12 \| Disp Mensual con Var t: Disp 18 h contra el fixture de 24 h: 43 de 126 |
| F06 | Sin errores de consola, de página ni respuestas HTTP de error durante toda la sesión | pasa |  |
| F07 | Tiempo desde abrir la web hasta ver números en Resumen (3 mediciones) | pasa | 3373 ms, 1904 ms, 1815 ms (informativo; sin umbral) |

Notas de método:

- F01 cambia período, Var t: Disp y DISP en Simba (01/10 al 31/10/2026, 18 hrs, solo Operacional) y llega a las demás páginas con los enlaces de la app (flecha de volver y botones de la Portada), no con la URL, para comprobar también la navegación.
- F02 hace clic con el mouse en el centro de la segunda columna del gráfico de Simba. Confirma que la tabla queda solo con ese equipo y con todas sus filas, que las otras columnas se atenúan (opacidad 0.3) y que el segundo clic devuelve las filas originales.
- F04: la Portada muestra "Data actualizada: 01 al 20 de noviembre 2026". El período inicial de Resumen es 2026-11-01 a 2026-11-20 (coincide con la Portada) y el de Disp Mensual 2026-07-01 a 2026-11-20. Disp Mensual no hereda el período general: arranca en su propio rango, distinto al de las demás páginas.
- F05 mide `scrollHeight` y `scrollWidth` del documento en las 8 páginas (Portada y 7 de tablero) a 1600x900 y a 1366x768. Las capturas de las 8 páginas a 1600x900, con los filtros iniciales, quedaron en `docs/pruebas/capturas_e2e/`.
- F06 recoge `console.error`, errores de página, peticiones fallidas y respuestas HTTP 4xx o 5xx de toda la sesión.
- F09 es el control negativo descrito en el resumen.

## Tiempos

| Medición | Tiempo hasta ver números en Resumen |
|---|---:|
| 1 | 3.37 s (3373 ms) |
| 2 | 1.90 s (1904 ms) |
| 3 | 1.81 s (1815 ms) |
| Promedio | 2.36 s |

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

Variables: `URL_PUBLICADA`, `SOLO=comparacion|funcional`, `SALIDA`, `CAPTURAS`. El script termina con código 1 si hay diferencias o comprobaciones fallidas. Con la carga de datos lenta, los tiempos de espera son de 300 s por página.

