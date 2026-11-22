# Fixtures Power BI (querydata decodificado)

Generados con `python3 -I tools/decodificar_querydata.py docs/powerbi/querydata tests/fixtures/powerbi`
a partir de `docs/powerbi/querydata/q_000..q_026.json` (27 archivos, 34 consultas). Un archivo `q_NNN.json`
puede traer varias consultas (`request.queries[i]` <-> `response.results[i]`); cada una es un fixture
`q_NNN_<i>.json` con `origen`, `consulta`, `pagina`, `visual`, `campos`, `filtros`, `filas`.
Cotejo con el texto visible: `python3 -I tools/verificar_fixtures.py tests/fixtures/powerbi docs/powerbi/capturas`.

Convenciones: las claves de `filas` son los `Name` de la consulta (`Tabla.Campo`, p. ej. `Metricas (2).MTTR_H`);
`DIM_EQUIPOS.IDEQUIPO` va como texto; fechas `_F/H Inicio/Fin` como ISO sin zona (coinciden con lo que muestra el
reporte); los decimales conservan toda la precision del servidor (no se redondea). En `filtros`, `>=`/`<` son
comparaciones, `in`/`not_in` listas, y el rango de fechas tiene fin exclusivo (`< 2026-11-21` = datos hasta el 20).

## Fixtures

