# Puesta en marcha

Esta guía deja la aplicación funcionando por primera vez: la base de datos en Supabase, el sitio en GitHub Pages y la primera carga del libro. Se hace una sola vez. Para las actualizaciones semanales o mensuales, ver `docs/manual_carga.md`.

Hace falta acceso al panel de Supabase, permisos de administración en el repositorio de GitHub (<nombre del repo en GitHub>), el libro maestro de Excel (.xlsx) y el correo del administrador (<correo del administrador>).

## Base de datos

1. Crear un proyecto nuevo en Supabase.
2. Abrir el SQL Editor, pegar todo el contenido de `supabase/instalar_todo.sql` y ejecutarlo. Se puede repetir sin dañar la base. Ese archivo lo arma `tools/base_armar_instalacion.sh` a partir de `supabase/migrations/`; si se cambia una migración, hay que volver a armarlo.
3. Crear el usuario administrador en Authentication > Users, con correo y contraseña.
4. En el SQL Editor, ejecutar la línea de alta. Está al final de `instalar_todo.sql`, comentada. Copiarla, quitar los dos guiones del inicio y reemplazar `<correo del administrador>` por el correo, entre comillas simples:

       insert into administradores(user_id) select id from auth.users where email = '<correo del administrador>';

   Si el correo no coincide con ninguna cuenta, la sentencia no da error y no inserta nada. Para comprobarlo, ejecutar `select * from administradores;`. Debe aparecer una fila.

5. En Settings > API (en algunas versiones del panel, Project Settings > API Keys), copiar el Project URL (<URL del proyecto Supabase>) y la llave anon. No copiar la llave service_role.

## Sitio web en GitHub Pages

6. En el repositorio, ir a Settings > Secrets and variables > Actions, abrir la pestaña Variables y crear con New repository variable:
   - `SUPABASE_URL`, con el Project URL (<URL del proyecto Supabase>).
   - `SUPABASE_ANON_KEY`, con la llave anon.

   Son variables y no secretos, porque el flujo las lee como variables. La llave anon es pública por diseño: el navegador la envía en cada consulta. Sin sesión, las políticas de la base solo permiten leer. Escribir exige una sesión de administrador, y la base lo comprueba.

7. Ir a Settings > Pages > Build and deployment, y en Source elegir GitHub Actions.
8. Hacer push a `main`. El flujo "Web de indicadores (GitHub Pages)" corre las pruebas, compila el sitio y lo publica. Si el cambio solo toca `docs/`, `supabase/`, `tools/` o archivos `.md`, el flujo no se dispara; en ese caso, en la pestaña Actions, elegir el flujo y usar Run workflow. Esperar a que termine en verde.

## Primera carga

9. Abrir la web (<URL de la web>). En el pie de página, elegir Ingresar y entrar con el correo y la contraseña del administrador.
10. En el pie de página, elegir Cargar datos. Elegir el libro maestro (.xlsx) o arrastrarlo a la pantalla.
11. Revisar la pantalla "Paso 2. Revisar". Si no hay errores, elegir Cargar a la base y confirmar con Sí, cargar.
12. Al terminar, la pantalla muestra "Carga terminada" con el id de la carga. Elegir Ver tablero.

## Verificación

La Portada muestra "Data actualizada:" seguido del rango de fechas de inicio de los paros. Si la base está vacía, dice "Data actualizada: sin datos cargados".

Las páginas de familia muestran los gráficos de disponibilidad con sus porcentajes y la tabla de paros. Resumen Disp. muestra las tablas por equipo y por familia, y Disp Mensual muestra un panel por equipo. Algunos valores se pueden comparar con las capturas del reporte original en `docs/powerbi/capturas`.

Con el libro del 15-09-2026, la carga debe traer 11 622 paros válidos (`docs/contrato.md`, sección 6). En Cargar datos, la tabla "Últimas cargas" muestra esa cifra en la columna "Filas de paros".

Sin sesión, el pie de página no muestra Cargar datos.

## Problemas frecuentes

### La página muestra "Falta configurar la conexión a Supabase"

Ocurre cuando el sitio se compiló sin `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`. El flujo toma esos valores de las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY`, así que hay que revisar que existan con esos nombres exactos. Como los valores se leen al compilar, después de corregirlos hay que volver a ejecutar el flujo.

### Ingresar muestra "Correo o contraseña incorrectos"

La cuenta no existe con ese correo o la contraseña no coincide. Revisar en Authentication > Users que el usuario esté creado con el correo exacto.

### Al cargar aparece un error de permisos

Si el usuario no está en la tabla de administradores, el pie de página no muestra Cargar datos, y la dirección `/cargar` lleva a Ingresar. Si aun así se llega a intentar la carga, la base la rechaza con el mensaje "Solo el administrador puede cargar datos", o la subida al almacenamiento falla y la pantalla dice "No se pudo subir el archivo; no se cargó nada".

Para corregirlo, ejecutar la línea de alta con el correo exacto de la cuenta y comprobar con `select * from administradores;`. Si la sesión se abrió antes de la alta, recargar la página, porque el rol se consulta al abrir la sesión.

### La pantalla dice que el libro tiene errores de tabla o columna

Los mensajes son del tipo "No se encontró la tabla Tabla2 en el libro." o "La tabla Tabla5 (hoja ...) no tiene las columnas: ...". Significan que el libro cambió de estructura: una tabla se convirtió en rango, se renombró, o se cambió el nombre de una columna. Hay que restablecer el nombre según la lista de `docs/manual_carga.md`. Mientras el libro tenga errores, la pantalla no permite cargarlo.

### El flujo termina en verde, pero la web no cambia

Si GitHub Pages no tiene Source en GitHub Actions, el paso "Verificar GitHub Pages" escribe un aviso y el flujo termina sin publicar y sin marcar error. Revisar el aviso en el resumen de la ejecución, activar Pages como indica el paso 7 y ejecutar el flujo otra vez.

### El flujo falla en el paso Probar

Alguna prueba de `npm test` no pasó, y en ese caso el flujo no publica. El registro del paso indica cuál. No tiene relación con la conexión a Supabase.
