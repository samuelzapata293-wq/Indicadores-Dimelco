# Consultas Power Query

## HECHOS_DATAMES_NPI_PP

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla2_Table = Origen{[Item="Tabla2",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla2_Table,{{"Equipo", Int64.Type}, {"Denominación", type text}, {"Aviso", Int64.Type}, {"Inicio avería", type date}, {"Hora in-avería", type text}, {"Fin de avería", type date}, {"Duración parada", type number}, {"Descripción", type text}, {"Grupo de codigos", type text}, {"Codificación", type text}, {"Codif-txt-cód-", type text}, {"Status usuario", type text}, {"Resumen de actividad", type text}}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Tipo cambiado",{{"Equipo", "IDEQUIPO"}, {"Denominación", "DESCEQUIPO"}}),
    #"Columnas quitadas" = Table.RemoveColumns(#"Columnas con nombre cambiado",{"DESCEQUIPO"}),
    #"Valor reemplazado" = Table.ReplaceValue(#"Columnas quitadas","24:00:00","00:00:00",Replacer.ReplaceText,{"Hora in-avería"}),
    #"Columnas con nombre cambiado1" = Table.RenameColumns(#"Valor reemplazado",{{"Inicio avería", "Fecha Inicio averia"}, {"Hora in-avería", "Hora inicio averia"}, {"Fin de avería", "Fecha Fin de avería"}, {"Hora fin avería", "Hora fin averia"}, {"Duración parada", "Duración parada (Mins)"}, {"Descripción", "Desc de Paro"}, {"Grupo de codigos", "IDResponsable"}, {"Codificación", "CodFalla"}, {"Codif-txt-cód-", "TextodelaFalla"}, {"Status usuario", "IDTIPODEMANTTO"}, {"Resumen de actividad", "Resumen de la actividad"}}),
    #"Filas filtradas" = Table.SelectRows(#"Columnas con nombre cambiado1", each ([Aviso] <> null)),
    #"Consultas combinadas" = Table.NestedJoin(#"Filas filtradas", {"IDEQUIPO"}, DIM_EQUIPOS, {"IDEQUIPO"}, "DIM_EQUIPOS", JoinKind.LeftOuter),
    #"Se expandió DIM_EQUIPOS" = Table.ExpandTableColumn(#"Consultas combinadas", "DIM_EQUIPOS", {"Descripcion"}, {"Descripcion"}),
    #"Columnas con nombre cambiado2" = Table.RenameColumns(#"Se expandió DIM_EQUIPOS",{{"Descripcion", "DesEquipo"}}),
    #"Columnas reordenadas" = Table.ReorderColumns(#"Columnas con nombre cambiado2",{"IDEQUIPO", "DesEquipo", "Aviso", "Fecha Inicio averia", "Hora inicio averia", "Fecha Fin de avería", "Hora fin averia", "Duración parada (Mins)", "Desc de Paro", "IDResponsable", "CodFalla", "TextodelaFalla", "IDTIPODEMANTTO", "Resumen de la actividad"}),
    #"Filas filtradas1" = Table.SelectRows(#"Columnas reordenadas", each ([DesEquipo] <> null)),
    #"Texto insertado después del delimitador" = Table.AddColumn(#"Filas filtradas1", "Tipo de Paro", each Text.AfterDelimiter(Text.Proper([Resumen de la actividad]), " "), type text),
    #"Filas filtradas2" = Table.SelectRows(#"Texto insertado después del delimitador", each ([Fecha Fin de avería] <> null)),
    #"Personalizada agregada" = Table.AddColumn(#"Filas filtradas2", "_F/H Fin", each let
    t = Text.Trim(Text.From([Hora fin averia])),
    p = Text.Split(t, ":"),
    h = Number.From(p{0}),
    m = Number.From(p{1}),
    s = if List.Count(p) > 2 then Number.From(p{2}) else 0
in
    DateTime.From(Date.From([Fecha Fin de avería])) + #duration(0, h, m, s)),
    #"Personalizada agregada1" = Table.AddColumn(#"Personalizada agregada", "Personalizado", each let
    t = Text.Trim(Text.From([Hora inicio averia])),
    p = Text.Split(t, ":"),
    h = Number.From(p{0}),
    m = Number.From(p{1}),
    s = if List.Count(p) > 2 then Number.From(p{2}) else 0
in
    DateTime.From(Date.From([Fecha Inicio averia])) + #duration(0, h, m, s)),
    #"Tipo cambiado1" = Table.TransformColumnTypes(#"Personalizada agregada1",{{"Personalizado", type datetime}, {"_F/H Fin", type datetime}}),
    #"Columnas con nombre cambiado3" = Table.RenameColumns(#"Tipo cambiado1",{{"Personalizado", "_F/H Inicio"}}),
    #"Personalizada agregada2" = Table.AddColumn(#"Columnas con nombre cambiado3", "_Paro Total (min)", each Duration.TotalMinutes([#"_F/H Fin"] - [#"_F/H Inicio"])),
    #"Tipo cambiado2" = Table.TransformColumnTypes(#"Personalizada agregada2",{{"_Paro Total (min)", type number}})
in
    #"Tipo cambiado2"
```

## HECHOS_HMOTOR_D

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    #"MOTOR DIESEL_Sheet" = Origen{[Item="MOTOR DIESEL",Kind="Sheet"]}[Data],
    #"Encabezados promovidos" = Table.PromoteHeaders(#"MOTOR DIESEL_Sheet", [PromoteAllScalars=true]),
    #"Tipo cambiado" = Table.TransformColumnTypes(#"Encabezados promovidos",{{"Fecha", Int64.Type}, {"Hora de", type time}, {"Documento med.", Int64.Type}, {"Punto de medida", Int64.Type}, {"ValMed/ValTotCn", type number}, {"Valor contador", type number}, {"Diferencia", type number}, {"Orden", Int64.Type}, {"Denominación", type text}, {"Creado por", type text}, {"Creado el", type date}, {"Hora", type time}, {"Equipo", Int64.Type}}),
    #"Columnas quitadas" = Table.RemoveColumns(#"Tipo cambiado",{"Hora"}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Columnas quitadas",{{"Creado el", "FechaHorometroDiesel"}}),
    #"Columnas quitadas1" = Table.RemoveColumns(#"Columnas con nombre cambiado",{"Fecha", "Hora de", "ValMed/ValTotCn"}),
    #"Columnas con nombre cambiado1" = Table.RenameColumns(#"Columnas quitadas1",{{"Orden", "OT"}, {"Denominación", "TipoHorometro"}}),
    #"Filas ordenadas" = Table.Sort(#"Columnas con nombre cambiado1",{{"OT", Order.Ascending}}),
    #"Filas filtradas" = Table.SelectRows(#"Filas ordenadas", each List.Contains({4538, 5177, 4581, 5354, 4534, 5081, 5221, 4602, 4862, 5381}, [Punto de medida])),
    #"Columnas con nombre cambiado2" = Table.RenameColumns(#"Filas filtradas",{{"Valor contador", "Horas_Diesel"}, {"FechaHorometroDiesel", "Fecha"}})
in
    #"Columnas con nombre cambiado2"
```

## DIM_TIPODETRABAJO

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla3_Table = Origen{[Item="Tabla3",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla3_Table,{{"Código", type text}, {"Ejecución", type text}}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Tipo cambiado",{{"Código", "IDTIPODETRABAJO"}, {"Ejecución", "Desc"}})
in
    #"Columnas con nombre cambiado"
```

## DIM_EQUIPOS

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla5_Table = Origen{[Item="Tabla5",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla5_Table,{{"Equipo", Int64.Type}, {"Denominacion del Objeto", type text}, {"Familia", type text}}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Tipo cambiado",{{"Equipo", "IDEQUIPO"}, {"Denominacion del Objeto", "Descripcion"}})
in
    #"Columnas con nombre cambiado"
```

## DIM_RESPONSABLE

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla18_Table = Origen{[Item="Tabla18",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla18_Table,{{"GPO.CODIGOS", type text}, {"DENOMINACION DE CODIGO", type text}, {"RESPONSABLE", type text}}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Tipo cambiado",{{"GPO.CODIGOS", "IDResponsable"}, {"DENOMINACION DE CODIGO", "Denominacion"}}),
    #"Filas filtradas" = Table.SelectRows(#"Columnas con nombre cambiado", each ([IDResponsable] <> null))
in
    #"Filas filtradas"
```

## DIM_TIPOMANTTO

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla9_Table = Origen{[Item="Tabla9",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla9_Table,{{"IDTIPO DE MANTTO", type text}, {"DESCRIPCION", type text}})
in
    #"Tipo cambiado"
```

## HECHOS_H-ELEC-P

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    #"MOTOR ELECTRICO_PERCUCION_Sheet" = Origen{[Item="MOTOR ELECTRICO_PERCUCION",Kind="Sheet"]}[Data],
    #"Encabezados promovidos" = Table.PromoteHeaders(#"MOTOR ELECTRICO_PERCUCION_Sheet", [PromoteAllScalars=true]),
    #"Tipo cambiado" = Table.TransformColumnTypes(#"Encabezados promovidos",{{"Fecha", Int64.Type}, {"Hora de", type time}, {"Documento med.", Int64.Type}, {"Punto de medida", Int64.Type}, {"ValMed/ValTotCn", type number}, {"Valor contador", type number}, {"Diferencia", type number}, {"Orden", Int64.Type}, {"Denominación", type text}, {"Creado por", type text}, {"Creado el", type date}, {"Hora", type time}, {"Equipo", Int64.Type}}),
    #"Columnas quitadas" = Table.RemoveColumns(#"Tipo cambiado",{"Hora de"}),
    #"Fecha insertada" = Table.AddColumn(#"Columnas quitadas", "Fecha.1", each Date.From(Text.From([Fecha], "es-NI")), type date),
    #"Columnas reordenadas" = Table.ReorderColumns(#"Fecha insertada",{"Fecha.1", "Fecha", "Documento med.", "Punto de medida", "ValMed/ValTotCn", "Valor contador", "Diferencia", "Orden", "Denominación", "Creado por", "Creado el", "Hora", "Equipo"}),
    #"Columnas quitadas1" = Table.RemoveColumns(#"Columnas reordenadas",{"Fecha"}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Columnas quitadas1",{{"Fecha.1", "FechaHorometro_ELEC_P"}, {"Orden", "OT"}, {"Denominación", "TipoHorometro"}}),
    #"Columnas quitadas2" = Table.RemoveColumns(#"Columnas con nombre cambiado",{"Hora", "Creado el"})
in
    #"Columnas quitadas2"
```

## Metricas

```m
let
    Origen = ""
in
    Origen
```

## DIMHOROMETROS

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla1_Table = Origen{[Item="Tabla1",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla1_Table,{{"IDEQUIPO", Int64.Type}, {"DESCHOROMETRO", type text}, {"TIPOHOROMETRO", type text}, {"PUNTODEMEDIDA", Int64.Type}}),
    #"Filas ordenadas" = Table.Sort(#"Tipo cambiado",{{"PUNTODEMEDIDA", Order.Ascending}, {"DESCHOROMETRO", Order.Ascending}})
in
    #"Filas ordenadas"
```

## HECHOS (iw39)

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    #"ot (iw39)_Sheet" = Origen{[Item="ot (iw39)",Kind="Sheet"]}[Data],
    #"Encabezados promovidos" = Table.PromoteHeaders(#"ot (iw39)_Sheet", [PromoteAllScalars=true]),
    #"Tipo cambiado" = Table.TransformColumnTypes(#"Encabezados promovidos",{{"Ubicac.técnica", type text}, {"Clase de orden", type text}, {"Orden", Int64.Type}, {"Fecha creación", type date}, {"Status sistema", type text}, {"Texto breve", type text}, {"Equipo", Int64.Type}, {"Denominación", type text}, {"Grupo planif.", type text}, {"Puesto trabajo", type text}, {"Fe.inic.extrema", type date}, {"Fe.fin extrema", type date}, {"Pto.tbjo.resp.", type text}, {"Plan mantenim.", Int64.Type}, {"Pos.mantenim.", Int64.Type}, {"TotGen. (plan)", type number}, {"TotalGen.(real)", type number}, {"Status usuario", type text}, {"Aviso", Int64.Type}, {"Fecha ref.", type date}})
in
    #"Tipo cambiado"
```

## HECHOS_H-ELEC

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    #"MOTOR ELECTRICO_PERCUCION_Sheet" = Origen{[Item="MOTOR ELECTRICO_PERCUCION",Kind="Sheet"]}[Data],
    #"Encabezados promovidos" = Table.PromoteHeaders(#"MOTOR ELECTRICO_PERCUCION_Sheet", [PromoteAllScalars=true]),
    #"Tipo cambiado" = Table.TransformColumnTypes(#"Encabezados promovidos",{{"Fecha", Int64.Type}, {"Hora de", type time}, {"Documento med.", Int64.Type}, {"Punto de medida", Int64.Type}, {"ValMed/ValTotCn", type number}, {"Valor contador", type number}, {"Diferencia", type number}, {"Orden", Int64.Type}, {"Denominación", type text}, {"Creado por", type text}, {"Creado el", type date}, {"Hora", type time}, {"Equipo", Int64.Type}}),
    #"Columnas quitadas" = Table.RemoveColumns(#"Tipo cambiado",{"Hora de"}),
    #"Fecha insertada" = Table.AddColumn(#"Columnas quitadas", "Fecha.1", each Date.From(Text.From([Fecha], "es-NI")), type date),
    #"Columnas reordenadas" = Table.ReorderColumns(#"Fecha insertada",{"Fecha.1", "Fecha", "Documento med.", "Punto de medida", "ValMed/ValTotCn", "Valor contador", "Diferencia", "Orden", "Denominación", "Creado por", "Creado el", "Hora", "Equipo"}),
    #"Columnas quitadas1" = Table.RemoveColumns(#"Columnas reordenadas",{"Fecha"}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Columnas quitadas1",{{"Fecha.1", "FechaHorometro_ELEC_P"}, {"Orden", "OT"}, {"Denominación", "TipoHorometro"}}),
    #"Columnas quitadas2" = Table.RemoveColumns(#"Columnas con nombre cambiado",{"Hora", "Creado el"}),
    #"Filas ordenadas" = Table.SelectRows(#"Columnas quitadas2", each List.Contains({4916, 5355, 4912, 4914, 5383}, [Punto de medida])),
    #"Columnas con nombre cambiado1" = Table.RenameColumns(#"Filas ordenadas",{{"Valor contador", "Horas_Electrico"}, {"FechaHorometro_ELEC_P", "Fecha"}})
in
    #"Columnas con nombre cambiado1"
```

## HECHOS_H-PERC

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    #"MOTOR ELECTRICO_PERCUCION_Sheet" = Origen{[Item="MOTOR ELECTRICO_PERCUCION",Kind="Sheet"]}[Data],
    #"Encabezados promovidos" = Table.PromoteHeaders(#"MOTOR ELECTRICO_PERCUCION_Sheet", [PromoteAllScalars=true]),
    #"Tipo cambiado" = Table.TransformColumnTypes(#"Encabezados promovidos",{{"Fecha", Int64.Type}, {"Hora de", type time}, {"Documento med.", Int64.Type}, {"Punto de medida", Int64.Type}, {"ValMed/ValTotCn", type number}, {"Valor contador", type number}, {"Diferencia", type number}, {"Orden", Int64.Type}, {"Denominación", type text}, {"Creado por", type text}, {"Creado el", type date}, {"Hora", type time}, {"Equipo", Int64.Type}}),
    #"Columnas quitadas" = Table.RemoveColumns(#"Tipo cambiado",{"Hora de"}),
    #"Fecha insertada" = Table.AddColumn(#"Columnas quitadas", "Fecha.1", each Date.From(Text.From([Fecha], "es-NI")), type date),
    #"Columnas reordenadas" = Table.ReorderColumns(#"Fecha insertada",{"Fecha.1", "Fecha", "Documento med.", "Punto de medida", "ValMed/ValTotCn", "Valor contador", "Diferencia", "Orden", "Denominación", "Creado por", "Creado el", "Hora", "Equipo"}),
    #"Columnas quitadas1" = Table.RemoveColumns(#"Columnas reordenadas",{"Fecha"}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Columnas quitadas1",{{"Fecha.1", "FechaHorometro_ELEC_P"}, {"Orden", "OT"}, {"Denominación", "TipoHorometro"}}),
    #"Columnas quitadas2" = Table.RemoveColumns(#"Columnas con nombre cambiado",{"Hora", "Creado el"}),
    #"Filas ordenadas" = Table.SelectRows(#"Columnas quitadas2", each List.Contains({4607, 5082, 5222}, [Punto de medida])),
    #"Columnas con nombre cambiado1" = Table.RenameColumns(#"Filas ordenadas",{{"Valor contador", "Horas_Percusion1"}, {"FechaHorometro_ELEC_P", "Fecha"}})
in
    #"Columnas con nombre cambiado1"
```

## HECHOS_H-PERC (2)

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    #"MOTOR ELECTRICO_PERCUCION_Sheet" = Origen{[Item="MOTOR ELECTRICO_PERCUCION",Kind="Sheet"]}[Data],
    #"Encabezados promovidos" = Table.PromoteHeaders(#"MOTOR ELECTRICO_PERCUCION_Sheet", [PromoteAllScalars=true]),
    #"Tipo cambiado" = Table.TransformColumnTypes(#"Encabezados promovidos",{{"Fecha", Int64.Type}, {"Hora de", type time}, {"Documento med.", Int64.Type}, {"Punto de medida", Int64.Type}, {"ValMed/ValTotCn", type number}, {"Valor contador", type number}, {"Diferencia", type number}, {"Orden", Int64.Type}, {"Denominación", type text}, {"Creado por", type text}, {"Creado el", type date}, {"Hora", type time}, {"Equipo", Int64.Type}}),
    #"Columnas quitadas" = Table.RemoveColumns(#"Tipo cambiado",{"Hora de"}),
    #"Fecha insertada" = Table.AddColumn(#"Columnas quitadas", "Fecha.1", each Date.From(Text.From([Fecha], "es-NI")), type date),
    #"Columnas reordenadas" = Table.ReorderColumns(#"Fecha insertada",{"Fecha.1", "Fecha", "Documento med.", "Punto de medida", "ValMed/ValTotCn", "Valor contador", "Diferencia", "Orden", "Denominación", "Creado por", "Creado el", "Hora", "Equipo"}),
    #"Columnas quitadas1" = Table.RemoveColumns(#"Columnas reordenadas",{"Fecha"}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Columnas quitadas1",{{"Fecha.1", "FechaHorometro_ELEC_P"}, {"Orden", "OT"}, {"Denominación", "TipoHorometro"}}),
    #"Columnas quitadas2" = Table.RemoveColumns(#"Columnas con nombre cambiado",{"Hora", "Creado el"}),
    #"Filas ordenadas" = Table.SelectRows(#"Columnas quitadas2", each List.Contains({4524, 5079, 5223}, [Punto de medida])),
    #"Columnas con nombre cambiado1" = Table.RenameColumns(#"Filas ordenadas",{{"Valor contador", "Horas_Percusion2"}, {"FechaHorometro_ELEC_P", "Fecha"}})
in
    #"Columnas con nombre cambiado1"
```

## HORO_CONSOL

```m
let
    Origen = Table.Combine({#"HECHOS_H-ELEC", #"HECHOS_H-PERC", #"HECHOS_H-PERC (2)", HECHOS_HMOTOR_D}),
    #"Columnas quitadas" = Table.RemoveColumns(Origen,{"Documento med.", "ValMed/ValTotCn", "Diferencia", "OT", "TipoHorometro", "Creado por"}),
    #"Columnas reordenadas" = Table.ReorderColumns(#"Columnas quitadas",{"Fecha", "Punto de medida", "Equipo", "Horas_Diesel", "Horas_Electrico", "Horas_Percusion1", "Horas_Percusion2"}),
    #"Filas agrupadas" = Table.Group(#"Columnas reordenadas", {"Fecha", "Equipo"}, {{"Max_Diesel", each List.Max([Horas_Diesel]), type nullable number}, {"Max_Electrico", each List.Max([Horas_Electrico]), type nullable number}, {"Max_Percusion1", each List.Max([Horas_Percusion1]), type nullable number}, {"Max_Percusion2", each List.Max([Horas_Percusion2]), type nullable number}, {"Punto de medida", each List.Max([Punto de medida]), type nullable number}}),
    #"Columnas reordenadas1" = Table.ReorderColumns(#"Filas agrupadas",{"Fecha", "Equipo", "Punto de medida", "Max_Diesel", "Max_Electrico", "Max_Percusion1", "Max_Percusion2"}),
    #"Consultas combinadas" = Table.NestedJoin(#"Columnas reordenadas1", {"Punto de medida"}, DIMHOROMETROS, {"PUNTODEMEDIDA"}, "DIMHOROMETROS", JoinKind.LeftOuter),
    #"Se expandió DIMHOROMETROS" = Table.ExpandTableColumn(#"Consultas combinadas", "DIMHOROMETROS", {"TIPOHOROMETRO"}, {"TIPOHOROMETRO"})
in
    #"Se expandió DIMHOROMETROS"
```

## ResultadosCostoXHora

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla8_Table = Origen{[Item="Tabla8",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla8_Table,{{"SAP", Int64.Type}, {"EQUIPO ", type text}, {"META (Costo/h)", type number}, {"Costo/h (Semana)", type number}, {"Horas", type number}, {"ACUMULADO MES (Costo/h)", type number}, {"COMENTARIOS", type text}})
in
    #"Tipo cambiado"
```

## ResUtilizacion

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla10_Table = Origen{[Item="Tabla10",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla10_Table,{{"SAP", Int64.Type}, {"EQUIPO ", type text}, {"% utilizacion ", Percentage.Type}, {"%utilizacion Mes", Percentage.Type}})
in
    #"Tipo cambiado"
```

## RelHorometros

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    RelHorometros_Table = Origen{[Item="RelHorometros",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(RelHorometros_Table,{{"SAP", Int64.Type}, {"Descripción ", type text}, {"Motor Eléctrico (Sem)", type number}, {"Motor Diesel (Sem)", type number}, {"% Relación (Sem)", type number}, {"Motor Eléctrico Mes", type number}, {"Motor Diesel (Mes)", type number}, {"% Relación (Mes)", type number}}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Tipo cambiado",{{"SAP", "IDEquipo"}})
in
    #"Columnas con nombre cambiado"
```

## HECHOSMOVMERC

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla4_Table = Origen{[Item="Tabla4",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla4_Table,{{"Orden", Int64.Type}, {"Material", Int64.Type}, {"Denominación", type text}, {"Ctd.en UME", Int64.Type}, {"UM entrada", type text}, {"Importe ML", type number}, {"Moneda", type text}, {"Cl.movimiento", Int64.Type}, {"Fecha contab.", type date}, {"Fecha de referencia", type any}, {"Denomicion", type text}, {"Costos uds", type number}, {"Semana", Int64.Type}, {"MES", type any}, {"Acumulado ", type any}, {"ACTIVIDAD", type any}}),
    #"Filas filtradas" = Table.SelectRows(#"Tipo cambiado", each ([Fecha de referencia] <> null)),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Filas filtradas",{{"Denominación", "DescMaterial"}, {"Ctd.en UME", "Ctd"}, {"UM entrada", "UdM"}, {"Importe ML", "Importe(NIO)"}}),
    #"Columnas quitadas" = Table.RemoveColumns(#"Columnas con nombre cambiado",{"Moneda", "Fecha contab."}),
    #"Tipo cambiado1" = Table.TransformColumnTypes(#"Columnas quitadas",{{"Fecha de referencia", type date}}),
    #"Columnas con nombre cambiado1" = Table.RenameColumns(#"Tipo cambiado1",{{"Denomicion", "DescEquipo"}, {"Costos uds", "Importe (USD)"}}),
    #"Tipo cambiado2" = Table.TransformColumnTypes(#"Columnas con nombre cambiado1",{{"MES", type text}})
in
    #"Tipo cambiado2"
```

## Metas2026

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    Tabla15_Table = Origen{[Item="Tabla15",Kind="Table"]}[Data],
    #"Tipo cambiado" = Table.TransformColumnTypes(Tabla15_Table,{{"Fecha", type date}, {"Familia", type text}, {"Disponibilidad", type number}, {"MTTR", type any}, {"MTBF", type any}, {"Confiabilidad", type any}}),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Tipo cambiado",{{"Fecha", "Mes"}, {"Disponibilidad", "Meta_Disponibilidad"}, {"MTTR", "Meta_MTTR"}, {"MTBF", "Meta_MTBF"}, {"Confiabilidad", "Meta_Confiabilidad"}})
in
    #"Columnas con nombre cambiado"
```

## Confiabilidad

```m
let
    Origen = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i45WMrRQyCgqVtIBMpRidaKVjEygfCMTMN/QCCZvpBQbCwA=", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [Confiabilidad = _t, Horas = _t]),
    #"Tipo cambiado" = Table.TransformColumnTypes(Origen,{{"Confiabilidad", type text}, {"Horas", Int64.Type}})
in
    #"Tipo cambiado"
```

## AnalisisCostos

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    AnalisisCostos_Sheet = Origen{[Item="AnalisisCostos",Kind="Sheet"]}[Data],
    #"Tabla transpuesta" = Table.Transpose(AnalisisCostos_Sheet),
    #"Columnas combinadas" = Table.CombineColumns(Table.TransformColumnTypes(#"Tabla transpuesta", {{"Column2", type text}}, "en-GB"),{"Column1", "Column2"},Combiner.CombineTextByDelimiter(",", QuoteStyle.None),"Combinada"),
    #"Tabla transpuesta1" = Table.Transpose(#"Columnas combinadas"),
    #"Encabezados promovidos" = Table.PromoteHeaders(#"Tabla transpuesta1", [PromoteAllScalars=true]),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Encabezados promovidos",{{",SAP", "SAP"}, {",Equipo", "Equipo"}, {"Mes,Semana ", "Indicador"}}),
    #"Otras columnas con anulación de dinamización" = Table.UnpivotOtherColumns(#"Columnas con nombre cambiado", {"SAP", "Equipo", "Indicador"}, "Atributo", "Valor"),
    #"Dividir columna por delimitador" = Table.SplitColumn(#"Otras columnas con anulación de dinamización", "Atributo", Splitter.SplitTextByDelimiter(",", QuoteStyle.Csv), {"Atributo.1", "Atributo.2"}),
    #"Tipo cambiado1" = Table.TransformColumnTypes(#"Dividir columna por delimitador",{{"Atributo.1", type text}, {"Atributo.2", Int64.Type}}),
    #"Columnas con nombre cambiado1" = Table.RenameColumns(#"Tipo cambiado1",{{"Atributo.1", "Mes"}, {"Atributo.2", "Semana"}}),
    #"Valor reemplazado" = Table.ReplaceValue(#"Columnas con nombre cambiado1","HORAS","Horas",Replacer.ReplaceText,{"Indicador"}),
    #"Valor reemplazado1" = Table.ReplaceValue(#"Valor reemplazado","Linea base","Meta",Replacer.ReplaceText,{"Indicador"}),
    #"Filas filtradas" = Table.SelectRows(#"Valor reemplazado1", each ([SAP] <> null)),
    #"Tipo cambiado" = Table.TransformColumnTypes(#"Filas filtradas",{{"Valor", type number}})
in
    #"Tipo cambiado"
```

## AnalisisCostosMes

```m
let
    Origen = Excel.Workbook(File.Contents("G:\My Drive\Dimelco\hemco\POWER BI DESDE OCTUBRE\LIBRO MAESTRO ABRIL 15-09-2026.xlsx"), null, true),
    AnalisisCostos_Sheet = Origen{[Item="AnalisisCostos",Kind="Sheet"]}[Data],
    #"Tabla transpuesta" = Table.Transpose(AnalisisCostos_Sheet),
    #"Columnas combinadas" = Table.CombineColumns(Table.TransformColumnTypes(#"Tabla transpuesta", {{"Column2", type text}}, "en-GB"),{"Column1", "Column2"},Combiner.CombineTextByDelimiter(",", QuoteStyle.None),"Combinada"),
    #"Tabla transpuesta1" = Table.Transpose(#"Columnas combinadas"),
    #"Encabezados promovidos" = Table.PromoteHeaders(#"Tabla transpuesta1", [PromoteAllScalars=true]),
    #"Columnas con nombre cambiado" = Table.RenameColumns(#"Encabezados promovidos",{{",SAP", "SAP"}, {",Equipo", "Equipo"}, {"Mes,Semana ", "Indicador"}}),
    #"Otras columnas con anulación de dinamización" = Table.UnpivotOtherColumns(#"Columnas con nombre cambiado", {"SAP", "Equipo", "Indicador"}, "Atributo", "Valor"),
    #"Dividir columna por delimitador" = Table.SplitColumn(#"Otras columnas con anulación de dinamización", "Atributo", Splitter.SplitTextByDelimiter(",", QuoteStyle.Csv), {"Atributo.1", "Atributo.2"}),
    #"Tipo cambiado1" = Table.TransformColumnTypes(#"Dividir columna por delimitador",{{"Atributo.1", type text}, {"Atributo.2", Int64.Type}}),
    #"Columnas con nombre cambiado1" = Table.RenameColumns(#"Tipo cambiado1",{{"Atributo.1", "Mes"}, {"Atributo.2", "Semana"}}),
    #"Valor reemplazado" = Table.ReplaceValue(#"Columnas con nombre cambiado1","HORAS","Horas",Replacer.ReplaceText,{"Indicador"}),
    #"Valor reemplazado1" = Table.ReplaceValue(#"Valor reemplazado","Linea base","Meta",Replacer.ReplaceText,{"Indicador"}),
    #"Filas filtradas" = Table.SelectRows(#"Valor reemplazado1", each ([SAP] <> null)),
    #"Tipo cambiado" = Table.TransformColumnTypes(#"Filas filtradas",{{"Valor", type number}})
in
    #"Tipo cambiado"
```

## Var_t: Disp

```m
let
    Origen = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i45WMrRQyCgqVtIBMpRidaKVjEygfCMTpdhYAA==", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [#"Var_t: Disp" = _t, Horas = _t]),
    #"Tipo cambiado" = Table.TransformColumnTypes(Origen,{{"Var_t: Disp", type text}, {"Horas", Int64.Type}})
in
    #"Tipo cambiado"
```

## Metricas (2)

```m
let
    Origen = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i44FAA==", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [Columna1 = _t]),
    #"Tipo cambiado" = Table.TransformColumnTypes(Origen,{{"Columna1", type text}})
in
    #"Tipo cambiado"
```
