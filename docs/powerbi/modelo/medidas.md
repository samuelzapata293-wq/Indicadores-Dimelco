# Medidas DAX del reporte


## AnalisisCostos

### TotalHoras

```dax
CALCULATE(SUM(AnalisisCostos[Valor]),AnalisisCostos[Indicador] = "Horas")
```

### TCostoxHora

```dax
CALCULATE(SUM(AnalisisCostos[Valor]),
AnalisisCostos[Indicador] = "Costos/horas")
```

### LineaBase

```dax
CALCULATE(SUM(AnalisisCostos[Valor]),AnalisisCostos[Indicador] = "Meta")
```

### Utilizacion Semanal %

```dax
VAR HorasOperativas = 
    CALCULATE(
        SUM('AnalisisCostos'[Valor]),
        AnalisisCostos[Indicador] = "Horas"
    )
RETURN
    DIVIDE(HorasOperativas, 105, 0)
```


## AnalisisCostosMes

### Costo_Hora_Acumulado

```dax
VAR HorasTotales = 
    CALCULATE(
        SUM(AnalisisCostosMes[Valor]), 
        AnalisisCostosMes[Indicador] = "Horas"
    )
    
VAR CostoTotal = 
    SUMX(
        SUMMARIZE(AnalisisCostosMes, AnalisisCostosMes[SAP], AnalisisCostosMes[Semana]),
        VAR HorasSemana = CALCULATE(SUM(AnalisisCostosMes[Valor]), AnalisisCostosMes[Indicador] = "Horas")
        VAR CostoSemana = CALCULATE(SUM(AnalisisCostosMes[Valor]), AnalisisCostosMes[Indicador] = "Costos/horas")
        RETURN HorasSemana * CostoSemana
    )
    
RETURN 
    DIVIDE(CostoTotal, HorasTotales, 0)
```

### Utilizacion Mensual %

```dax
VAR HorasMensuales = 
    CALCULATE(
        SUM('AnalisisCostosMes'[Valor]),
        AnalisisCostosMes[Indicador] = "Horas"
    )
VAR RecuentoSemanas = 
    DISTINCTCOUNT(AnalisisCostosMes[Semana])
VAR TotalHorasBase = RecuentoSemanas * 105
RETURN
    DIVIDE(HorasMensuales, TotalHorasBase, 0)
```


## Metas2026

### Meta_Indisponibilidad

```dax
// 1. Identificamos la familia del equipo en el contexto actual
VAR FamiliaActual = SELECTEDVALUE ( 'DIM_EQUIPOS'[Familia] )

// 2. Traemos la meta de disponibilidad correspondiente a esa familia
VAR MetaDispAsignada = 
    SWITCH (
        FamiliaActual,
        "PERFORACION MECANIZADA", [MetaDispBoomer],
        "EQUIPOS DE SOSTENIMIENTO", [MetaDispSostenimiento],
        "ACARREO MECANIZADO", [MetaDipCamiones],
        "TIRO LARGO", [MetaDispSimba],
        "CARGADORAS BP FLOTA VIEJA", [MetaDispCargadorasFlotaVieja],
        "CARGADORAS BP", [MetaDispCargadorasBP]
    )

// 3. Convertimos la meta de disponibilidad a meta de indisponibilidad
VAR MetaIndisp = 
    IF (
        NOT ISBLANK ( MetaDispAsignada ),
        1 - MetaDispAsignada,
        BLANK()
    )

RETURN
    MetaIndisp
```

### Meta_Disp

```dax
VAR MesesVisibles =
    ADDCOLUMNS (
        SUMMARIZE ( DIM_TIEMPO, DIM_TIEMPO[Año], DIM_TIEMPO[Mes] ),
        "@MesIni", DATE ( DIM_TIEMPO[Año], DIM_TIEMPO[Mes], 1 ),
        "@Dias",   CALCULATE ( COUNTROWS ( DIM_TIEMPO ) )
    )
VAR ConMeta =
    ADDCOLUMNS (
        MesesVisibles,
        "@Meta",
            VAR MesIni = [@MesIni]
            RETURN
                CALCULATE (
                    AVERAGE ( Metas2026[Meta_Disponibilidad] ),
                    REMOVEFILTERS ( DIM_TIEMPO ),
                    TREATAS ( { MesIni }, Metas2026[Mes] )
                )
    )
VAR Validos     = FILTER ( ConMeta, NOT ISBLANK ( [@Meta] ) )
VAR Numerador   = SUMX ( Validos, [@Meta] * [@Dias] )
VAR Denominador = SUMX ( Validos, [@Dias] )
RETURN
    DIVIDE ( Numerador, Denominador )
```

### Color_Disponibilidad

```dax
IF(
    [Meta_Disp] <= [Disp Din %],
    "#00493C", // Tu color verde oscuro actual para cuando SÍ cumple
    "#F89221"  // El color naranja/rojo para cuando NO supera la meta
)
```

### Brecha_Disp

```dax
VAR DispReal = [Disponibilidad %]
VAR MetaActual = [Meta_Disp] // Reemplaza con el nombre exacto de tu medida de meta

VAR Diferencia = 
    IF (
        NOT ISBLANK ( DispReal ) && NOT ISBLANK ( MetaActual ),
        DispReal - MetaActual,
        BLANK()
    )

RETURN
    Diferencia
```

### _Debug_Ponderacion

```dax
CONCATENATEX (
    ADDCOLUMNS (
        SUMMARIZE ( DIM_TIEMPO, DIM_TIEMPO[Año], DIM_TIEMPO[Mes] ),
        "@Dias", CALCULATE ( COUNTROWS ( DIM_TIEMPO ) )
    ),
    FORMAT ( DIM_TIEMPO[Mes], "00" ) & "/" & DIM_TIEMPO[Año] & " = " & [@Dias] & "d",
    "  |  "
)
```


## Metricas

### TiempoDeParoMecanico