| Fixture | Origen | Pagina | Visual | Filtros (resumen; el detalle completo esta en el fixture) | Filas |
|---|---|---|---|---|---|
| q_000_0.json | q_000.json #0 | 7. Resumen Disp. | slicer: Var t: Conf. - Opciones de Confiabilidad[Confiabilidad] | Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (21 equipos) | 3 |
| q_000_1.json | q_000.json #1 | 7. Resumen Disp. | tableEx - Tabla por Familia: MTTR/MTBF/Disponibilidad/Confiabilidad/Prob. de Falla | Confiabilidad[Confiabilidad] IN 18 hrs; Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (21 equipos) | 5 |
| q_001_0.json | q_001.json #0 | 7. Resumen Disp. | tableEx - Tabla EQUIPO/DENOMINACION/MTTR/MTBF/Meta/Disp/Confiabilidad/Prob. de Falla | Confiabilidad[Confiabilidad] IN 18 hrs; Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (21 equipos) | 18 |
| q_002_0.json | q_002.json #0 | 7. Resumen Disp. | slicer: Var t: Disp - Opciones de Var_t: Disp[Var_t: Disp] | Confiabilidad[Confiabilidad] IN 18 hrs; Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (21 equipos) | 2 |
| q_003_0.json | q_003.json #0 | 7. Resumen Disp. | slicer: Periodo de tiempo - Min/Max de DIM_TIEMPO[Fecha] (rango del slicer Between) | Descripcion IN (21 equipos) | 1 |
| q_003_1.json | q_003.json #1 | 7. Resumen Disp. | slicer: DISP. GLOBAL - Opciones de HECHOS_DATAMES_NPI_PP[DISP] | DIM_RESPONSABLE[DISPONIBILIDAD] IN ['DISP. MECANICA', 'DISP. OPERACION']; HECHOS..[DISP] IN Mecánica, Operacional; Confiabilidad[Confiabilidad] IN 18 hrs; Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-11-01 a <2026-11-21; Descripcion IN (21 equipos) | 2 |
| q_004_0.json | q_004.json #0 | 6. Disp Scooptram ST1030 | slicer: Periodo de tiempo - Min/Max de DIM_TIEMPO[Fecha] (rango del slicer Between) | Descripcion IN (11 equipos) | 1 |
| q_005_0.json | q_005.json #0 | 6. Disp Scooptram ST1030 | slicer: Var t: Disp - Opciones de Var_t: Disp[Var_t: Disp] | HECHOS..[DISP] NOT IN Operacional; Fecha 2026-11-01 a <2026-11-21; Descripcion IN (11 equipos) | 2 |
| q_006_0.json | q_006.json #0 | 6. Disp Scooptram ST1030 | lineClusteredColumnComboChart: Cargadoras Bajo Perfil - Disp Din % (columnas) y Meta_Disp (linea) por equipo | Descripcion NOT IN (3 equipos); Descripcion IN (11 equipos); Var_t: Disp[Var_t: Disp] IN 24 hrs; HECHOS..[DISP] NOT IN Operacional; Fecha 2026-11-01 a <2026-11-21 | 6 |
| q_007_0.json | q_007.json #0 | 6. Disp Scooptram ST1030 | slicer: DISP. GLOBAL - Opciones de HECHOS_DATAMES_NPI_PP[DISP] | DIM_RESPONSABLE[DISPONIBILIDAD] IN ['DISP. MECANICA', 'DISP. OPERACION']; HECHOS..[DISP] IN Mecánica, Operacional; Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-11-01 a <2026-11-21; Descripcion IN (11 equipos) | 2 |
| q_007_1.json | q_007.json #1 | 6. Disp Scooptram ST1030 | tableEx - Tabla de paros: Sap/Equipo/Aviso/Descripcion/F-H Inicio/F-H Fin/Hrs Paro Ventana/Responsable/Tipo de Paro | Metricas (2)[Hrs Paro Ventana] (M) > 0; Var_t: Disp[Var_t: Disp] IN 24 hrs; HECHOS..[DISP] NOT IN Operacional; Fecha 2026-11-01 a <2026-11-21; Descripcion IN (11 equipos) | 71 |
| q_008_0.json | q_008.json #0 | 5. Disp Scooptram ST3.5 | lineClusteredColumnComboChart: Cargadoras Bajo Perfil - Disp Din % (columnas) y Meta_Disp (linea) por equipo | Descripcion IN (2 equipos); Descripcion IN (11 equipos); Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional | 2 |
| q_009_0.json | q_009.json #0 | 5. Disp Scooptram ST3.5 | slicer: Var t: Disp - Opciones de Var_t: Disp[Var_t: Disp] | Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (11 equipos) | 2 |
| q_010_0.json | q_010.json #0 | 5. Disp Scooptram ST3.5 | tableEx - Tabla de paros: Sap/Equipo/Aviso/Descripcion/F-H Inicio/F-H Fin/Hrs Paro Ventana/Responsable/Tipo de Paro | Metricas (2)[Hrs Paro Ventana] (M) > 0; Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (11 equipos) | 71 |
| q_011_0.json | q_011.json #0 | 4. Disp Sostenimiento | slicer: Periodo de tiempo - Min/Max de DIM_TIEMPO[Fecha] (rango del slicer Between) | Descripcion IN (4 equipos) | 1 |
| q_012_0.json | q_012.json #0 | 4. Disp Sostenimiento | slicer: Var t: Disp - Opciones de Var_t: Disp[Var_t: Disp] | Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (4 equipos) | 2 |
| q_013_0.json | q_013.json #0 | 4. Disp Sostenimiento | lineClusteredColumnComboChart: Equipos de Sostenimiento - Disp Din % (columnas) y Meta_Disp (linea) por equipo | Descripcion NOT IN (1 equipos); Descripcion IN (4 equipos); Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Var_t: Disp[Var_t: Disp] IN 24 hrs | 4 |
| q_014_0.json | q_014.json #0 | 4. Disp Sostenimiento | slicer: DISP. GLOBAL - Opciones de HECHOS_DATAMES_NPI_PP[DISP] | DIM_RESPONSABLE[DISPONIBILIDAD] IN ['DISP. MECANICA', 'DISP. OPERACION']; HECHOS..[DISP] IN Mecánica, Operacional; Fecha 2026-11-01 a <2026-11-21; Var_t: Disp[Var_t: Disp] IN 24 hrs; Descripcion IN (4 equipos) | 2 |
| q_014_1.json | q_014.json #1 | 4. Disp Sostenimiento | tableEx - Tabla de paros: Sap/Equipo/Aviso/Descripcion/F-H Inicio/F-H Fin/Hrs Paro Ventana/Responsable/Tipo de Paro | Metricas (2)[Hrs Paro Ventana] (M) > 0; Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Var_t: Disp[Var_t: Disp] IN 24 hrs; Descripcion IN (4 equipos) | 62 |
| q_015_0.json | q_015.json #0 | 3. Disp Jumbo | slicer: Periodo de tiempo - Min/Max de DIM_TIEMPO[Fecha] (rango del slicer Between) | Descripcion IN (3 equipos) | 1 |
| q_016_0.json | q_016.json #0 | 3. Disp Jumbo | slicer: Var t: Disp - Opciones de Var_t: Disp[Var_t: Disp] | HECHOS..[DISP] NOT IN Operacional; Fecha 2026-11-01 a <2026-11-21; Descripcion IN (3 equipos) | 2 |
| q_017_0.json | q_017.json #0 | 3. Disp Jumbo | slicer: DISP. GLOBAL - Opciones de HECHOS_DATAMES_NPI_PP[DISP] | DIM_RESPONSABLE[DISPONIBILIDAD] IN ['DISP. MECANICA', 'DISP. OPERACION']; HECHOS..[DISP] IN Mecánica, Operacional; Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-11-01 a <2026-11-21; Descripcion IN (3 equipos) | 2 |
| q_017_1.json | q_017.json #1 | 3. Disp Jumbo | tableEx - Tabla de paros: Sap/Equipo/Aviso/Descripcion/F-H Inicio/F-H Fin/Hrs Paro Ventana/Responsable/Tipo de Paro | Metricas (2)[Hrs Paro Ventana] (M) > 0; Var_t: Disp[Var_t: Disp] IN 24 hrs; HECHOS..[DISP] NOT IN Operacional; Fecha 2026-11-01 a <2026-11-21; Descripcion IN (3 equipos) | 59 |
| q_018_0.json | q_018.json #0 | 3. Disp Jumbo | lineClusteredColumnComboChart: Perforación Mecánizada - Disp Din % (columnas) y Meta_Disp (linea) por equipo | Descripcion NOT IN (1 equipos); Descripcion IN (3 equipos); Var_t: Disp[Var_t: Disp] IN 24 hrs; HECHOS..[DISP] NOT IN Operacional; Fecha 2026-11-01 a <2026-11-21 | 3 |
| q_019_0.json | q_019.json #0 | 2. Disp Simba | slicer: Var t: Disp - Opciones de Var_t: Disp[Var_t: Disp] | Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (3 equipos) | 2 |
| q_020_0.json | q_020.json #0 | 2. Disp Simba | slicer: Periodo de tiempo - Min/Max de DIM_TIEMPO[Fecha] (rango del slicer Between) | Descripcion IN (3 equipos) | 1 |
| q_021_0.json | q_021.json #0 | 2. Disp Simba | lineClusteredColumnComboChart: Tiro Largo - Disp Din % (columnas) y Meta_Disp (linea) por equipo | Descripcion NOT IN (1 equipos); Descripcion IN (3 equipos); Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Var_t: Disp[Var_t: Disp] IN 24 hrs | 3 |
| q_022_0.json | q_022.json #0 | 2. Disp Simba | slicer: DISP. GLOBAL - Opciones de HECHOS_DATAMES_NPI_PP[DISP] | DIM_RESPONSABLE[DISPONIBILIDAD] IN ['DISP. MECANICA', 'DISP. OPERACION']; HECHOS..[DISP] IN Mecánica, Operacional; Fecha 2026-11-01 a <2026-11-21; Var_t: Disp[Var_t: Disp] IN 24 hrs; Descripcion IN (3 equipos) | 2 |
| q_022_1.json | q_022.json #1 | 2. Disp Simba | tableEx - Tabla de paros: Sap/Equipo/Aviso/Descripcion/F-H Inicio/F-H Fin/Hrs Paro Ventana/Responsable/Tipo de Paro | Metricas (2)[Hrs Paro Ventana] (M) > 0; Fecha 2026-11-01 a <2026-11-21; HECHOS..[DISP] NOT IN Operacional; Var_t: Disp[Var_t: Disp] IN 24 hrs; Descripcion IN (3 equipos) | 49 |
| q_023_0.json | q_023.json #0 | 8. Disp Mensual | slicer: Var t: Disp - Opciones de Var_t: Disp[Var_t: Disp] | DIM_EQUIPOS[Familia] IN CARGADORAS BP; Fecha 2026-07-01 a <2026-11-06; HECHOS..[DISP] NOT IN Operacional; Descripcion IN (21 equipos) | 2 |
| q_024_0.json | q_024.json #0 | 8. Disp Mensual | lineChart: Evolucion Semanal de disponibilidades % - Categoria=DIM_TIEMPO[NbSemana], Series=DIM_EQUIPOS[Descripcion] | Descripcion NOT IN (1 equipos); Descripcion IN (21 equipos); Mes (tabla local) NOT IN (null); Var_t: Disp[Var_t: Disp] IN 24 hrs; DIM_EQUIPOS[Familia] IN CARGADORAS BP; Fecha 2026-07-01 a <2026-11-06; HECHOS..[DISP] NOT IN Operacional | 114 |
| q_025_0.json | q_025.json #0 | 8. Disp Mensual | slicer: DISP. GLOBAL - Opciones de HECHOS_DATAMES_NPI_PP[DISP] | DIM_RESPONSABLE[DISPONIBILIDAD] IN ['DISP. MECANICA', 'DISP. OPERACION']; HECHOS..[DISP] IN Mecánica, Operacional; Var_t: Disp[Var_t: Disp] IN 24 hrs; DIM_EQUIPOS[Familia] IN CARGADORAS BP; Fecha 2026-07-01 a <2026-11-06; Descripcion IN (21 equipos) | 2 |
| q_025_1.json | q_025.json #1 | 8. Disp Mensual | slicer: DISP. GLOBAL - Opciones de DIM_EQUIPOS[Familia] | DIM_RESPONSABLE[DISPONIBILIDAD] IN ['DISP. MECANICA', 'DISP. OPERACION']; HECHOS..[DISP] IN Mecánica, Operacional; HECHOS..[DISP] NOT IN Operacional; Var_t: Disp[Var_t: Disp] IN 24 hrs; Fecha 2026-07-01 a <2026-11-06; Descripcion IN (21 equipos) | 5 |
| q_026_0.json | q_026.json #0 | 8. Disp Mensual | slicer: Periodo de tiempo - Min/Max de DIM_TIEMPO[Fecha] (rango del slicer Between) | Descripcion IN (21 equipos) | 1 |

