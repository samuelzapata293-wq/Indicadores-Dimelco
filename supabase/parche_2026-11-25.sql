-- Parche de producción 2026-11-25: aplica 005 (cargar_datos con TRUNCATE) y 006 (configuración del período).
-- Pegar todo en el SQL Editor del proyecto Supabase y ejecutar una sola vez. Resultado esperado: Success. No rows returned.

-- ===== 005_carga_truncate.sql =====
-- Corrige cargar_datos: vacía las tablas con TRUNCATE en lugar de DELETE sin WHERE
-- (Supabase rechaza esos DELETE: "DELETE requires a WHERE clause"). Mismo comportamiento y validaciones que 003.
-- Se aplica encima de 003; no la modifica.

create or replace function cargar_datos(datos jsonb, archivo text default null, ruta_storage text default null)
returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  n_equipos int; n_resp int; n_tipos int; n_metas int; n_paros int;
  f_min date; f_max date; v_id bigint; v_malos text; k text;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede cargar datos' using errcode = '42501';
  end if;
  if datos is null or jsonb_typeof(datos) <> 'object' then
    raise exception 'datos debe ser un objeto JSON';
  end if;
  foreach k in array array['equipos','responsables','tipos_mantto','metas','paros'] loop
    if jsonb_typeof(datos -> k) is distinct from 'array' then
      raise exception 'datos.% debe ser un arreglo', k;
    end if;
  end loop;
  if jsonb_array_length(datos -> 'equipos') < 1 then
    raise exception 'La carga debe traer al menos un equipo';
  end if;
  if jsonb_array_length(datos -> 'paros') < 1 then
    raise exception 'La carga debe traer al menos un paro';
  end if;

  -- Un solo TRUNCATE de las cinco tablas (también resuelve la clave foránea de paros a equipos).
  -- Es transaccional en PostgreSQL: si la carga falla más abajo, se revierte y las tablas quedan como estaban.
  -- No se usa DELETE porque Supabase rechaza los DELETE sin WHERE en las conexiones de su API.
  -- La tabla cargas (historial) no se toca.
  truncate table paros, metas, tipos_mantto, responsables, equipos;

  insert into equipos (id_equipo, descripcion, familia)
  select id_equipo, btrim(descripcion), familia
  from jsonb_to_recordset(datos -> 'equipos') as x(id_equipo bigint, descripcion text, familia text);
  get diagnostics n_equipos = row_count;

  insert into responsables (id_responsable, denominacion, responsable, disponibilidad)
  select id_responsable, denominacion, responsable, disponibilidad
  from jsonb_to_recordset(datos -> 'responsables')
       as x(id_responsable text, denominacion text, responsable text, disponibilidad text);
  get diagnostics n_resp = row_count;

  insert into tipos_mantto (id_tipo_mantto, descripcion)
  select id_tipo_mantto, descripcion
  from jsonb_to_recordset(datos -> 'tipos_mantto') as x(id_tipo_mantto text, descripcion text);
  get diagnostics n_tipos = row_count;

  -- mes llega como ISO (aaaa-mm-dd) o como "dd/mm/aaaa" (formato del Excel).
  insert into metas (mes, equipo_descripcion, meta_disp, meta_mttr, meta_mtbf, meta_conf)
  select case when mes ~ '^\d{1,2}/\d{1,2}/\d{4}$' then to_date(mes, 'DD/MM/YYYY') else mes::date end,
         btrim(equipo_descripcion), meta_disp, meta_mttr, meta_mtbf, meta_conf
  from jsonb_to_recordset(datos -> 'metas')
       as x(mes text, equipo_descripcion text, meta_disp numeric, meta_mttr numeric, meta_mtbf numeric, meta_conf numeric);
  get diagnostics n_metas = row_count;

  select string_agg(distinct x.id_equipo::text, ', ') into v_malos
  from jsonb_to_recordset(datos -> 'paros') as x(id_equipo bigint)
  where not exists (select 1 from equipos e where e.id_equipo = x.id_equipo);
  if v_malos is not null then
    raise exception 'Hay paros con equipos que no están en equipos: %', v_malos;
  end if;

  insert into paros (aviso, id_equipo, fecha_inicio, hora_inicio, fecha_fin, hora_fin, duracion_min,
                     desc_paro, id_responsable, cod_falla, texto_falla, id_tipo_mantto, tipo_paro_pp_npi, resumen)
  select aviso, id_equipo, fecha_inicio, hora_inicio, fecha_fin, hora_fin, duracion_min,
         desc_paro, id_responsable, cod_falla, texto_falla, id_tipo_mantto, tipo_paro_pp_npi, resumen
  from jsonb_to_recordset(datos -> 'paros')
       as x(aviso bigint, id_equipo bigint, fecha_inicio date, hora_inicio text, fecha_fin date, hora_fin text,
            duracion_min numeric, desc_paro text, id_responsable text, cod_falla text, texto_falla text,
            id_tipo_mantto text, tipo_paro_pp_npi text, resumen text);
  get diagnostics n_paros = row_count;

  select min(fecha_inicio), max(fecha_inicio) into f_min, f_max from paros;

  insert into cargas (usuario, archivo, ruta_storage, filas, fecha_min, fecha_max)
  values (auth.uid(), archivo, ruta_storage,
          jsonb_build_object('equipos', n_equipos, 'responsables', n_resp, 'tipos_mantto', n_tipos,
                             'metas', n_metas, 'paros', n_paros),
          f_min, f_max)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function cargar_datos(jsonb, text, text) from public, anon;