```dax
COALESCE(
    CALCULATE(
        SUM(HECHOS_DATAMES_NPI_PP[Minutos_Paro_Ajustados]),
        'DIM_RESPONSABLE'[IDResponsable] IN { "T-MTO-ME", "T-MTO-EL" }
    ),
    0
)
```

### Disponibilidad %

```dax
// 1. Llamamos a las medidas que ya creadas
VAR Programado = [Tiempo_Programado]
VAR Paro = [TiempoDeParoGeneral]

// 2. Calculamos el tiempo real que el equipo estuvo disponible
VAR TiempoOperativo = Programado - Paro

// 3. Si el tiempo operativo es negativo, lo forzamos a 0
VAR TiempoOperativoAjustado = MAX ( 0, TiempoOperativo )

// 4. Calculamos el porcentaje final
VAR Disponibilidad = 
    DIVIDE (
        TiempoOperativoAjustado,
        Programado,
        0 // Esto evita el error de "infinito" si el tiempo programado llega a ser 0
    )

RETURN
    Disponibilidad
```

### Tiempo_Programado

```dax
VAR FechaInicio = MIN ( 'DIM_TIEMPO'[Fecha] )
VAR FechaFin    = MAX ( 'DIM_TIEMPO'[Fecha] )
VAR DiasFiltrados = DATEDIFF ( FechaInicio, FechaFin, DAY ) + 1
VAR MinutosCalendario = DiasFiltrados * 60 * [HSelecDisp]
VAR CantidadEquipos = DISTINCTCOUNT ( DIM_EQUIPOS[IDEQUIPO] )
RETURN
    IF ( NOT ISBLANK ( FechaInicio ), MinutosCalendario * CantidadEquipos )
```

### MTBF_Horas

```dax
// 1. Aislamos el paro mecánico exclusivamente para fallas (NPI)
VAR ParoMecanicoNPI = [TiempoDeParoMtbf]

// 2. Calcular el Tiempo Operativo Real en minutos (Uptime) para evitar negativos
VAR TiempoOperativoMinutos = MAX ( 0, [Tiempo_Programado] - ParoMecanicoNPI )

// 3. Convertir minutos operativos a horas
VAR TiempoOperativoHoras = DIVIDE ( TiempoOperativoMinutos, 60 )

// 4. Contar la cantidad de fallas (Eventos NPI)
// Asumimos que cada fila en la base de datos NPI representa un evento/aviso de falla
VAR CantidadFallas = 
    CALCULATE (
        COUNTROWS ( HECHOS_DATAMES_NPI_PP ),
        DIM_TIPOMANTTO[IDTIPO DE MANTTO] = "NPI",
        'DIM_RESPONSABLE'[IDResponsable] IN { "T-MTO-ME", "T-MTO-EL" }
    )

// 5. Calcular el MTBF
VAR MTBF = 
    DIVIDE (
        TiempoOperativoHoras,
        CantidadFallas,
        BLANK()
    )

RETURN
    MTBF
```

### MTTR_Horas

```dax
// 1. Tomamos el tiempo de paro mecánico PERO filtrado solo para NPI, y lo pasamos a horas
VAR TiempoParoHoras = 
    DIVIDE ( 
        CALCULATE (
            [TiempoDeParoMecanico],
            DIM_TIPOMANTTO[IDTIPO DE MANTTO] = "NPI"
        ), 
        60 
    )

// 2. Contamos la cantidad de fallas (Eventos NPI)
VAR CantidadFallas = 
    CALCULATE (
        COUNTROWS ( HECHOS_DATAMES_NPI_PP ),
        DIM_TIPOMANTTO[IDTIPO DE MANTTO] = "NPI",
        'DIM_RESPONSABLE'[IDResponsable] IN { "T-MTO-ME", "T-MTO-EL" }
    )

// 3. Calculamos el MTTR: Horas de paro NPI / Cantidad de fallas NPI
VAR MTTR = 
    DIVIDE (
        TiempoParoHoras,
        CantidadFallas,
        BLANK() // Si no hay fallas, el MTTR queda en blanco (no aplica)
    )

RETURN
    MTTR
```

### Confiabilidad_24h

```dax
// 1. Definimos el tiempo objetivo de evaluación en horas
VAR TiempoObjetivo = [HSelecConf]

// 2. Llamamos la medida de MTBF
VAR MTBF = [MTBF_H]

// 3. Aplicamos la fórmula matemática R(t) = e^(-t/MTBF) con la validación de 0
VAR Confiabilidad = 
    IF (
        ISBLANK ( MTBF ), 1,             // Si no hubo fallas, 100% confiable
        IF (
            MTBF = 0, 0,                 // Si el Uptime fue 0, 0% confiable
            EXP ( - DIVIDE ( TiempoObjetivo, MTBF ) )
        )
    )

RETURN
    Confiabilidad
```

### Top_5_Paros_Prolongados

```dax
// 1. Calculamos el ranking evaluando AMBAS columnas que están en tu tabla visual
VAR Rango = 
    RANKX (
        ALLSELECTED ( 
            HECHOS_DATAMES_NPI_PP[DesEquipo], 
            HECHOS_DATAMES_NPI_PP[Desc de Paro] 
        ), 
        [TiempoDeParoMecanico],
        ,
        DESC,
        DENSE
    )

// 2. Si el rango es 5 o menor, mostramos el valor. Si no, forzamos un vacío para ocultar la fila.
VAR Resultado = 
    IF ( 
        Rango <= 5 && [TiempoDeParoMecanico] > 0, 
        [TiempoDeParoMecanico], 
        BLANK() 
    )

RETURN 
    Resultado
```

### Variacion_Horometro_Diesel