## Verificacion contra el texto visible

`tools/verificar_fixtures.py` redondea como el reporte (mitad hacia arriba) y compara con `docs/powerbi/capturas/pag_N.txt`:
268 comparaciones, 0 diferencias.

- Resumen Disp. (pag_7.txt), tabla por equipo: los 18 equipos coinciden en MTTR_H, MTBF_H, Meta_Disp, Disp Din %,
  Confiabilidad_24h y ProbabilidadDeFalla (p. ej. 100362: 10.17 / 69.83 / 73 % / 83 % / 77.28 % / 22.72 %).
- Resumen Disp., tabla por familia: las 5 familias coinciden (p. ej. TIRO LARGO 6.17 / 27.31 / 77 % / 51.74 % / 48.26 %).
- Etiquetas de los graficos de Disp Simba, Jumbo, Sostenimiento, ST3.5 y ST1030 (pag_2..6.txt): las etiquetas de Disp Din %
  coinciden en el mismo orden; las de Meta_Disp coinciden como conjunto (el orden de las etiquetas de la linea en el DOM no
  sigue el de las categorias).
- Tablas de paros de pag_2..6.txt: las 20 filas visibles de cada pagina coinciden campo a campo y en el mismo orden
  (Sap, equipo, aviso, descripcion, inicio, fin, Hrs Paro Ventana, responsable, tipo de paro).
