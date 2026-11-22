-- Prueba de esquema, seguridad y carga (base local con base_local.sql y las migraciones aplicadas).
-- Termina con error ante la primera falla; cada comprobación aprobada imprime una línea.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\o /dev/null

create schema pruebas;
grant usage on schema pruebas to anon, authenticated;
create or replace function pruebas.espera_error(p_sql text, p_fragmento text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_fragmento) in lower(sqlerrm)) = 0 then
      raise exception 'Falló con otro mensaje. Esperado «%», recibido «%»', p_fragmento, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Debió fallar: %', p_sql;
end $$;
create or replace function pruebas.igual(p_obtenido anyelement, p_esperado anyelement, p_que text) returns void
language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception '%: esperado %, obtenido %', p_que, p_esperado, p_obtenido;
  end if;
end $$;
grant execute on all functions in schema pruebas to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@x.com'),
  ('00000000-0000-0000-0000-00000000000b', 'otro@x.com');
insert into administradores (user_id) values ('00000000-0000-0000-0000-00000000000a');

-- Datos chicos para las pruebas.
\set carga1 '{"equipos":[{"id_equipo":1,"descripcion":"  SIMBA 1 ","familia":"TIRO LARGO"},{"id_equipo":2,"descripcion":"JUMBO 1","familia":"PERFORACION MECANIZADA"}],"responsables":[{"id_responsable":"T-MTO-ME","denominacion":"Mecánico","responsable":"Mantenimiento","disponibilidad":"Mecánica"}],"tipos_mantto":[{"id_tipo_mantto":"NPI","descripcion":"No planificado"},{"id_tipo_mantto":"PP","descripcion":"Planificado"}],"metas":[{"mes":"01/11/2026","equipo_descripcion":"SIMBA 1","meta_disp":0.85},{"mes":"2026-10-01","equipo_descripcion":"JUMBO 1","meta_disp":0.8,"meta_mttr":2}],"paros":[{"aviso":900,"id_equipo":1,"fecha_inicio":"2026-11-01","hora_inicio":"08:00:00","fecha_fin":"2026-11-01","hora_fin":"10:30:00","duracion_min":150,"id_responsable":"T-MTO-ME","id_tipo_mantto":"NPI","resumen":"01 fuga"},{"aviso":900,"id_equipo":1,"fecha_inicio":"2026-11-03","hora_inicio":"00:00:00","fecha_fin":"2026-11-04","hora_fin":"01:00:00","duracion_min":1500,"id_responsable":"T-MTO-ME","id_tipo_mantto":"PP"},{"aviso":901,"id_equipo":2,"fecha_inicio":"2026-10-15","hora_inicio":"06:00","fecha_fin":"2026-10-15","hora_fin":"07:00","duracion_min":60}]}'
\set carga2 '{"equipos":[{"id_equipo":5,"descripcion":"SCOOP 5","familia":"CARGADORAS BP"}],"responsables":[],"tipos_mantto":[],"metas":[],"paros":[{"aviso":1,"id_equipo":5,"fecha_inicio":"2026-11-10","hora_inicio":"01:00:00","fecha_fin":"2026-11-10","hora_fin":"02:00:00","duracion_min":60}]}'
\set carga_mala '{"equipos":[{"id_equipo":7,"descripcion":"X","familia":"Y"}],"responsables":[],"tipos_mantto":[],"metas":[],"paros":[{"aviso":1,"id_equipo":7,"fecha_inicio":"2026-11-10","fecha_fin":"2026-11-10"},{"aviso":2,"id_equipo":999,"fecha_inicio":"2026-11-10","fecha_fin":"2026-11-10"}]}'
\set carga_sin_paros '{"equipos":[{"id_equipo":7,"descripcion":"X"}],"responsables":[],"tipos_mantto":[],"metas":[],"paros":[]}'
\set carga_sin_equipos '{"equipos":[],"responsables":[],"tipos_mantto":[],"metas":[],"paros":[{"aviso":1,"id_equipo":7,"fecha_inicio":"2026-11-10","fecha_fin":"2026-11-10"}]}'

-- 1. Sin cargas previas, anon lee las tablas (vacías) y es_admin() es falso.
set role anon;
select pruebas.igual((select count(*)::int from paros), 0, 'anon lee paros');
select pruebas.igual(es_admin(), false, 'es_admin() de anon');
\echo 'APROBADA: anon puede leer paros'
select pruebas.espera_error($q$insert into paros (aviso, id_equipo, fecha_inicio, fecha_fin) values (1, 1, now(), now())$q$, 'permission denied');
select pruebas.espera_error($q$update paros set aviso = 1$q$, 'permission denied');
select pruebas.espera_error($q$delete from equipos$q$, 'permission denied');
\echo 'APROBADA: anon no puede insertar, actualizar ni borrar'
select pruebas.espera_error($q$select cargar_datos('{}'::jsonb)$q$, 'permission denied');
\echo 'APROBADA: anon no puede llamar cargar_datos'
select pruebas.espera_error($q$select count(*) from administradores$q$, 'permission denied');
\echo 'APROBADA: anon no lee administradores'
reset role;