```dax
SUMX (
    VALUES ( HECHOS_HMOTOR_D[Equipo] ), // Obliga a evaluar equipo por equipo
    
    // 1. Encontrar la primera y última fecha en el periodo filtrado para esa máquina
    VAR FechaMinima = MIN ( HECHOS_HMOTOR_D[Fecha] )
    VAR FechaMaxima = MAX ( HECHOS_HMOTOR_D[Fecha] )
    
    // 2. Extraer el valor del horómetro en esa primera fecha
    VAR HorometroInicial = 
        CALCULATE (
            MIN ( HECHOS_HMOTOR_D[Horas_Diesel] ),
            HECHOS_HMOTOR_D[Fecha] = FechaMinima
        )
        
    // 3. Extraer el valor del horómetro en esa última fecha
    VAR HorometroFinal = 
        CALCULATE (
            MAX ( HECHOS_HMOTOR_D[Horas_Diesel] ),
            HECHOS_HMOTOR_D[Fecha] = FechaMaxima
        )
        
    // 4. Calcular la variación del periodo
    RETURN
        HorometroFinal - HorometroInicial
)
```

### Variacion_Motor_Electrico

```dax
SUMX (
    // 1. Iteramos por Equipo Y por Tipo de Horómetro para no cruzar medidores
    SUMMARIZE ( 
        'HECHOS_H-ELEC-P', 
        'HECHOS_H-ELEC-P'[Equipo], 
        'HECHOS_H-ELEC-P'[TipoHorometro] 
    ),
    
    VAR NombreMaquina = 'HECHOS_H-ELEC-P'[Equipo]
    VAR TipoMedidor = 'HECHOS_H-ELEC-P'[TipoHorometro]
    
    // 2. Agrupamos las máquinas según el horómetro que utilizan
    VAR EsBoomer2o3 = 
        NombreMaquina = "PERFORADORA BOOMER 282 EPIROC No. 02" || 
        NombreMaquina = "PERFORADORA BOOMER 282 EPIROC No.03"
        
    VAR UsaCompresor = 
        CONTAINSSTRING ( NombreMaquina, "SIMBA" ) || 
        CONTAINSSTRING ( NombreMaquina, "BOLTEC" ) ||
        NombreMaquina = "PERFORADORA BOOMER 282 EPIROC No. 01" 
        
    // 3. EL SEMÁFORO: Decidimos qué medidor sumar
    VAR IncluirMedidor = 
        SWITCH (
            TRUE(),
            EsBoomer2o3, CONTAINSSTRING ( TipoMedidor, "PERCUSION" ), // Boomer 2 y 3 (Brazos)
            UsaCompresor, CONTAINSSTRING ( TipoMedidor, "COMPRESOR" ), // Boomer 1, Simba, Boltec
            CONTAINSSTRING ( TipoMedidor, "MOTOR" ) // Por si tienes bombas/ventiladores
        )
        
    // 4. Calculamos la variación (Último - Primero) ignorando los ceros (Valor > 0)
    VAR Variacion = 
        IF (
            IncluirMedidor,
            
            VAR FechaMinima = 
                CALCULATE ( MIN ( 'HECHOS_H-ELEC-P'[FechaHorometro_ELEC_P] ), 'HECHOS_H-ELEC-P'[Valor contador] > 0 )
            VAR FechaMaxima = 
                CALCULATE ( MAX ( 'HECHOS_H-ELEC-P'[FechaHorometro_ELEC_P] ), 'HECHOS_H-ELEC-P'[Valor contador] > 0 )
            
            VAR HorometroInicial = 
                CALCULATE ( 
                    MIN ( 'HECHOS_H-ELEC-P'[Valor contador] ), 
                    'HECHOS_H-ELEC-P'[FechaHorometro_ELEC_P] = FechaMinima,
                    'HECHOS_H-ELEC-P'[Valor contador] > 0
                )
            VAR HorometroFinal = 
                CALCULATE ( 
                    MAX ( 'HECHOS_H-ELEC-P'[Valor contador] ), 
                    'HECHOS_H-ELEC-P'[FechaHorometro_ELEC_P] = FechaMaxima,
                    'HECHOS_H-ELEC-P'[Valor contador] > 0
                )
                
            RETURN 
                IF ( NOT ISBLANK(HorometroFinal) && NOT ISBLANK(HorometroInicial), HorometroFinal - HorometroInicial, 0 ),
            
            0 // Si el medidor no aplica, no suma nada
        )
        
    RETURN 
        Variacion
)
```

### MetaDispSimba

```dax
CALCULATE (
    AVERAGE ( Metas2026[Meta_Disponibilidad] ),
    Metas2026[Familia] = "TIRO LARGO"
)
```

### MetaDispBoomer

```dax
CALCULATE (
    AVERAGE ( Metas2026[Meta_Disponibilidad] ),
    Metas2026[Familia] = "PERFORACION MECANIZADA"
)
```

### MetaDispSostenimiento

```dax
CALCULATE (
    AVERAGE ( Metas2026[Meta_Disponibilidad] ),
    Metas2026[Familia] = "EQUIPOS DE SOSTENIMIENTO"
)
```

### MetaDipCamiones

```dax
CALCULATE (
    AVERAGE ( Metas2026[Meta_Disponibilidad] ),
    Metas2026[Familia] = "ACARREO MECANIZADO"
)
```

### PresupuestoPrev/Sem

```dax
72053.38
```

### ProbabilidadDeFalla

```dax
1 - [Confiabilidad_24h]
```

### TiempoDeParoGeneral

```dax
COALESCE(
    CALCULATE(
        SUM(HECHOS_DATAMES_NPI_PP[Minutos_Paro_Ajustados]),
        DIM_RESPONSABLE[IDResponsable] <> "T-FES-NI"
    ),
    0
)
```

### TiempoDeParoMtbf

```dax
COALESCE(
    CALCULATE(
        SUM(HECHOS_DATAMES_NPI_PP[Minutos_Paro_Ajustados]),
        'DIM_RESPONSABLE'[IDResponsable] IN { "T-MTO-ME", "T-MTO-EL" },
        DIM_TIPOMANTTO[IDTIPO DE MANTTO] = "NPI"
    ),
    0
)
```

