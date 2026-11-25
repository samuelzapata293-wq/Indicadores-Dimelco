# Indicadores Dimelco

Aplicación web que reemplaza el reporte de Power BI "Análisis de indicadores". Muestra la disponibilidad, el MTTR, el MTBF y la confiabilidad de la flota de minería mecanizada. El reporte original tiene ocho páginas: la portada, cinco páginas por familia de equipo (Tiro Largo, Perforación Mecanizada, Equipos de Sostenimiento, y las cargadoras ST3.5 y ST1030), el resumen y la evolución mensual.

Cualquier persona puede consultar las páginas sin iniciar sesión. Solo el administrador inicia sesión y carga el libro maestro de Excel desde la pantalla Cargar datos.

## Arquitectura

La interfaz está hecha con React y Vite, y se publica como sitio estático en GitHub Pages. Los datos (equipos, responsables, tipos de mantenimiento, metas y paros) se guardan en tablas de Supabase, que es PostgreSQL. Cualquiera puede leerlas. La escritura solo la hace la función `cargar_datos`, que verifica que el usuario sea administrador.

Las medidas no se calculan en la base. El motor de `src/medidas` traduce el DAX del reporte original a TypeScript y corre en el navegador. Las pruebas comparan sus resultados con los valores capturados del reporte de Power BI (`docs/powerbi/capturas`).

## Estructura

```
src/datos/        lectura de Supabase, lector del libro de Excel, carga y comparación
src/medidas/      motor de medidas (traducción del DAX), contexto de filtros y listas de equipos por página
src/components/   piezas compartidas: encabezado, pie, segmentadores, tablas y gráficos
src/pages/        una pantalla por ruta: portada, familias, Resumen, Mensual, Ingresar y Cargar datos
src/lib/          cliente de Supabase
supabase/         instalar_todo.sql (instalación completa) y migrations/ (001 a 006) y parche_2026-11-25.sql (solo 005 y 006, para producción)
tools/            pruebas de la base y de la carga real, y utilidades para armar el instalador SQL y la muestra local
tests/            pruebas de Vitest del motor y del lector de Excel, con datos de muestra en fixtures/
docs/             contrato de datos y medidas, manual de carga, y material del reporte de Power BI
```

## Comandos

```
npm install                            dependencias
npm run dev                            servidor de desarrollo (necesita VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)
VITE_DATOS_LOCAL=muestra npm run dev   desarrollo con datos de muestra, sin Supabase
npm test                               pruebas (Vitest)
npm run build:web                      compila el sitio en dist-web/
bash tools/prueba_base.sh              migraciones y permisos en un PostgreSQL temporal, más una prueba de volumen
bash tools/prueba_carga_real.sh        carga el libro de datos_local/ en un PostgreSQL temporal y compara conteos
```

Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se leen al compilar. Para desarrollar con Supabase pueden ir en un archivo `.env.local`, que Git no sube. Sin ellas, la app muestra el aviso "Falta configurar la conexión a Supabase". Con `VITE_DATOS_LOCAL=muestra`, la app lee `tests/fixtures/datos/muestra.json` y no necesita Supabase. En PowerShell, la línea equivalente es `$env:VITE_DATOS_LOCAL="muestra"; npm run dev`. El flujo de la web usa Node.js 22 y corre `npm test` antes de compilar.

Las dos pruebas de `tools/` requieren PostgreSQL (`initdb`, `pg_ctl` y `psql`); `prueba_base.sh` además necesita Python 3, y `prueba_carga_real.sh` usa `npx vite-node`, así que hay que haber corrido `npm install`. Si los binarios de PostgreSQL no están en `/usr/lib/postgresql`, se indica su carpeta con la variable `PGBIN`. La prueba de carga real usa `datos_local/LIBRO_MAESTRO_15-09-2026.xlsx`. El libro no va al repositorio, porque `.gitignore` excluye los archivos `.xlsx`; si no existe, el script avisa y termina sin error.

## Documentación

Cada documento tiene un público distinto:

`INSTALACION.md` describe la puesta en marcha: Supabase, GitHub Pages y la primera carga.

`docs/manual_carga.md` explica cómo actualizar el libro cada semana o cada mes. Es para el administrador.

`docs/contrato.md` detalla qué tablas y columnas lee la app, cómo se calcula cada medida y qué decisiones se tomaron al validar el motor.
