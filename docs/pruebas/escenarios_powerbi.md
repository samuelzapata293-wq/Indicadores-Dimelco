# Escenarios de filtros nuevos: motor de medidas contra Power BI

Cada escenario es una consulta real al reporte público de Power BI con filtros distintos a los de la captura original. Los valores de Power BI están en `tests/fixtures/powerbi_escenarios/` y el motor (`src/medidas/`) se compara con ellos en `tests/medidas/escenarios.test.ts`.

**Resultado: 43 consultas, 985 filas de Power BI, 2745 valores comparados, 2745 coincidencias, 0 diferencias.** La diferencia máxima fue 1.11e-16 en fracciones (tolerancia 0.0001) y 0 en horas (tolerancia 0.01). Los resultados son idénticos con la muestra (`tests/fixtures/datos/muestra.json`) y con el Excel real (`datos_local/LIBRO_MAESTRO_15-09-2026.xlsx`, 11 622 paros).

## Cómo se obtuvieron los datos

Reenvío directo, sin token de sesión. `POST https://wabi-west-us-e-primary-api.analysis.windows.net/public/reports/querydata?synchronous=true` con el encabezado `X-PowerBI-ResourceKey` del enlace público (más `ActivityId` y `RequestId` generados) acepta la consulta semántica tal como la manda la página. No hizo falta Playwright.

`tools/consultar_powerbi.py` toma una consulta de `docs/powerbi/querydata/q_NNN.json`, cambia solo estos filtros del `Where` y regenera el `CacheKey`:

- rango de `DIM_TIEMPO[Fecha]` (`>= inicio` y `< fin + 1 día`, como guarda el reporte);
- `HECHOS_DATAMES_NPI_PP[DISP]`;
- `Var_t: Disp[Var_t: Disp]` y `Confiabilidad[Confiabilidad]`;
- `DIM_EQUIPOS[Familia]`.

**Prueba previa de reenvío sin cambios.** Se reenviaron `q_001` #0 (resumen por equipo), `q_022` #1 (tabla de paros de Simba) y `q_024` #0 (Disp Mensual) sin tocar nada. Las tres devolvieron exactamente las mismas filas que la respuesta capturada (18, 49 y 114 filas, 0 diferencias) y el `CacheKey` regenerado por el script es idéntico, byte a byte, al capturado. Se puede repetir con `python3 -I tools/consultar_powerbi.py verificar q_001:0 q_022:1 q_024:0`.

**Cuidado con el servicio.** Una consulta por escenario y visual (43 en total, más 3 de la prueba previa), una sola vez cada una, con 4 segundos de pausa entre ellas. Ante cualquier error el script se detiene y no reintenta. Los archivos ya obtenidos se omiten salvo con `--forzar`.

**Forma de los filtros.** `Mecánica` se envía como la página lo hace en las capturas: `DISP NOT IN ('Operacional')`. `Operacional` y `Mecánica y Operacional` se envían como `IN (...)`. El escenario extra `c_sindisp` quita el filtro de DISP.

## Corrección en la decodificación (importante)

Al decodificar las respuestas de Disp Mensual aparecieron 17 valores en blanco que el motor sí calculaba (por ejemplo, la meta de ST1030 No. 05 en `a_mensual`: Power BI "esperado null", motor 0.7308). No era una diferencia del motor sino un error de `tools/decodificar_querydata.py`: en una matriz (semana x equipo) el bit `R` ("igual a la fila anterior") de la primera fila de un equipo se refiere a la última fila del equipo anterior, y el decodificador reinicia la fila previa en cada grupo, así que entrega nulo en lugar del valor repetido. En la respuesta cruda de `a_mensual` se ve: la fila `Sem 45/26` de ST1030 No. 05 trae `"R": 8` (repite la columna Meta) y no trae la meta, que es la de la última semana de ST1030 No. 04 (0.7308).

`tools/consultar_powerbi.py` incluye una subclase `DecodificadorCorregido` que conserva la fila previa por nivel durante todo el DS. Con ella se decodificaron los fixtures de escenarios (`python3 -I tools/consultar_powerbi.py redecodificar` vuelve a decodificar lo guardado sin consultar de nuevo). Efecto: `a_mensual` 3 valores, `b_mensual` 10, `c_mensual` 3 y `f_mensual` 1. Las 34 respuestas capturadas originales (`q_000` a `q_026`) decodifican igual con ambas versiones, así que los fixtures de `tests/fixtures/powerbi/` no cambian. `tools/decodificar_querydata.py` no se modificó (fuera del alcance de esta tarea); conviene aplicarle la misma corrección para que futuras capturas de matrices no tengan este problema.