### Brecha_Disponibilidad

```dax
// 1. Identificamos la familia del equipo en esa fila
VAR FamiliaActual = SELECTEDVALUE ( 'DIM_EQUIPOS'[Familia])

// 2. Traemos la meta correspondiente a esa familia
VAR MetaAsignada = 
    SWITCH (
        FamiliaActual,
        "PERFORACION MECANIZADA", [MetaDispBoomer],
        "EQUIPOS DE SOSTENIMIENTO", [MetaDispSostenimiento],
        "ACARREO MECANIZADO", [MetaDipCamiones],
        "TIRO LARGO", [MetaDispSimba],
        "CARGADORAS BP FLOTA VIEJA", [MetaDispCargadorasFlotaVieja],
        "CARGADORAS BP", [MetaDispCargadorasBP]
    )

// 3. Traemos la disponibilidad real
VAR DispReal = [Disponibilidad %]

// 4. Calculamos la diferencia
// Resultado Positivo = Superó la meta | Resultado Negativo = No llegó a la meta
VAR Diferencia = 
    IF (
        NOT ISBLANK ( MetaAsignada ) && NOT ISBLANK ( DispReal ),
        DispReal - MetaAsignada,
        BLANK()
    )

RETURN
    Diferencia
```

### MetaDispCargadorasFlotaVieja

```dax
CALCULATE (
    AVERAGE ( Metas2026[Meta_Disponibilidad] ),
    Metas2026[Familia] = "CARGADORAS BP FLOTA VIEJA"
)
```

### MetaDispCargadorasBP

```dax
CALCULATE (
    AVERAGE ( Metas2026[Meta_Disponibilidad] ),
    Metas2026[Familia] = "CARGADORAS BP"
)
```

### Indisponibilidad%

```dax
1 - [Disponibilidad %]
```

### Horas_Diesel_Periodo_Interpolado

```dax
SUMX (
    VALUES ( HORO_CONSOL[Equipo] ), // Evaluamos máquina por máquina (Scooptram vs Simba)

    // 1. Definimos los bordes del periodo. Restamos 1 al inicio para capturar el trabajo del primer día.
    VAR FechaFin = MAX ( DIM_TIEMPO[Fecha] )
    VAR FechaInicio = MIN (DIM_TIEMPO[Fecha] ) - 1

    // =========================================================
    // 2. INTERPOLACIÓN: HORÓMETRO AL INICIO DEL PERIODO
    // =========================================================
    VAR Ini_FechaAnt = CALCULATE ( MAX ( HORO_CONSOL[Fecha] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] <= FechaInicio, HORO_CONSOL[Max_Diesel] > 0 )
    VAR Ini_FechaSig = CALCULATE ( MIN ( HORO_CONSOL[Fecha] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] >= FechaInicio, HORO_CONSOL[Max_Diesel] > 0 )

    VAR Ini_ValAnt = CALCULATE ( MAX ( HORO_CONSOL[Max_Diesel] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] = Ini_FechaAnt )
    VAR Ini_ValSig = CALCULATE ( MAX ( HORO_CONSOL[Max_Diesel] ), ALL ( DIM_TIEMPO), HORO_CONSOL[Fecha] = Ini_FechaSig )

    VAR Ini_DiasBrecha = DATEDIFF ( Ini_FechaAnt, Ini_FechaSig, DAY )
    
    // Fórmula de la recta para calcular el valor exacto en el día de inicio
    VAR Horo_Inicial = 
        IF (
            Ini_DiasBrecha = 0, Ini_ValAnt, 
            Ini_ValAnt + DIVIDE ( Ini_ValSig - Ini_ValAnt, Ini_DiasBrecha ) * DATEDIFF ( Ini_FechaAnt, FechaInicio, DAY )
        )

    // =========================================================
    // 3. INTERPOLACIÓN: HORÓMETRO AL FINAL DEL PERIODO
    // =========================================================
    VAR Fin_FechaAnt = CALCULATE ( MAX ( HORO_CONSOL[Fecha] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] <= FechaFin, HORO_CONSOL[Max_Diesel] > 0 )
    VAR Fin_FechaSig = CALCULATE ( MIN ( HORO_CONSOL[Fecha] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] >= FechaFin, HORO_CONSOL[Max_Diesel] > 0 )

    VAR Fin_ValAnt = CALCULATE ( MAX ( HORO_CONSOL[Max_Diesel] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] = Fin_FechaAnt )
    VAR Fin_ValSig = CALCULATE ( MAX ( HORO_CONSOL[Max_Diesel] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] = Fin_FechaSig )

    VAR Fin_DiasBrecha = DATEDIFF ( Fin_FechaAnt, Fin_FechaSig, DAY )
    
    // Fórmula de la recta para calcular el valor exacto en el día final
    VAR Horo_Final = 
        IF (
            Fin_DiasBrecha = 0, Fin_ValAnt, 
            Fin_ValAnt + DIVIDE ( Fin_ValSig - Fin_ValAnt, Fin_DiasBrecha ) * DATEDIFF ( Fin_FechaAnt, FechaFin, DAY )
        )

    // =========================================================
    // 4. RESULTADO: DIFERENCIA TOTAL (HORAS OPERATIVAS)
    // =========================================================
    VAR Horas_Trabajadas = Horo_Final - Horo_Inicial

    RETURN
        // Candado para evitar números negativos si hay cambios de panel o reseteos en SAP
        IF ( Horas_Trabajadas >= 0, Horas_Trabajadas, BLANK() ) 
)
```

### Horas_Diesel_Registradas

