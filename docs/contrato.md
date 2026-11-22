# Contrato de datos y medidas

Borrador v0 (22/11/2026). Fuente: modelo y definición del reporte publicado `Analisis de indicadores 15-09-2026.pbix` (ver `docs/powerbi/`). Las secciones marcadas PENDIENTE se cierran cuando lleguen el Excel de entrada y el DAX.

## 1. Tablas de entrada (hojas del Excel)

Nombres de columna tal como están en el modelo de Power BI. La correspondencia con las hojas reales del Excel queda PENDIENTE.

### paros (HECHOS_DATAMES_NPI_PP)

| Columna PBI | Campo app | Tipo | Uso |
|---|---|---|---|
| IDEQUIPO | id_equipo | texto | relación con equipos |
| Aviso | aviso | texto | tabla de paros |
| Fecha Inicio averia / Hora inicio averia | inicio | fecha-hora | ventana de paro |
| Fecha Fin de avería / Hora fin averia | fin | fecha-hora | ventana de paro |
| Duración parada (Mins) | duracion_min | número | |
| Desc de Paro | desc_paro | texto | tabla de paros; la tabla de Disp Camiones excluye "0" |
| IDResponsable | id_responsable | texto | relación con responsables |
| CodFalla, TextodelaFalla | cod_falla, texto_falla | texto | |
| IDTIPODEMANTTO | id_tipo_mantto | texto | |
| Resumen de la actividad | resumen | texto | |
| DesEquipo | des_equipo | texto | tabla de paros |
| Duracion del paro (Horas) | duracion_h | número | |
| Tipo de Paro, Tipo de Paro(PP/NPI) | tipo_paro, tipo_paro_pp_npi | texto | tabla de paros |
| Responsable | responsable | texto | tabla de paros |
| DISP | disp | texto | segmentador DISP. GLOBAL (Mecánica / Operacional). Columna calculada: PENDIENTE DAX |
| Minutos_Paro_Ajustados, _F/H Inicio, _F/H Fin, _Paro Total (min) | | | columnas calculadas: PENDIENTE DAX |

### equipos (DIM_EQUIPOS)

IDEQUIPO (texto), Descripcion (texto), Familia (texto: TIRO LARGO, PERFORACION MECANIZADA, EQUIPOS DE SOSTENIMIENTO, CARGADORAS BP FLOTA 3.5, CARGADORAS BP).

### responsables (DIM_RESPONSABLE)

IDResponsable, Denominacion, RESPONSABLE, DISPONIBILIDAD. Los tooltips excluyen RESPONSABLE nulo y "FUERA ESTADISTICA" (fase 2).

### metas (Metas2026)

Mes, Familia, Meta_Disponibilidad, Meta_MTTR, Meta_MTBF, Meta_Confiabilidad. La medida `Meta_Disp` pondera por equipo o familia según el filtro (existe `_Debug_Ponderacion`): PENDIENTE DAX.

### Parámetros

- `Var_t: Disp` (Var_t: Disp, Horas): 18 hrs y 24 hrs. Horas programadas por día para disponibilidad. Valor por defecto en el reporte: 24 hrs.
- `Confiabilidad` (Confiabilidad, Horas): 12 hrs, 18 hrs, 24 hrs. Horizonte t de confiabilidad. Valor por defecto en el reporte: 18 hrs.
- Si el Excel trae otros parámetros (metas por equipo, horarios), se agregan aquí.

### Calendario (DIM_TIEMPO)

No se carga: la app genera el calendario. Campos usados: Fecha, NbSemana (etiqueta "Sem 45/26"), Mes. Regla de semana: PENDIENTE (confirmar con el DAX o el Excel si es ISO o semana que empieza en domingo).

## 2. Contexto de filtro

| Filtro | Origen | Valores |
|---|---|---|
| Periodo | segmentador entre fechas sobre DIM_TIEMPO[Fecha] | por defecto el rango de la última carga (en la captura: 01/11/2026 al 20/11/2026) |
| Var t: Disp | parámetro | 18 o 24 h |
| Var t: Conf. | parámetro | 12, 18 o 24 h |
| DISP. GLOBAL | paros[disp] | Mecánica, Operacional o ambos; por defecto Mecánica |
| Equipos de la página | filtro de página sobre DIM_EQUIPOS[Descripcion] | sección 4 |
| Familia | DIM_EQUIPOS[Familia], selección única | solo Disp Mensual |
| Equipo (filtro cruzado) | clic en una columna del gráfico | filtra la tabla de paros |

