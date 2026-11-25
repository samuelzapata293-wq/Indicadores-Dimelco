# Manual de carga del libro

Este manual es para el administrador. Explica cómo actualizar los datos de la aplicación cada semana o cada mes con el libro maestro de Excel. La aplicación no modifica el libro: lee cinco tablas y reemplaza en la base todos los datos anteriores. Para la rutina de cada mes, ver la sección siguiente.

## Qué lee la aplicación

La aplicación busca cada tabla por su nombre, en cualquier hoja del libro. El resto del libro (costos, horómetros, materiales y órdenes de trabajo) no se lee, así que sus hojas pueden cambiar.

| Tabla | Hoja | Contenido | Columnas que lee |
|---|---|---|---|
| Tabla2 | Data Mes | Paros | Equipo, Aviso, Inicio avería, Hora in-avería, Fin de avería, Hora fin avería, Duración parada, Descripción, Grupo de codigos, Codificación, Codif-txt-cód-, Status usuario, Tipo de Paro(PP/NPI), Resumen de actividad |
| Tabla5 | Parametros | Equipos | Equipo, Denominacion del Objeto, Familia |
| Tabla18 | Parametros | Responsables (grupos de códigos) | GPO.CODIGOS, DENOMINACION DE CODIGO, RESPONSABLE, DISPONIBILIDAD |
| Tabla9 | Parametros | Tipos de mantenimiento | IDTIPO DE MANTTO, DESCRIPCION |
| Tabla15 | METASMTTO | Metas mensuales | Fecha, Familia, Disponibilidad, MTTR, MTBF, Confiabilidad |

## Qué no debe cambiar

Los nombres de las cinco tablas. Deben seguir siendo tablas de Excel: si se convierten en rango, la aplicación no las encuentra.

Los nombres de las columnas, exactamente como aparecen en la tabla anterior, con sus acentos, espacios y guiones. Por ejemplo, "Codif-txt-cód-" y "Tipo de Paro(PP/NPI)". Si falta una columna, la carga no se puede hacer.

Las columnas MTTR, MTBF y Confiabilidad de Tabla15 deben existir, aunque estén vacías.

El detalle de cada campo está en `docs/contrato.md`, sección 1.

## Rutina mensual del administrador

1. En el libro maestro, hoja "Data Mes" (Tabla2), borrar a mano las filas del mes en curso y pegar las filas nuevas de ese mes.
2. Corregir a mano en el libro lo que haga falta (equipos, códigos, fechas, metas).
3. En la web, cargar el mismo libro completo (ver "Pasos en la pantalla Cargar datos").
4. Elegir el período en cualquier página y pulsar "Fijar este período para todos" (ver "Período que ven todos").

## Cada carga reemplaza todo

Cada carga reemplaza todos los datos actuales por los del libro. Por eso el libro conserva el historial: solo se reemplaza el mes en curso dentro del libro, y la carga sube el libro entero. Si se cargara solo el mes nuevo, los meses anteriores desaparecerían de la aplicación.

## Período que ven todos

El rango de fechas que el administrador deja fijado es el que ven todos al abrir la web, y la portada muestra "Data actualizada" con ese rango.

1. Iniciar sesión como administrador.
2. Elegir el período en el segmentador de fechas de cualquier página (Disp Simba, Jumbo, Sostenimiento, ST3.5, ST1030 o Resumen).
3. Pulsar "Fijar este período para todos", debajo del segmentador. Aparece "Período guardado".

Disp Mensual tiene su propio período, independiente. Para fijarlo, elegir las fechas en esa página y pulsar el mismo botón allí. Los invitados no ven el botón.

Mientras no se fije un período, la web usa el calculado de los datos: del primer día del mes de la última fecha de inicio de los paros hasta esa fecha. Una carga nueva no cambia el período fijado: después de cargar hay que fijarlo de nuevo.

## Filas que se descartan

Al leer Tabla2, la aplicación descarta estas filas:

Filas sin aviso. Incluye las filas vacías al final de la tabla, por eso el conteo casi siempre es mayor que cero. Un aviso escrito con texto que no es número sí aparece en la lista de avisos.

Filas sin fecha de fin. Sin fecha de fin no se puede medir la duración de la avería.

Filas de equipos que no están en Tabla5. La base rechaza los paros de equipos que no están en su lista de equipos, y la página no tendría dónde mostrarlos.