## Resultados por escenario y visual

Los valores comparados por visual son:

- Resumen por equipo: MTTR, MTBF, Meta_Disp, Disp Din %, Confiabilidad, Probabilidad de falla, Brecha y descripción de cada equipo.
- Resumen por familia: MTTR, MTBF, Disp Din %, Confiabilidad y Probabilidad de falla.
- Gráficos: Disp Din %, Meta_Disp y color de cada columna, más el conjunto de equipos.
- Tablas de paros: el número de filas, que cada fila de Power BI exista en el motor (Sap, equipo, aviso, descripción, inicio, fin, responsable y tipo de paro) y su Hrs Paro Ventana (un valor por fila); además no puede sobrar ninguna fila en el motor.
- Disp Mensual: Disp Din %, Meta_Disp y orden de la semana, por equipo y semana.

Las cifras son las mismas con la muestra y con el Excel real.

### Escenario a: 01 al 20/11/2026, Var t: Disp 18 h, Mecánica, Conf. 18 h

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Resumen por equipo | `a_resumen_equipo.json` | 18 | 144 | 144 | 1.11e-16 | 0 | coincide |
| Resumen por familia | `a_resumen_familia.json` | 5 | 25 | 25 | 1.11e-16 | 0 | coincide |
| Gráfico Disp Simba | `a_grafico_simba.json` | 3 | 9 | 9 | 0 | 0 | coincide |
| Tabla de paros Disp Simba | `a_tabla_simba.json` | 49 | 49 | 49 | 0 | 0 | coincide |
| Gráfico Disp Sostenimiento | `a_grafico_sostenimiento.json` | 4 | 12 | 12 | 0 | 0 | coincide |
| Tabla de paros Disp Sostenimiento | `a_tabla_sostenimiento.json` | 62 | 62 | 62 | 0 | 0 | coincide |
| Disp Mensual (equipo x semana) | `a_mensual.json` | 18 | 54 | 54 | 0 | 0 | coincide |

### Escenario b: 01 al 20/11/2026, 24 h, Operacional (DISP IN Operacional)

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Resumen por equipo | `b_resumen_equipo.json` | 18 | 144 | 144 | 0 | 0 | coincide |
| Resumen por familia | `b_resumen_familia.json` | 5 | 25 | 25 | 0 | 0 | coincide |
| Gráfico Disp Simba | `b_grafico_simba.json` | 3 | 9 | 9 | 0 | 0 | coincide |
| Tabla de paros Disp Simba | `b_tabla_simba.json` | 21 | 21 | 21 | 0 | 0 | coincide |
| Gráfico Disp Sostenimiento | `b_grafico_sostenimiento.json` | 4 | 12 | 12 | 0 | 0 | coincide |
| Tabla de paros Disp Sostenimiento | `b_tabla_sostenimiento.json` | 14 | 14 | 14 | 0 | 0 | coincide |
| Disp Mensual (equipo x semana) | `b_mensual.json` | 18 | 54 | 54 | 0 | 0 | coincide |

### Escenario c: 01 al 20/11/2026, 24 h, Mecánica y Operacional (DISP IN Mecánica, Operacional)

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Resumen por equipo | `c_resumen_equipo.json` | 18 | 144 | 144 | 1.11e-16 | 0 | coincide |
| Resumen por familia | `c_resumen_familia.json` | 5 | 25 | 25 | 0 | 0 | coincide |
| Gráfico Disp Simba | `c_grafico_simba.json` | 3 | 9 | 9 | 0 | 0 | coincide |
| Tabla de paros Disp Simba | `c_tabla_simba.json` | 70 | 70 | 70 | 0 | 0 | coincide |
| Gráfico Disp Sostenimiento | `c_grafico_sostenimiento.json` | 4 | 12 | 12 | 0 | 0 | coincide |
| Tabla de paros Disp Sostenimiento | `c_tabla_sostenimiento.json` | 76 | 76 | 76 | 0 | 0 | coincide |
| Disp Mensual (equipo x semana) | `c_mensual.json` | 18 | 54 | 54 | 0 | 0 | coincide |

### Escenario c_sindisp: Extra: 01 al 20/11/2026, 24 h, sin filtro de DISP (solo Resumen)

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Resumen por equipo | `c_sindisp_resumen_equipo.json` | 18 | 144 | 144 | 1.11e-16 | 0 | coincide |
| Resumen por familia | `c_sindisp_resumen_familia.json` | 5 | 25 | 25 | 0 | 0 | coincide |