## 3. Medidas

Fórmulas comprobadas con los valores publicados:

- Confiabilidad(t) = exp(-t / MTBF_H). Equipo 100362: MTBF_H = 69.83, t = 18, resultado 77.28 %.
- ProbabilidadDeFalla = 1 - Confiabilidad.
- En el periodo 01 al 20/11 (20 días x 24 h = 480 h), un equipo sin fallas y parado todo el periodo muestra MTTR_H = 480, MTBF_H = 0, Disp = 0 % (618486, 618270, 618321).

PENDIENTE DAX (lista de medidas que usan las 8 páginas):

| Medida | Tabla PBI | Dónde se ve |
|---|---|---|
| Disp Din % | Metricas (2) | gráficos de familia, Resumen, Disp Mensual |
| MTTR_H, MTBF_H | Metricas (2) | Resumen |
| Hrs Paro Ventana, Min Paro Ventana | Metricas (2) | tabla de paros |
| Paro General 24h / 18h / Ventana, Paro NPI Mtto 24h / 18h / Ventana | Metricas (2) | base de Disp Din % |
| _Cantidad Fallas NPI | Metricas (2) | base de MTTR y MTBF |
| Disp Acum %, Disp Acum Final, Brecha_Disp dn, Título Ventana, Dif | Metricas (2) | revisar si alguna página visible las usa |
| Confiabilidad_24h, ProbabilidadDeFalla | Metricas | Resumen |
| HSelecDisp, HSelecConf | Metricas | horas seleccionadas en los parámetros |
| Meta_Disp, Color_Disponibilidad, Brecha_Disp | Metas2026 | línea de meta, semáforo |

## 4. Equipos por página (filtros del reporte)

| Página | Equipos |
|---|---|
| Disp Simba (título "Tiro Largo") | JUMBO DE PERFORACION ATLAS SIMBA S7 N°1, N°2, N°3 |
| Disp Jumbo (título "Perforación Mecanizada") | PERFORADORA BOOMER 282 EPIROC No. 01, No. 02, No. 03 |
| Disp Sostenimiento | DESATADOR DE ROCAS SCALEMIN, DESATADOR DE ROCAS SCALEMIN No.2, EMPERNADOR BOLTEC EPIROC N°1, EMPERNADOR BOLTEC S10 S EPIROC N°2 |
| Disp Scooptram ST3.5 | gráfico solo con CARGADOR FRONTAL BP SCOOP 3.50 N°5 (WAGNER) y CARGADOR FRONTAL BP SCOOP 3.50 N°6 |
| Disp Scooptram ST1030 | cargadoras de la página menos los dos 3.50 y "CARGADOR FRONTAL BP SCOOP3.5 No.02" (quedan ST1030 No. 01 a No. 06) |
| Resumen Disp. | 21 descripciones (las 18 de la captura más variantes antiguas de nombre: CARGADOR FRONTAL BP WAGNER No.05, CARGADORA FRONTAL BP SCOOP 3.50 N°6, PERFORADORA BOOMER 282 EPIROC No.03) |
| Disp Mensual | lista parecida a Resumen, sin filtro adicional de familia salvo el segmentador |

Las variantes de nombre indican que el mismo equipo aparece con descripciones distintas en el histórico. En la app el filtro de página se hace por IDEQUIPO (SAP), no por descripción. PENDIENTE: confirmar con el Excel que cada variante corresponde al mismo SAP.

## 5. Tabla de paros (páginas de familia)

Columnas: Sap, Equipo, Aviso (conteo o primer valor), Descripcion del Paro, _F/H Inicio, _F/H Fin, Hrs Paro Ventana, Responsable, Tipo de Paro. Solo filas con Hrs Paro Ventana > 0, orden descendente por Hrs Paro Ventana.