```dax
SUMX (
    VALUES ( HORO_CONSOL[Equipo] ), // Aísla el cálculo por equipo (Scooptram ST1030, etc.)
    
    // 1. Encontramos la primera y última fecha CON REGISTRO dentro del periodo filtrado
    VAR FechaPrimera = CALCULATE ( MIN ( HORO_CONSOL[Fecha] ), HORO_CONSOL[Max_Diesel] > 0 )
    VAR FechaUltima = CALCULATE ( MAX ( HORO_CONSOL[Fecha] ), HORO_CONSOL[Max_Diesel] > 0 )
    
    // 2. Extraemos el valor del horómetro en esas fechas exactas
    VAR HoroInicial = CALCULATE ( MAX ( HORO_CONSOL[Max_Diesel] ), HORO_CONSOL[Fecha] = FechaPrimera )
    VAR HoroFinal = CALCULATE ( MAX ( HORO_CONSOL[Max_Diesel] ), HORO_CONSOL[Fecha] = FechaUltima )
    
    // 3. Calculamos la diferencia neta
    VAR Diferencia = HoroFinal - HoroInicial
    
    // Retornamos el valor asegurando que no haya negativos por reseteos o cambios de panel en taller
    RETURN
        IF ( Diferencia >= 0, Diferencia, BLANK() )
)
```

### Horas_Electrico_Registradas

```dax
SUMX (
    VALUES ( HORO_CONSOL[Equipo] ), // Aísla el cálculo por equipo (Boomer, Simba, Boltec, etc.)
    
    // 1. Encontramos la primera y última fecha CON REGISTRO dentro del periodo filtrado
    VAR FechaPrimera = CALCULATE ( MIN ( HORO_CONSOL[Fecha] ), HORO_CONSOL[HorometroElecAjustado] > 0 )
    VAR FechaUltima = CALCULATE ( MAX ( HORO_CONSOL[Fecha] ), HORO_CONSOL[HorometroElecAjustado] > 0 )
    
    // 2. Extraemos el valor del horómetro en esas fechas exactas
    VAR HoroInicial = CALCULATE ( MAX ( HORO_CONSOL[HorometroElecAjustado] ), HORO_CONSOL[Fecha] = FechaPrimera )
    VAR HoroFinal = CALCULATE ( MAX ( HORO_CONSOL[HorometroElecAjustado] ), HORO_CONSOL[Fecha] = FechaUltima )
    
    // 3. Calculamos la diferencia neta
    VAR Diferencia = HoroFinal - HoroInicial
    
    // Retornamos el valor asegurando que no haya negativos por reseteos o cambios de panel en taller
    RETURN
        IF ( Diferencia >= 0, Diferencia, BLANK() )
)
```

### TiempoOperadoPorEquipo

```dax
[Horas_Diesel_Registradas] + [Horas_Electrico_Registradas]
```

### Horas_Electrico_Periodo_Interpolado

```dax
SUMX (
    VALUES ( HORO_CONSOL[Equipo] ), // Evaluamos máquina por máquina (Boomer, Simba, Boltec)

    // 1. Definimos los bordes del periodo. Restamos 1 al inicio para capturar el trabajo del primer día.
    VAR FechaFin = MAX ( DIM_TIEMPO[Fecha] )
    VAR FechaInicio = MIN (DIM_TIEMPO[Fecha] ) - 1

    // =========================================================
    // 2. INTERPOLACIÓN: HORÓMETRO AL INICIO DEL PERIODO
    // =========================================================
    VAR Ini_FechaAnt = CALCULATE ( MAX ( HORO_CONSOL[Fecha] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] <= FechaInicio, HORO_CONSOL[HorometroElecAjustado] > 0 )
    VAR Ini_FechaSig = CALCULATE ( MIN ( HORO_CONSOL[Fecha] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] >= FechaInicio, HORO_CONSOL[HorometroElecAjustado] > 0 )

    VAR Ini_ValAnt = CALCULATE ( MAX ( HORO_CONSOL[HorometroElecAjustado] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] = Ini_FechaAnt )
    VAR Ini_ValSig = CALCULATE ( MAX ( HORO_CONSOL[HorometroElecAjustado] ), ALL ( DIM_TIEMPO), HORO_CONSOL[Fecha] = Ini_FechaSig )

    VAR Ini_DiasBrecha = DATEDIFF ( Ini_FechaAnt, Ini_FechaSig, DAY )
    
    // Fórmula de la recta para calcular el valor exacto en el día de inicio
    VAR Horo_Inicial = 
        IF (
            Ini_DiasBrecha = 0, Ini_ValAnt, 
            Ini_ValAnt + DIVIDE ( Ini_ValSig - Ini_ValAnt, Ini_DiasBrecha ) * DATEDIFF ( Ini_FechaAnt, FechaInicio, DAY )
        )

    // =========================================================
    // 3. INTERPOLACIÓN: HORÓMETRO AL FINAL DEL PERIODO
    // =========================================================
    VAR Fin_FechaAnt = CALCULATE ( MAX ( HORO_CONSOL[Fecha] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] <= FechaFin, HORO_CONSOL[HorometroElecAjustado] > 0 )
    VAR Fin_FechaSig = CALCULATE ( MIN ( HORO_CONSOL[Fecha] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] >= FechaFin, HORO_CONSOL[HorometroElecAjustado] > 0 )

    VAR Fin_ValAnt = CALCULATE ( MAX ( HORO_CONSOL[HorometroElecAjustado] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] = Fin_FechaAnt )
    VAR Fin_ValSig = CALCULATE ( MAX ( HORO_CONSOL[HorometroElecAjustado] ), ALL ( DIM_TIEMPO ), HORO_CONSOL[Fecha] = Fin_FechaSig )

    VAR Fin_DiasBrecha = DATEDIFF ( Fin_FechaAnt, Fin_FechaSig, DAY )
    
    // Fórmula de la recta para calcular el valor exacto en el día final
    VAR Horo_Final = 
        IF (
            Fin_DiasBrecha = 0, Fin_ValAnt, 
            Fin_ValAnt + DIVIDE ( Fin_ValSig - Fin_ValAnt, Fin_DiasBrecha ) * DATEDIFF ( Fin_FechaAnt, FechaFin, DAY )
        )

    // =========================================================
    // 4. RESULTADO: DIFERENCIA TOTAL (HORAS OPERATIVAS)
    // =========================================================
    VAR Horas_Trabajadas = Horo_Final - Horo_Inicial

    RETURN
        // Candado para evitar números negativos si hay cambios de panel o reseteos en SAP
        IF ( Horas_Trabajadas >= 0, Horas_Trabajadas, BLANK() ) 
)
```

