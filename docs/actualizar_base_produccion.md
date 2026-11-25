# Actualizar la base de producción (parche del 25/11/2026)

Este parche corrige la carga de datos (ahora vacía las tablas con TRUNCATE) y agrega la configuración del período que ven todos. Se hace una sola vez.

1. Entrar al proyecto en Supabase y abrir el SQL Editor.
2. Pegar todo el contenido de `supabase/parche_2026-11-25.sql`.
3. Pulsar Run.
4. Resultado esperado: "Success. No rows returned".

Si sale un error, no repetir a ciegas: copiar el mensaje completo. El parche se puede ejecutar de nuevo sin dañar la base.

Después de aplicarlo, cargar el libro en la web y fijar el período (ver `docs/manual_carga.md`).
