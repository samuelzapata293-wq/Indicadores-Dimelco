# Contrato de datos y medidas

Versión 1 (22/11/2026). Fuente: `Analisis de indicadores 15-09-2026.pbix` y `LIBRO MAESTRO ABRIL 15-09-2026.xlsx`. El DAX completo está en `docs/powerbi/modelo/medidas.md`, el Power Query en `docs/powerbi/modelo/power_query.md` y las relaciones en `docs/powerbi/modelo/relaciones.csv`. Este documento manda: si el código y este contrato no coinciden, se corrige uno de los dos y se deja constancia aquí.

## 1. Entrada: tablas del Excel

El importador lee las tablas de Excel por nombre (objetos Tabla, no rangos fijos). Solo se cargan estas cinco; el resto del libro (costos, horómetros, materiales, OT) queda para la fase 2.

### 1.1 paros: `Tabla2`, hoja "Data Mes" (cabecera en la fila 6, unas 20 600 filas, 14 325 con aviso)

| Columna Excel | Campo app | Transformación (igual que Power Query) |
|---|---|---|
| Equipo | id_equipo | entero |
| Denominación | (no se usa) | se descarta; la descripción viene de equipos |
| Aviso | aviso | entero. Fila sin aviso: se descarta |
| Inicio avería | fecha_inicio | fecha |
| Hora in-avería | hora_inicio | texto "hh:mm[:ss]"; "24:00:00" se cambia por "00:00:00" (solo en inicio) |
| Fin de avería | fecha_fin | fecha. Fila sin fecha fin: se descarta |
| Hora fin avería | hora_fin | texto "hh:mm[:ss]" sin reemplazo ("24:00:00" suma un día) |
| Duración parada | duracion_min | número (minutos) |
| Descripción | desc_paro | texto |
| Grupo de codigos | id_responsable | texto (T-MTO-ME, T-MTO-EL, T-OPE-MP, T-FES-NI, ...) |
| Codificación | cod_falla | texto |
| Codif-txt-cód- | texto_falla | texto |
| Status usuario | id_tipo_mantto | texto (PP, NPI, EPP) |
| Tipo de Paro(PP/NPI) | tipo_paro_pp_npi | texto |
| Resumen de actividad | resumen | texto |

Además: fila cuyo equipo no está en `equipos` se descarta (en Power Query: unión izquierda y filtro DesEquipo no nulo).

Campos derivados (se calculan en la app, no se guardan):

- `inicio` = fecha_inicio + hora_inicio; `fin` = fecha_fin + hora_fin (fecha-hora local, sin zona horaria).
- `tipo_paro` = texto después del primer espacio de `resumen` en formato Nombre Propio (Text.Proper).
- `disp`: si id_responsable contiene "-MTO-" es "Mecánica"; si contiene "-OPE-" u "-OPH-" es "Operacional"; si no, el propio id_responsable.
- `responsable`: igual que `disp` pero con "Mantenimiento" y "Operación".
- `minutos_ajustados` = INT(duracion_min / 1440) * 1080 + MIN(MOD(duracion_min, 1440), 1080).

### 1.2 equipos: `Tabla5`, hoja "Parametros" (25 filas)

Equipo → id_equipo (entero), Denominacion del Objeto → descripcion (texto; varias traen espacios al inicio o al final: se recortan), Familia → familia.

Familias: ACARREO MECANIZADO, CARGADORAS BP FLOTA 3.5, CARGADORAS BP, EQUIPOS DE SOSTENIMIENTO, TIRO LARGO, PERFORACION MECANIZADA.

### 1.3 responsables: `Tabla18`, hoja "Parametros" (13 filas con código)

GPO.CODIGOS → id_responsable, DENOMINACION DE CODIGO → denominacion, RESPONSABLE → responsable, DISPONIBILIDAD → disponibilidad. Filas sin código: se descartan.

### 1.4 tipos de mantenimiento: `Tabla9`, hoja "Parametros"

IDTIPO DE MANTTO → id_tipo_mantto (PP, NPI, EPP), DESCRIPCION → descripcion.

### 1.5 metas: `Tabla15`, hoja "METASMTTO" (216 filas)

Fecha → mes (texto "dd/mm/aaaa", primer día del mes), Familia → equipo_descripcion (es la descripción del equipo, no la familia: en el modelo se relaciona con DIM_EQUIPOS[Descripcion]), Disponibilidad → meta_disp (fracción 0 a 1), MTTR, MTBF, Confiabilidad → meta_mttr, meta_mtbf, meta_conf (hoy vacías).

La relación meta-equipo se hace por descripción recortada y sin distinguir mayúsculas.

### 1.6 Parámetros fijos (no vienen del Excel)