- Disp Mensual (pag_8.txt): todas las etiquetas de porcentaje visibles pertenecen al conjunto de Disp Din % y Meta_Disp
  decodificados (el texto trae 169 etiquetas de 228 posibles; el reporte oculta las que se solapan; el "117%" es el zoom).

## Notas y puntos no resueltos

1. **Orden real de captura.** No fue 1 a 8: los archivos siguen Resumen Disp. (q_000-q_003, carga inicial: `activePageName` del
   reporte), ST1030 (q_004-q_007), ST3.5 (q_008-q_010), Sostenimiento (q_011-q_014), Jumbo (q_015-q_018), Simba (q_019-q_022) y
   Disp Mensual (q_023-q_026). Portada no tiene consultas de datos. El numero de pagina de los fixtures es el del orden visible
   del reporte (Portada = 1 ... Disp Mensual = 8), no el de captura.
2. **Como se asigno la pagina.** Por campos (Resumen y Mensual tienen visuales unicos) y por el filtro de pagina
   `DIM_EQUIPOS[Descripcion] IN (...)` (Simba, Jumbo y Sostenimiento tienen lista propia). Los slicers (Var t: Disp, Periodo de
   tiempo, DISP. GLOBAL) heredan la pagina de la lista de equipos de su `Where`. Ver `asignacion_pagina` en cada fixture.
3. **ST3.5 y ST1030 son inferidos en parte.** Ambas paginas comparten el mismo filtro de pagina (lista de 11 nombres de equipo), asi que:
   los graficos se distinguen por los equipos devueltos (q_006 = 6 ST1030; q_008 = Wagner y SCOOP 3.50 N°6); las dos tablas de
   paros (q_007_1 y q_010_0) tienen filtros identicos y solo difieren en el orden (q_007_1 por IDEQUIPO asc = pag_6.txt;
   q_010_0 por Hrs Paro Ventana desc = pag_5.txt; ambas contienen exactamente las mismas 71 filas); y los slicers q_004, q_005
   y q_007_0 (ST1030) y q_009 (ST3.5) se asignaron por cercania en el orden de captura. Esa asignacion de slicers no se puede
   comprobar con los datos.
