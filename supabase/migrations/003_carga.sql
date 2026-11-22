-- Carga completa desde la app: reemplaza el contenido de las cinco tablas en una sola transacción
-- (la función entera es una transacción; si algo falla no queda ningún cambio).
-- datos = {"equipos":[...], "responsables":[...], "tipos_mantto":[...], "metas":[...], "paros":[...]}
-- con los nombres de campo del contrato. Devuelve el id de la fila de cargas.

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

  -- Paros primero por la clave foránea.
  delete from paros;
  delete from metas;
  delete from tipos_mantto;
  delete from responsables;
  delete from equipos;

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