-- 2. Usuario autenticado que no es admin.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select pruebas.igual(es_admin(), false, 'es_admin() de no admin');
select pruebas.espera_error(format('select cargar_datos(%L::jsonb)', :'carga1'), 'Solo el administrador');
select pruebas.espera_error($q$insert into equipos values (9, 'x', 'y')$q$, 'permission denied');
select pruebas.espera_error($q$select count(*) from administradores$q$, 'permission denied');
\echo 'APROBADA: authenticated no admin no puede cargar, escribir ni leer administradores'
select pruebas.igual((select count(*)::int from cargas), 0, 'authenticated lee cargas');
reset role;

-- 3. Admin: primera carga y conteos.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select pruebas.igual(es_admin(), true, 'es_admin() del admin');
select cargar_datos(:'carga1'::jsonb, 'libro1.xlsx', 'excel/libro1.xlsx') as id1 \gset
select pruebas.igual(:id1::bigint, 1::bigint, 'id de la primera carga');
select pruebas.igual((select count(*)::int from equipos), 2, 'equipos');
select pruebas.igual((select count(*)::int from responsables), 1, 'responsables');
select pruebas.igual((select count(*)::int from tipos_mantto), 2, 'tipos_mantto');
select pruebas.igual((select count(*)::int from metas), 2, 'metas');
select pruebas.igual((select count(*)::int from paros), 3, 'paros');
select pruebas.igual((select count(*)::int from paros where aviso = 900), 2, 'aviso repetido permitido');
select pruebas.igual((select descripcion from equipos where id_equipo = 1), 'SIMBA 1', 'descripción recortada');
select pruebas.igual((select min(mes) from metas), date '2026-10-01', 'mes ISO');
select pruebas.igual((select max(mes) from metas), date '2026-11-01', 'mes dd/mm/aaaa');
select pruebas.igual((select filas from cargas where id = 1), '{"equipos":2,"responsables":1,"tipos_mantto":2,"metas":2,"paros":3}'::jsonb, 'filas');
select pruebas.igual((select fecha_min from cargas where id = 1), date '2026-10-15', 'fecha_min');
select pruebas.igual((select fecha_max from cargas where id = 1), date '2026-11-03', 'fecha_max');
select pruebas.igual((select usuario from cargas where id = 1), '00000000-0000-0000-0000-00000000000a'::uuid, 'usuario');
select pruebas.igual((select archivo || '|' || ruta_storage from cargas where id = 1), 'libro1.xlsx|excel/libro1.xlsx', 'archivo y ruta');
\echo 'APROBADA: el admin carga y los conteos cuadran'

-- 4. Segunda carga reemplaza todo.
select cargar_datos(:'carga2'::jsonb, 'libro2.xlsx', null) as id2 \gset
select pruebas.igual(:id2::bigint, 2::bigint, 'id de la segunda carga');
select pruebas.igual((select count(*)::int from equipos), 1, 'equipos tras reemplazo');
select pruebas.igual((select count(*)::int from responsables), 0, 'responsables tras reemplazo');
select pruebas.igual((select count(*)::int from tipos_mantto), 0, 'tipos tras reemplazo');
select pruebas.igual((select count(*)::int from metas), 0, 'metas tras reemplazo');
select pruebas.igual((select count(*)::int from paros), 1, 'paros tras reemplazo');
select pruebas.igual((select count(*)::int from cargas), 2, 'historial de cargas se conserva');
\echo 'APROBADA: la segunda carga reemplaza todo sin duplicar'

-- 5. Cargas inválidas: fallan y no dejan cambios.
select pruebas.espera_error(format('select cargar_datos(%L::jsonb)', :'carga_mala'), 'no están en equipos');
select pruebas.igual((select count(*)::int from equipos), 1, 'equipos intactos tras error');
select pruebas.igual((select id_equipo from equipos), 5::bigint, 'equipo original intacto');
select pruebas.igual((select count(*)::int from paros), 1, 'paros intactos tras error');
select pruebas.igual((select count(*)::int from cargas), 2, 'cargas intactas tras error');
\echo 'APROBADA: carga con paro de equipo inexistente falla y no deja cambios'
select pruebas.espera_error(format('select cargar_datos(%L::jsonb)', :'carga_sin_paros'), 'al menos un paro');
select pruebas.espera_error(format('select cargar_datos(%L::jsonb)', :'carga_sin_equipos'), 'al menos un equipo');
select pruebas.espera_error($q$select cargar_datos('{"equipos":[]}'::jsonb)$q$, 'debe ser un arreglo');
select pruebas.igual((select count(*)::int from paros), 1, 'paros intactos tras validaciones');
\echo 'APROBADA: exige al menos 1 equipo y 1 paro y arreglos completos'
reset role;

-- 6. Storage (solo si la base trae el esquema, local o Supabase).
select pruebas.igual((select public from storage.buckets where id = 'excel'), false, 'bucket excel privado');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select pruebas.espera_error($q$insert into storage.objects (bucket_id, name) values ('excel', 'a.xlsx')$q$, 'row-level security');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
insert into storage.objects (bucket_id, name) values ('excel', 'a.xlsx');
select pruebas.igual((select count(*)::int from storage.objects where bucket_id = 'excel'), 1, 'admin lee excel');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select pruebas.igual((select count(*)::int from storage.objects where bucket_id = 'excel'), 0, 'no admin no ve excel');
reset role;
set role anon;
select pruebas.espera_error($q$select count(*) from storage.objects$q$, 'permission denied');
reset role;
\echo 'APROBADA: bucket excel privado, solo el admin sube y lee'

-- Limpieza para la prueba de volumen.
delete from storage.objects;
\echo 'TODAS LAS COMPROBACIONES APROBADAS'