### Escenario d_conf12: 01 al 20/11/2026, 24 h, Mecánica, Var t: Conf. 12 h (solo Resumen)

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Resumen por equipo | `d_conf12_resumen_equipo.json` | 18 | 144 | 144 | 1.11e-16 | 0 | coincide |
| Resumen por familia | `d_conf12_resumen_familia.json` | 5 | 25 | 25 | 0 | 0 | coincide |

### Escenario d_conf24: 01 al 20/11/2026, 24 h, Mecánica, Var t: Conf. 24 h (solo Resumen)

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Resumen por equipo | `d_conf24_resumen_equipo.json` | 18 | 144 | 144 | 1.11e-16 | 0 | coincide |
| Resumen por familia | `d_conf24_resumen_familia.json` | 5 | 25 | 25 | 0 | 0 | coincide |

### Escenario e: Octubre 2026 completo (01 al 31/10), 24 h, Mecánica, Conf. 18 h

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Resumen por equipo | `e_resumen_equipo.json` | 18 | 144 | 144 | 1.11e-16 | 0 | coincide |
| Resumen por familia | `e_resumen_familia.json` | 5 | 25 | 25 | 1.11e-16 | 0 | coincide |
| Gráfico Disp Simba | `e_grafico_simba.json` | 3 | 9 | 9 | 0 | 0 | coincide |
| Tabla de paros Disp Simba | `e_tabla_simba.json` | 59 | 59 | 59 | 0 | 0 | coincide |
| Gráfico Disp Sostenimiento | `e_grafico_sostenimiento.json` | 4 | 12 | 12 | 0 | 0 | coincide |
| Tabla de paros Disp Sostenimiento | `e_tabla_sostenimiento.json` | 59 | 59 | 59 | 0 | 0 | coincide |
| Disp Mensual (equipo x semana) | `e_mensual.json` | 30 | 90 | 90 | 0 | 0 | coincide |

### Escenario f: 15/09 al 15/10/2026 (cruza meses, meta ponderada por días), 24 h, Mecánica, Conf. 18 h

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Resumen por equipo | `f_resumen_equipo.json` | 18 | 144 | 144 | 1.11e-16 | 0 | coincide |
| Resumen por familia | `f_resumen_familia.json` | 5 | 25 | 25 | 0 | 0 | coincide |
| Gráfico Disp Simba | `f_grafico_simba.json` | 3 | 9 | 9 | 0 | 0 | coincide |
| Tabla de paros Disp Simba | `f_tabla_simba.json` | 36 | 36 | 36 | 0 | 0 | coincide |
| Gráfico Disp Sostenimiento | `f_grafico_sostenimiento.json` | 4 | 12 | 12 | 0 | 0 | coincide |
| Tabla de paros Disp Sostenimiento | `f_tabla_sostenimiento.json` | 59 | 59 | 59 | 0 | 0 | coincide |
| Disp Mensual (equipo x semana) | `f_mensual.json` | 30 | 90 | 90 | 0 | 0 | coincide |

### Escenario g_tirolargo: Disp Mensual 01/07 al 20/11/2026, familia TIRO LARGO, 24 h, Mecánica

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Disp Mensual (equipo x semana) | `g_tirolargo_mensual.json` | 63 | 189 | 189 | 0 | 0 | coincide |

### Escenario g_sostenimiento: Disp Mensual 01/07 al 20/11/2026, familia EQUIPOS DE SOSTENIMIENTO, 24 h, Mecánica

| Visual | Fixture | Filas de Power BI | Valores comparados | Coinciden | Dif. máx. fracciones | Dif. máx. horas | Resultado |
|---|---|---:|---:|---:|---:|---:|---|
| Disp Mensual (equipo x semana) | `g_sostenimiento_mensual.json` | 84 | 252 | 252 | 0 | 0 | coincide |

## Diferencias

No hay diferencias entre el motor y Power BI en ninguno de los 43 fixtures, ni con la muestra ni con el Excel real. Por eso `KNOWN_DIFFS` en `tests/medidas/escenarios.test.ts` está vacío y no se usó `it.fails`. Para una diferencia futura basta agregar la clave `<fixture>@<muestra|excel>` con la causa probable.