### tiempoOPInterpolado

```dax
[Horas_Diesel_Periodo_Interpolado] + [Horas_Electrico_Periodo_Interpolado]
```

### Tiempo_Prog (Util)

```dax
// 1. Capturamos la primera y última fecha del filtro global
VAR FechaInicio = CALCULATE ( MIN ( 'DIM_TIEMPO'[Fecha] ), ALLSELECTED () )
VAR FechaFin = CALCULATE ( MAX ( 'DIM_TIEMPO'[Fecha] ), ALLSELECTED () )

// 2. Calculamos los días exactos de ese rango
VAR DiasFiltrados = DATEDIFF ( FechaInicio, FechaFin, DAY ) + 1

// 3. Calculamos el tiempo del calendario base
VAR MinutosCalendario = DiasFiltrados * 15

// 4. NUEVO: Contamos cuántos equipos hay en la fila o agrupación actual
VAR CantidadEquipos = DISTINCTCOUNT ( DIM_EQUIPOS[IDEQUIPO])

// 5. Multiplicamos el tiempo calendario por la cantidad de equipos
VAR TotalMinutos = MinutosCalendario * CantidadEquipos

RETURN 
    TotalMinutos
```

### Utilizacion_%

```dax
DIVIDE (
    [TiempoOperadoPorEquipo],
    [Tiempo_Prog (Util)],
    BLANK() // Deja la celda vacía si no hay datos, manteniendo la tabla limpia
)
```

### RelacionDiesel/Electrico

```dax
DIVIDE(
[Horas_Diesel_Registradas], [Horas_Electrico_Registradas],0)
```

### Semaforo_Proactivo

```dax
VAR Brecha = [Brecha_Disponibilidad] // Tu medida: Real - Meta

RETURN
SWITCH( TRUE(),
    ISBLANK(Brecha), BLANK(),
    
    -- CASO 1: Por debajo de la meta (Incumplimiento)
    Brecha < 0, 1, 
    
    -- CASO 2: Entre 0% y 5% por encima (Zona de Alerta Preventiva)
    Brecha >= 0 && Brecha <= 0.05, 2, 
    
    -- CASO 3: Más del 5% por encima (Cumplimiento Seguro)
    Brecha > 0.05, 3
)
```

### HSelecConf

```dax
SELECTEDVALUE(Confiabilidad[Horas],24)
```

### %Indisponibilidad

```dax
1 - [Disp Din %]
```

### HSelecDisp

```dax
SELECTEDVALUE('Var_t: Disp'[Horas],18)
```

### Tiempo_Prog (18HRS)

```dax
// 1. Capturamos la primera y última fecha del filtro global
VAR FechaInicio = CALCULATE ( MIN ( 'DIM_TIEMPO'[Fecha] ), ALLSELECTED () )
VAR FechaFin = CALCULATE ( MAX ( 'DIM_TIEMPO'[Fecha] ), ALLSELECTED () )

// 2. Calculamos los días exactos de ese rango
VAR DiasFiltrados = DATEDIFF ( FechaInicio, FechaFin, DAY ) + 1

// 3. Calculamos el tiempo del calendario base
VAR MinutosCalendario = DiasFiltrados * 18 * 60

// 4. NUEVO: Contamos cuántos equipos hay en la fila o agrupación actual
VAR CantidadEquipos = DISTINCTCOUNT ( DIM_EQUIPOS[IDEQUIPO])

// 5. Multiplicamos el tiempo calendario por la cantidad de equipos
VAR TotalMinutos = MinutosCalendario * CantidadEquipos

RETURN 
    TotalMinutos
```

### Disponibilidad %(18HRS)

```dax
// 1. Llamamos a las medidas que ya creadas
VAR Programado = [Tiempo_Prog (18HRS)]
VAR Paro = [TiempoDeParoGeneral]

// 2. Calculamos el tiempo real que el equipo estuvo disponible
VAR TiempoOperativo = Programado - Paro

// 3. Si el tiempo operativo es negativo, lo forzamos a 0
VAR TiempoOperativoAjustado = MAX ( 0, TiempoOperativo )

// 4. Calculamos el porcentaje final
VAR Disponibilidad = 
    DIVIDE (
        TiempoOperativoAjustado,
        Programado,
        0 // Esto evita el error de "infinito" si el tiempo programado llega a ser 0
    )

RETURN
    Disponibilidad
```

### DeltaDisp

```dax
[Disponibilidad %(18HRS)]-[Disponibilidad %]
```

### TiempoTotalParo(Hora)

```dax
DIVIDE([TiempoDeParoGeneral],60,0)
```

### MetaDispPorEquipo

```dax
AVERAGE(Metas2026[Meta_Disponibilidad])
```

### T_PARO(AVERIAS)

```dax
DIVIDE([TiempoDeParoMtbf],60,0)
```


## Metricas (2)

### _Cantidad Fallas NPI