- Var t: Disp (horas programadas por día): 18 o 24. Valor inicial en el reporte guardado: 24.
- Var t: Conf. (horizonte de confiabilidad): 12, 18 o 24. Valor inicial en el reporte guardado: 18.

## 2. Contexto de filtro

Todas las medidas reciben:

- `ini`, `fin`: fechas del segmentador Periodo (inclusive).
- `equipos`: conjunto de id_equipo en contexto (filtro de la página, fila de la tabla, columna del gráfico o familia).
- `disp`: valores elegidos en DISP. GLOBAL (Mecánica, Operacional o ambos). Filtra filas de paros por el campo `disp`; no cambia `equipos`.
- `hDisp` (18/24) y `tConf` (12/18/24).

En el modelo no hay relación entre el calendario y los paros: las medidas de ventana recortan cada paro a [ini, fin + 1 día) con su propia lógica.

## 3. Medidas (traducción del DAX de `Metricas (2)`, `Metricas` y `Metas2026`)

Notación: `P` = paros con id_equipo en `equipos` y `disp` en el filtro. Fechas como número de días (fracción = hora del día). `F0 = ini`, `F1 = fin + 1`. `hpm = hDisp * 60`.

1. `minParoVentana(S)`: suma sobre las filas de S con `fin >= inicio`, `inicio < F1` y `fin > F0` de `s - r`, donde para `j = inicio`, `k = fin`:
   - `dR = MIN(MAX(F0, j), k) - j`, `r = INT(dR) * hpm + MIN(MOD(dR * 1440, 1440), hpm)`
   - `dS = MIN(MAX(F1, j), k) - j`, `s = INT(dS) * hpm + MIN(MOD(dS * 1440, 1440), hpm)`
2. `tiempoProgramado = (fin - ini + 1) * 60 * hDisp * |equipos|` (minutos). Nulo si no hay fechas.
3. `paroGeneralVentana = minParoVentana(P sin id_responsable = "T-FES-NI")`. Las filas con id_responsable vacío o desconocido sí cuentan.
4. `paroNpiVentana = minParoVentana(P con id_responsable en {T-MTO-ME, T-MTO-EL} y id_tipo_mantto = "NPI")`.
5. `fallasNpi` = número de filas de P con id_responsable en {T-MTO-ME, T-MTO-EL}, id_tipo_mantto = "NPI", `fin > inicio` (estricto), `inicio < F1` y `fin > F0`. 0 si no hay.
6. `dispDin = MAX(0, tiempoProgramado - paroGeneralVentana) / tiempoProgramado` si tiempoProgramado > 0; si no, nulo. (Disp Din %)
7. `mttrH = (paroNpiVentana / 60) / fallasNpi`; nulo si fallasNpi = 0. (MTTR_H)
8. `mtbfH = (MAX(0, tiempoProgramado - paroNpiVentana) / 60) / fallasNpi`; nulo si fallasNpi = 0. (MTBF_H)
9. `confiabilidad = 1` si mtbfH es nulo; `0` si mtbfH = 0; si no, `EXP(-tConf / mtbfH)`. (Confiabilidad_24h)
10. `probFalla = 1 - confiabilidad`. (ProbabilidadDeFalla)
11. `hrsParoVentana(S) = minParoVentana(S) / 60` si es > 0; si no, nulo. (Hrs Paro Ventana; en la tabla de paros S es la fila del paro)
12. `metaDisp`: para cada mes que toca [ini, fin], `dias` = días del mes dentro de [ini, fin] y `metaMes` = promedio simple de `meta_disp` de las metas con `mes` = primer día de ese mes y equipo_descripcion igual a la descripción de algún equipo de `equipos`. Se omiten los meses sin meta. `metaDisp = Σ(metaMes * dias) / Σ dias`; nulo si ningún mes tiene meta. (Meta_Disp)
13. `colorDisp = "#00493C"` si `metaDisp <= dispDin`, si no `"#F89221"`. (Color_Disponibilidad)

Comprobado contra lo publicado: equipo 100362, MTBF_H 69.83, tConf 18: confiabilidad 77.28 %.

### Semanas (Disp Mensual)

Etiqueta `"Sem " & WEEKNUM(fecha) & "/" & aa`, con WEEKNUM de Excel/DAX tipo 1: la semana empieza en domingo y la semana 1 contiene el 1 de enero. Para cada semana, `ini` y `fin` son el primer y último día de la semana dentro del periodo elegido.

## 4. Páginas y equipos

El filtro de cada página se hace por id_equipo:

| Página (ruta) | Título del gráfico | Equipos (id_equipo) |
|---|---|---|
| Disp Simba (/simba) | Tiro Largo | 618487, 100618, 100660 |
| Disp Jumbo (/jumbo) | Perforación Mecánizada | 618269, 100636, 620903 |
| Disp Sostenimiento (/sostenimiento) | Equipos de Sostenimiento | 618321, 100647, 618320, 621321 |
| Disp Scooptram ST3.5 (/st35) | Cargadoras Bajo Perfil | 100362, 618486 |
| Disp Scooptram ST1030 (/st1030) | Cargadoras Bajo Perfil | 618270, 100615, 100635, 100655, 100656, 100657 |
| Resumen Disp. (/resumen) | tabla por equipo y por familia | las 18 anteriores |
| Disp Mensual (/mensual) | Evolución semanal de disponibilidades % | las 18 anteriores (sin 100361 SCOOP3.5 No.02), filtradas por la familia elegida (selección única, inicial CARGADORAS BP) |

Valores iniciales de los segmentadores, tomados del reporte guardado: Periodo del primer día del mes de la fecha de inicio más reciente de paros hasta esa fecha (en la captura, 01/11/2026 al 20/11/2026); en Disp Mensual, desde el primer día del mes cuatro meses antes (en la captura, 01/07/2026 al 05/11/2026). DISP. GLOBAL: Mecánica. hDisp 24, tConf 18.

## 5. Visuales

- Páginas de familia: gráfico de columnas `dispDin` por equipo con etiqueta en %, color según `colorDisp`, línea `metaDisp` con etiqueta; leyenda "% Disponibilidad Real" y "-- Meta Disp %". Tabla de paros con columnas Sap, Equipo, Aviso, Descripción del Paro, _F/H Inicio, _F/H Fin, Hrs Paro Ventana, Responsable, Tipo de Paro (= campo tipo_paro_pp_npi, columna "Tipo de Paro(PP/NPI)" del Excel); solo filas con Hrs Paro Ventana > 0, orden descendente por Hrs Paro Ventana. Clic en una columna filtra la tabla a ese equipo.
- Resumen Disp.: tabla por equipo (EQUIPO, DENOMINACION, MTTR_Horas, MTBF_Horas, Meta_Disp, Disponibilidad % con círculo verde o rojo según colorDisp, Confiabilidad %, Prob. de Falla) y tabla por familia (Familia, MTTR, MTBF, Disponibilidad %, Confiabilidad %, Probabilidad de Falla). Segmentadores: Periodo, Var t: Conf., Var t: Disp, DISP. GLOBAL.
- Disp Mensual: un panel por equipo (dos columnas), línea amarilla `dispDin` por semana y línea punteada azul `metaDisp`, etiquetas en %.
- Formatos: horas con 2 decimales; disponibilidad y meta en % sin decimales; confiabilidad y probabilidad en % con 2 decimales; fechas "m/d/aaaa h:mm:ss AM/PM" (mes primero), como en el reporte.

## 6. Notas de datos (verificadas con el Excel del 15-09-2026)

- `Resumen de actividad` está vacía en todas las filas, así que `tipo_paro` sale vacío; la tabla de paros usa `tipo_paro_pp_npi`.
- `Duración parada` tiene 134 celdas con fórmula sin resultado guardado y 31 valores escritos a mano que no cuadran con fin - inicio. Las medidas de las 8 páginas visibles usan solo inicio y fin (minParoVentana), así que no las afecta. `minutos_ajustados` (usa duracion_min) queda para medidas de fase 2.
- Hora fin "24:00:00" aparece en 911 filas; hora inicio "24:00:00" en 33.
- Equipo y Aviso vienen como texto en la mayoría de filas y como número en 669.
- Fila sin equipo en Tabla5: 2 700 (se descartan); sin fecha fin: 3. Paros válidos: 11 622.

## 7. Decisiones tras validar el motor (S4)

- Tabla de paros de ST3.5 y ST1030: en Power BI las dos usan el mismo filtro y muestran los paros de los 8 scoops (100362, 618486, 618270, 100615, 100635, 100655, 100656, 100657), aunque cada gráfico muestra solo sus equipos. La app replica a Power BI; el gráfico usa los equipos de la sección 4 y la tabla los 8 scoops. Se puede cambiar en `src/medidas/contexto.ts` si se decide separarlas.
- Tabla de paros: Power BI agrupa por Sap, Equipo, Descripción, inicio, fin, Responsable y Tipo de Paro; Aviso es la suma de avisos del grupo y las horas se suman. Texto sin distinguir mayúsculas, se muestra la primera grafía cargada.
- Disp Mensual: el fin inicial del periodo es el mismo que el general (fecha de inicio más reciente de paros); el 05/11 de la captura fue una elección manual.
- El selector de fechas se limita al rango de datos cargados. El calendario del modelo de Power BI termina el 2026-12-31; la app genera el calendario y sigue funcionando en 2027 (en Power BI habría que ampliar DIM_TIEMPO).