Filas sin fecha de inicio válida. Se cuentan aparte en la pantalla de revisión.

Las filas sin hora de inicio o de fin no se descartan: la aplicación usa 00:00:00 y lo indica como aviso. Los avisos no impiden la carga.

## Agregar un equipo nuevo

1. En Tabla5, agregar una fila con el número del equipo (Equipo), su denominación (Denominacion del Objeto) y su familia (Familia).
2. En Tabla15, agregar la meta mensual del equipo, como se explica en la sección siguiente. En la columna Familia de Tabla15 va la denominación del equipo, no la familia. Debe ser igual a la denominación de Tabla5, sin distinguir mayúsculas ni espacios al inicio o al final. Si no coincide, la meta no se aplica.
3. Cargar el libro. Los paros del equipo se cargan si el libro los trae y el equipo está en Tabla5.
4. Para que el equipo aparezca en una página, su número debe agregarse en la lista de la página correspondiente de `src/medidas/contexto.ts` (`EQUIPOS_POR_PAGINA`). Este cambio es de código: lo hace quien mantiene el proyecto y se publica con el flujo de la web. Resumen Disp. y Disp Mensual también toman sus equipos de esas listas.

## Agregar las metas de un mes nuevo

En Tabla15 va una fila por equipo y por mes:

Fecha: el día 1 del mes, por ejemplo 01/12/2026. El cálculo compara con el primer día de cada mes. Una fecha de otro día no se toma como meta de ese mes.

Familia: la denominación del equipo, como se indica arriba.

Disponibilidad: una fracción de 0 a 1. Con formato de porcentaje, 85 % se guarda como 0,85. Si se escribe 85 sin formato de porcentaje, queda como 85 y no se compara bien con la disponibilidad.

Las filas sin disponibilidad se ignoran. Las columnas MTTR, MTBF y Confiabilidad deben existir, pero hoy no alimentan las medidas.

## Pasos en la pantalla Cargar datos

Para cargar hace falta iniciar sesión como administrador. La opción Cargar datos aparece en el pie de página solo con esa sesión.

Paso 1, elegir el libro. Elegir el archivo con el botón Elegir archivo o arrastrar el .xlsx a la pantalla. Otro tipo de archivo se rechaza.

Paso 2, revisar. La pantalla muestra el contenido del libro (filas leídas por tabla), el rango de fechas de los paros y las filas descartadas con su causa, y la comparación con los datos actuales: filas actuales y nuevas por tabla, filas nuevas y quitadas, y los rangos de fechas actual y nuevo. También muestra los avisos. Si el libro tiene errores de estructura, la pantalla no permite cargarlo.

Si aparecen muchas filas quitadas, o si el rango nuevo termina antes que el actual, conviene revisar que el libro tenga el historial completo antes de confirmar.

Paso 3, cargar a la base. Elegir Cargar a la base y confirmar con Sí, cargar. La pantalla pide confirmación con el número de paros que se van a reemplazar.

Al terminar, la pantalla muestra "Carga terminada" con el id de la carga. Debajo aparece el recordatorio de elegir el período y fijarlo para todos. Ver tablero lleva a la portada.

## Si algo falla

La carga tiene dos etapas, y cada una puede fallar por separado.

En la subida, el libro se guarda primero en el almacenamiento privado. Si falla, la pantalla dice "No se pudo subir el archivo; no se cargó nada".

En la carga a la base, todos los cambios se hacen en una sola transacción. Si falla, la pantalla dice "La base rechazó la carga; no se cambió nada", y la base queda como estaba. El mensaje de error suele traer un detalle debajo, que indica la causa.

Si la subida funciona y la carga falla, el libro queda guardado en el almacenamiento pero sin registro en el historial. Se puede volver a intentar. Cada intento guarda una copia con su propia hora.

## Historial

En Cargar datos, la sección "Últimas cargas" muestra las últimas diez cargas, con la fecha y hora, el archivo, las filas de paros y el rango de fechas.

En la base, la tabla de cargas guarda además el número de filas de cada tabla.

El libro de cada carga queda en el bucket privado `excel` de Supabase Storage, con la ruta `aaaa/mm/dd-hhmmss_nombre.xlsx` (hora local). Solo el administrador puede verlo o subirlo.