```dax
VAR _ini = MIN ( 'DIM_TIEMPO'[Fecha] )
VAR _fin = MAX ( 'DIM_TIEMPO'[Fecha] ) + 1
RETURN
    COALESCE (
        CALCULATE (
            COUNTROWS (
                FILTER (
                    HECHOS_DATAMES_NPI_PP,
                    HECHOS_DATAMES_NPI_PP[_F/H Fin] > HECHOS_DATAMES_NPI_PP[_F/H Inicio]
                        && HECHOS_DATAMES_NPI_PP[_F/H Inicio] < _fin
                        && HECHOS_DATAMES_NPI_PP[_F/H Fin] > _ini
                )
            ),
            DIM_TIPOMANTTO[IDTIPO DE MANTTO] = "NPI",
            'DIM_RESPONSABLE'[IDResponsable] IN { "T-MTO-ME", "T-MTO-EL" },
            REMOVEFILTERS ( 'DIM_TIEMPO' )
        ),
        0
    )
```

### Paro General 24h

```dax
COALESCE (
    CALCULATE (
        SUM ( HECHOS_DATAMES_NPI_PP[Duración parada (Mins)] ),
        'DIM_RESPONSABLE'[IDResponsable] <> "T-FES-NI"
    ),
    0
)
```

### Paro NPI Mtto 24h

```dax
COALESCE (
    CALCULATE (
        SUM ( HECHOS_DATAMES_NPI_PP[Duración parada (Mins)] ),
        'DIM_RESPONSABLE'[IDResponsable] IN { "T-MTO-ME", "T-MTO-EL" },
        DIM_TIPOMANTTO[IDTIPO DE MANTTO] = "NPI"
    ),
    0
)
```

### Paro General 18h

```dax
COALESCE (
    CALCULATE (
        SUM ( HECHOS_DATAMES_NPI_PP[Minutos_Paro_Ajustados] ),
        'DIM_RESPONSABLE'[IDResponsable] <> "T-FES-NI"
    ),
    0
)
```

### Paro NPI Mtto 18h

```dax
COALESCE (
    CALCULATE (
        SUM ( HECHOS_DATAMES_NPI_PP[Minutos_Paro_Ajustados] ),
        'DIM_RESPONSABLE'[IDResponsable] IN { "T-MTO-ME", "T-MTO-EL" },
        DIM_TIPOMANTTO[IDTIPO DE MANTTO] = "NPI"
    ),
    0
)
```

### Paro General Ventana

```dax
COALESCE (
    CALCULATE ( [Min Paro Ventana], 'DIM_RESPONSABLE'[IDResponsable] <> "T-FES-NI" ),
    0
)
```

### Paro NPI Ventana

```dax
COALESCE (
    CALCULATE (
        [Min Paro Ventana],
        'DIM_RESPONSABLE'[IDResponsable] IN { "T-MTO-ME", "T-MTO-EL" },
        DIM_TIPOMANTTO[IDTIPO DE MANTTO] = "NPI"
    ),
    0
)
```

### Disp Din %

```dax
VAR Programado = [Tiempo_Programado]
VAR Paro = [Paro General Ventana]
VAR TiempoOperativoAjustado = MAX ( 0, Programado - Paro )
RETURN
    IF ( Programado > 0, DIVIDE ( TiempoOperativoAjustado, Programado, 0 ) )
```

### MTTR_H

```dax
DIVIDE ( DIVIDE ( [Paro NPI Ventana], 60 ), [_Cantidad Fallas NPI], BLANK () )
```

### MTBF_H

```dax
VAR TiempoOperativoMinutos = MAX ( 0, [Tiempo_Programado] - [Paro NPI Ventana] )
VAR TiempoOperativoHoras = DIVIDE ( TiempoOperativoMinutos, 60 )
RETURN
    DIVIDE ( TiempoOperativoHoras, [_Cantidad Fallas NPI], BLANK () )
```

### Brecha_Disp dn

```dax
VAR DispReal = [Disp Din %]
VAR MetaActual = [Meta_Disp] // Reemplaza con el nombre exacto de tu medida de meta

VAR Diferencia = 
    IF (
        NOT ISBLANK ( DispReal ) && NOT ISBLANK ( MetaActual ),
        DispReal - MetaActual,
        BLANK()
    )

RETURN
    Diferencia
```

### Título Ventana

```dax
"Indicadores — " & SELECTEDVALUE ( 'Var_t: Disp'[Var_t: Disp], "18 hrs — Operativa" )
```

### Min Paro Ventana

```dax
VAR _ini = MIN ( 'DIM_TIEMPO'[Fecha] )
VAR _fin = MAX ( 'DIM_TIEMPO'[Fecha] ) + 1
VAR _hpm = [HSelecDisp] * 60
RETURN
    CALCULATE (
        SUMX (
            FILTER (
                HECHOS_DATAMES_NPI_PP,
                HECHOS_DATAMES_NPI_PP[_F/H Fin] >= HECHOS_DATAMES_NPI_PP[_F/H Inicio]
                    && HECHOS_DATAMES_NPI_PP[_F/H Inicio] < _fin
                    && HECHOS_DATAMES_NPI_PP[_F/H Fin] > _ini
            ),
            VAR j  = HECHOS_DATAMES_NPI_PP[_F/H Inicio]
            VAR k  = HECHOS_DATAMES_NPI_PP[_F/H Fin]
            VAR dR = MIN ( MAX ( _ini, j ), k ) - j
            VAR r  = INT ( dR ) * _hpm + MIN ( MOD ( dR * 1440, 1440 ), _hpm )
            VAR dS = MIN ( MAX ( _fin, j ), k ) - j
            VAR s  = INT ( dS ) * _hpm + MIN ( MOD ( dS * 1440, 1440 ), _hpm )
            RETURN s - r
        ),
        REMOVEFILTERS ( 'DIM_TIEMPO' )
    )
```

### Dif

```dax
SUM ( HECHOS_DATAMES_NPI_PP[_Paro Total (min)] ) - [Min Paro Ventana]
```

### Hrs Paro Ventana

```dax
VAR m = [Min Paro Ventana]
RETURN IF ( m > 0, DIVIDE ( m, 60 ) )
```

### Disp Acum %