grant execute on function cargar_datos(jsonb, text, text) to authenticated;

-- ===== 006_configuracion.sql =====
-- Configuración compartida: el período que deja seleccionado el administrador es el que ven todos al abrir la web.
-- Una sola fila (id = 1). Lectura pública; la escritura solo pasa por guardar_periodo(), que exige es_admin().

create table if not exists configuracion (
  id              smallint primary key default 1 check (id = 1),
  periodo_ini     date,            -- período de las páginas de familia, Resumen y Portada
  periodo_fin     date,
  mensual_ini     date,            -- período propio de Disp Mensual
  mensual_fin     date,
  actualizado     timestamptz,
  actualizado_por uuid
);

alter table configuracion enable row level security;
revoke all on configuracion from public, anon, authenticated;
grant select on configuracion to anon, authenticated;
drop policy if exists leer_configuracion on configuracion;
create policy leer_configuracion on configuracion for select to anon, authenticated using (true);

-- Un par en null significa "no cambiar ese par". Si no hay fila todavía, se crea.
create or replace function guardar_periodo(p_periodo_ini date, p_periodo_fin date, p_mensual_ini date, p_mensual_fin date)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede guardar el período' using errcode = '42501';
  end if;
  if (p_periodo_ini is null) <> (p_periodo_fin is null) or (p_mensual_ini is null) <> (p_mensual_fin is null) then
    raise exception 'Cada período necesita fecha de inicio y de fin';
  end if;
  if p_periodo_ini > p_periodo_fin then
    raise exception 'El período general tiene el inicio después del fin';
  end if;
  if p_mensual_ini > p_mensual_fin then
    raise exception 'El período mensual tiene el inicio después del fin';
  end if;

  insert into configuracion as c (id, periodo_ini, periodo_fin, mensual_ini, mensual_fin, actualizado, actualizado_por)
  values (1, p_periodo_ini, p_periodo_fin, p_mensual_ini, p_mensual_fin, now(), auth.uid())
  on conflict (id) do update set
    periodo_ini     = coalesce(excluded.periodo_ini, c.periodo_ini),
    periodo_fin     = coalesce(excluded.periodo_fin, c.periodo_fin),
    mensual_ini     = coalesce(excluded.mensual_ini, c.mensual_ini),
    mensual_fin     = coalesce(excluded.mensual_fin, c.mensual_fin),
    actualizado     = excluded.actualizado,
    actualizado_por = excluded.actualizado_por;
end $$;

revoke execute on function guardar_periodo(date, date, date, date) from public, anon;
grant execute on function guardar_periodo(date, date, date, date) to authenticated;