4. **Slicers compartidos no capturados de nuevo.** Varias paginas no tienen consulta propia de algun slicer (p. ej. ST3.5 no
   tiene `Periodo de tiempo` ni `DISP. GLOBAL`); el cliente parece reutilizar resultados identicos. Por eso la cobertura de slicers por pagina no es uniforme.
5. **Campos solicitados que no devolvieron valor.** `Metricas.MetaDispSimba` esta en los 6 graficos (q_006_0, q_008_0, q_013_0,
   q_018_0, q_021_0, q_024_0) pero llega en blanco (en q_024_0 como nulo explicito en los agregados de la serie; en los demas el
   esquema DS-level no trae valor). Aparece en `campos_sin_valores` y no se incluye en `filas`. No esta en `paginas.txt`.
6. **Campos que la consulta pide y `paginas.txt` no lista.** `Metas2026.Color_Disponibilidad` (colores hex para formato
   condicional de las columnas, en los combos) y `Metricas (2).Brecha_Disp dn` (q_001_0, marcado en `SuppressedJoinPredicates`,
   o sea, solo ayuda a la union; pero el servidor si devuelve su valor y se conserva).
7. **Grafico de lineas de Disp Mensual (q_024_0).** Se aplana la matriz: una fila por (equipo, semana) = 6 equipos x 19 semanas
   (Sem 27/26 a Sem 45/26) = 114 filas. La etiqueta de semana viene de un diccionario (`ValueDicts.D0`) y el indice
   `SyncI0` apunta al DS sincronizado `SyncDS0`; `DIM_TIEMPO.NbSemana_orden` es la clave numerica de orden (27..45). Los
   agregados `A0..A5` del DS (min/max de ejes y limites de ventana: 6 series, 3500 puntos) no son datos y se descartan.
   El `RowCount` del servidor (135) cuenta ademas las filas de sincronizacion/totales. Los filtros de esa captura son
   Familia = CARGADORAS BP y Fecha 2026-07-01 a <2026-11-06 (no el periodo 01-20 nov del resto de paginas); eso explicaria que
   solo salgan los 6 ST1030 (los scoops 3.5 serian de la familia CARGADORAS BP FLOTA 3.5), pero es una inferencia.
8. **Filtros no estandar.** En q_024_0 hay un filtro sobre la tabla local `LocalDateTable_...[Mes]` NOT IN (null) y la lista de
   equipos del grafico contiene `NOT IN ('CARGADOR FRONTAL BP SCOOP3.5 No.02')`. En q_025_1 (slicer Familia) el filtro de DISP es
   `IN (Mecanica, Operacional)` y `NOT IN (Operacional)` a la vez. Todos los `Where` de las 34 consultas fueron
   reconocidos (solo `In`, `Not In` y `Comparison`; no aparecio `Contains` ni `Or`); los `Target` de las tablas de paros (las
   columnas sobre las que aplica el filtro de la medida) se ignoran.
9. **Listas de equipos de pagina con nombres duplicados.** Las listas incluyen nombres antiguos o con otra ortografia
   (`CARGADOR FRONTAL BP WAGNER No.05`, `CARGADORA FRONTAL BP SCOOP 3.50 N°6`, `PERFORACION BOOMER ... No.03`, `SCOOP3.5 No.02`);
   las de Resumen y Mensual difieren en dos nombres. Se conservan tal cual en `filtros`.
10. **Tablas de paros.** Ventana de 500 filas; llegaron 71, 71, 62, 59 y 49, es decir completas (el texto de las capturas solo
    muestra las 20 primeras por el desplazamiento virtual). `Hrs Paro Ventana` conserva ruido de punto flotante
    (p. ej. 17.000000000058208); se redondea a 2 decimales solo al mostrar. Orden: Simba/Jumbo/ST3.5 por Hrs desc,
    ST1030 por IDEQUIPO asc, Sostenimiento por `_F/H Fin` desc. Las tablas de las paginas 2-6 incluyen filas de equipos fuera del
    grafico de su pagina (p. ej. la tabla de ST3.5 trae los 8 scoops), porque su filtro es el de pagina.
11. **Valores nulos.** Ningun valor de `filas` es nulo (todas las columnas decodificaron sin avisos); `Disp Din %` = 0 es un 0
    real devuelto por el servidor (p. ej. 618486 y 618270 con una parada de 480 h en todo el periodo).
12. **No cubierto.** No hay consultas de las paginas ocultas (Camiones, Confiabilidad y Costos, Horometros, ToolTips) ni de
    Portada; `paginas.txt` no asocia nombres de pagina (solo `None`), por lo que la correspondencia secciones/paginas se hizo por
    contenido y `pbir/pages/pages.json`.