```dax
VAR _ini = CALCULATE ( MIN ( 'DIM_TIEMPO'[Fecha] ), ALLSELECTED ( 'DIM_TIEMPO' ) )
VAR _fin = MAX ( 'DIM_TIEMPO'[Fecha] )
RETURN
    CALCULATE (
        [Disp Din %],
        FILTER (
            ALLSELECTED ( 'DIM_TIEMPO' ),
            'DIM_TIEMPO'[Fecha] >= _ini && 'DIM_TIEMPO'[Fecha] <= _fin
        )
    )
```

### Disp Acum Final

```dax
VAR _ultimoGlobal = CALCULATE ( MAX ( 'DIM_TIEMPO'[Fecha] ), ALLSELECTED ( 'DIM_TIEMPO' ) )
VAR _finContexto  = MAX ( 'DIM_TIEMPO'[Fecha] )
RETURN
    IF ( _finContexto = _ultimoGlobal, [Disp Acum %] )
```


## RelHorometros

### RelElec/Diesel Sem

```dax
DIVIDE(SUM(RelHorometros[Motor Eléctrico (Sem)]),
SUM(RelHorometros[Motor Diesel (Sem)]), BLANK())
```

### RelElec/Diesel(Mes)

```dax
// 1. Capturamos el equipo que se está evaluando en esa línea específica
VAR EquipoActual = SELECTEDVALUE ( RelHorometros[IDEquipo] )

// 2. Preparamos el cálculo de la relación (mantenemos SUM por seguridad en caso de que un equipo tenga 2 registros en el mismo mes)
VAR Ratio = 
    DIVIDE (
        SUM ( RelHorometros[Motor Eléctrico Mes] ),
        SUM ( RelHorometros[Motor Diesel (Mes)] ),
        BLANK()
    )

RETURN
    // 3. El candado: Si EquipoActual detectó UN solo equipo, arroja el ratio. Si no (ej. en el Total General), queda en blanco.
    IF ( 
        NOT ISBLANK ( EquipoActual ), 
        Ratio, 
        BLANK() 
    )
```


## ResultadosCostoXHora

### Meta(Costo/h)

```dax
SUM(ResultadosCostoXHora[META (Costo/h)])
```

### Costo /h

```dax
SUM(ResultadosCostoXHora[Costo/h (Semana)])
```

### IconoCosto

```dax
VAR CostoActual = [Costo /h]
VAR Meta = SELECTEDVALUE(ResultadosCostoXHora[META (Costo/h)])
VAR DiferenciaElt = DIVIDE(CostoActual - Meta, Meta)

RETURN
    SWITCH(
        TRUE(),
        ISBLANK(CostoActual) || ISBLANK(Meta), BLANK(),
        -- Si el costo es menor al 95% de la meta (Verde: Ahorro)
        DiferenciaElt < -0.05, 0, 
        -- Si está entre el 95% y 105% de la meta (Naranja: Tolerancia)
        DiferenciaElt >= -0.05 && DiferenciaElt <= 0.05, 1,
        -- Si es mayor al 105% de la meta (Rojo: Exceso)
        DiferenciaElt > 0.05, 2
    )
```

### IconoCostoAcum

```dax
VAR CostoActual = [AcumCostoMes]
VAR Meta = SELECTEDVALUE(ResultadosCostoXHora[META (Costo/h)])
VAR DiferenciaElt = DIVIDE(CostoActual - Meta, Meta)

RETURN
    SWITCH(
        TRUE(),
        ISBLANK(CostoActual) || ISBLANK(Meta), BLANK(),
        -- Si el costo es menor al 95% de la meta (Verde: Ahorro)
        DiferenciaElt < -0.05, 0, 
        -- Si está entre el 95% y 105% de la meta (Naranja: Tolerancia)
        DiferenciaElt >= -0.05 && DiferenciaElt <= 0.05, 1,
        -- Si es mayor al 105% de la meta (Rojo: Exceso)
        DiferenciaElt > 0.05, 2
    )
```

### AcumCostoMes

```dax
SUM(ResultadosCostoXHora[ACUMULADO MES (Costo/h)])
```

### IconoCostoN

```dax
VAR CostoActual = [TCostoxHora]
VAR Meta =CALCULATE( 
        SELECTEDVALUE(AnalisisCostos[Valor]), 
        AnalisisCostos[Indicador] = "Meta")
VAR DiferenciaElt = DIVIDE(CostoActual - Meta, Meta)

RETURN
    SWITCH(
        TRUE(),
        ISBLANK(CostoActual) || ISBLANK(Meta), BLANK(),
        -- Si el costo es menor al 95% de la meta (Verde: Ahorro)
        DiferenciaElt < -0.05, 0, 
        -- Si está entre el 95% y 105% de la meta (Naranja: Tolerancia)
        DiferenciaElt >= -0.05 && DiferenciaElt <= 0.05, 1,
        -- Si es mayor al 105% de la meta (Rojo: Exceso)
        DiferenciaElt > 0.05, 2
    )
```

### IconoCostoM

```dax
VAR CostoActual = [Costo_Hora_Acumulado]
VAR Meta =CALCULATE( 
        SELECTEDVALUE(AnalisisCostosMes[Valor]), 
        AnalisisCostosMes[Indicador] = "Meta")
VAR DiferenciaElt = DIVIDE(CostoActual - Meta, Meta)

RETURN
    SWITCH(
        TRUE(),
        ISBLANK(CostoActual) || ISBLANK(Meta), BLANK(),
        -- Si el costo es menor al 95% de la meta (Verde: Ahorro)
        DiferenciaElt < -0.05, 0, 
        -- Si está entre el 95% y 105% de la meta (Naranja: Tolerancia)
        DiferenciaElt >= -0.05 && DiferenciaElt <= 0.05, 1,
        -- Si es mayor al 105% de la meta (Rojo: Exceso)
        DiferenciaElt > 0.05, 2
    )
```