Solo hay una variación informativa, que no cuenta como diferencia. Con la muestra, la grafía de tres descripciones de la tabla de paros difiere en mayúsculas de la de Power BI, porque Power BI muestra la primera grafía que aparece en toda la columna y la muestra solo trae paros desde 2026-06-01:

| Fixture | Power BI | Muestra |
|---|---|---|
| `a_tabla_sostenimiento`, `c_tabla_sostenimiento` | Mantenimiento correctivo | MANTENIMIENTO CORRECTIVO |
| `f_tabla_simba` | desgaste en deslizaderas | DESGASTE EN DESLIZADERAS |

Con el Excel real esos textos coinciden exactos (la prueba compara el texto sin ignorar mayúsculas).

## Qué ejercitan los escenarios

- **a:** horas programadas de 18 h al día (Var t: Disp) en todas las medidas.
- **b y c:** el filtro de DISP con `IN`. La tabla de paros de Simba pasa de 49 filas (solo Mecánica en el escenario a) a 21 (Operacional) y 70 (ambas); la de Sostenimiento de 62 a 14 y 76.
- **d:** Var t: Conf. de 12 h y 24 h en Confiabilidad y Probabilidad de falla.
- **e y f:** otros periodos. En f el periodo cruza septiembre y octubre, y la Meta_Disp es el promedio ponderado por días de las metas de ambos meses (por ejemplo 0.8067 para el equipo 100362, que no es la meta de ninguno de los dos meses). La prueba de control negativo confirma que usar solo la meta de octubre habría fallado.
- **g:** Disp Mensual de 21 semanas (Sem 27/26 a Sem 47/26) para las familias TIRO LARGO (3 equipos, 63 puntos) y EQUIPOS DE SOSTENIMIENTO (4 equipos, 84 puntos).

## Límites de la comparación

- **Códigos sueltos de DISP.** El Excel tiene paros con responsables que no son ni mecánicos ni operacionales (`T-MTH-GD`, `T-MTM-MD`, `T-FES-NI`). `NOT IN (Operacional)` los deja pasar e `IN (Mecánica, Operacional)` no. Desde junio de 2026 solo hay dos en los 18 equipos del reporte, ambos `T-FES-NI` de Jumbo 100636 (29/06 y 24/10/2026). `T-FES-NI` no cuenta en el paro general ni en las fallas NPI, así que no cambia ninguna medida de disponibilidad, MTBF ni MTTR. Solo aparecería como fila en la tabla de paros de Jumbo de octubre, que no se pidió. Por eso `c_sindisp` y `c` dan los mismos valores y la diferencia entre `NOT IN` e `IN` no se ejercita con estos datos.
- **Cómo codifica la página los segmentadores.** Se desconoce qué `Where` genera la página para "Operacional" o para "todas las opciones" en el segmentador DISP GLOBAL (la captura solo muestra `NOT IN (Operacional)` con Mecánica elegida). Los escenarios b y c usan `IN`, que es lo que pide el enunciado; si la página enviara `NOT IN (Mecánica)` para Operacional, incluiría también los códigos sueltos. Con los datos de estos periodos el resultado sería el mismo, por lo dicho en el punto anterior.
- **Disp Mensual.** En los escenarios a a f se mantiene la familia CARGADORAS BP del filtro de página capturado (6 equipos ST1030); solo el escenario g cambia la familia. ST3.5 queda fuera de ese gráfico (según `tests/fixtures/powerbi/INDICE.md` pertenece a CARGADORAS BP FLOTA 3.5; es una inferencia).
- **Tablas de paros.** Se comparan como conjunto (las tablas de Sostenimiento llegan ordenadas por fin descendente y las de Simba por horas descendentes). Las filas son todas las que devuelve Power BI (ventana de 500; el máximo fue 76).
- **Muestra.** Todos los escenarios empiezan después de 2026-06-01, así que caben en la muestra (la prueba omite con `skip` cualquier periodo anterior).

## Cómo repetirlo

```
python3 -I tools/consultar_powerbi.py verificar q_001:0          # reenvío sin cambios
python3 -I tools/consultar_powerbi.py escenarios --seco          # muestra los filtros sin enviar
python3 -I tools/consultar_powerbi.py escenarios --solo a,f      # obtiene (omite los existentes)
python3 -I tools/consultar_powerbi.py redecodificar              # decodifica de nuevo lo guardado
npx vitest run tests/medidas/escenarios.test.ts
```

Para guardar la tabla de resultados de la prueba en un archivo JSON: `ESCENARIOS_RESUMEN=ruta.json npx vitest run tests/medidas/escenarios.test.ts`.
