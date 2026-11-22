-- Instalación completa de la base de indicadores (generado por tools/base_armar_instalacion.sh).
-- Pegar todo en el SQL Editor del proyecto Supabase y ejecutar. Se puede repetir.

-- ===== 001_esquema.sql =====
-- Indicadores de mantenimiento: tablas de entrada (contrato, sección 1) y control de cargas.
-- Solo se guardan campos de entrada; los derivados (inicio, fin, disp, minutos ajustados...) se calculan en la app.

create table if not exists equipos (
  id_equipo    bigint primary key,
  descripcion  text not null,          -- recortada (sin espacios al inicio ni al final)
  familia      text
);

create table if not exists responsables (
  id_responsable text primary key,     -- GPO.CODIGOS (T-MTO-ME, T-MTO-EL, ...)
  denominacion   text,
  responsable    text,
  disponibilidad text
);

create table if not exists tipos_mantto (
  id_tipo_mantto text primary key,     -- PP, NPI, EPP
  descripcion    text
);

-- Metas mensuales. equipo_descripcion es la descripción del equipo (no la familia).
create table if not exists metas (
  id                 bigint generated always as identity primary key,
  mes                date not null,    -- primer día del mes
  equipo_descripcion text not null,
  meta_disp          numeric,          -- fracción 0 a 1
  meta_mttr          numeric,
  meta_mtbf          numeric,
  meta_conf          numeric
);
create index if not exists metas_mes_idx on metas (mes);

-- Paros: el aviso puede repetirse, por eso la clave es propia.
-- No hay clave foránea a responsables ni a tipos_mantto: el contrato pide contar los paros
-- con responsable vacío o desconocido.
create table if not exists paros (
  id               bigint generated always as identity primary key,
  aviso            bigint not null,
  id_equipo        bigint not null references equipos (id_equipo),
  fecha_inicio     date not null,
  hora_inicio      text,               -- "hh:mm[:ss]"; "24:00:00" ya viene como "00:00:00"
  fecha_fin        date not null,
  hora_fin         text,               -- "hh:mm[:ss]", sin reemplazo
  duracion_min     numeric,
  desc_paro        text,
  id_responsable   text,
  cod_falla        text,
  texto_falla      text,
  id_tipo_mantto   text,
  tipo_paro_pp_npi text,
  resumen          text
);
create index if not exists paros_equipo_idx on paros (id_equipo);
create index if not exists paros_fecha_inicio_idx on paros (fecha_inicio);
create index if not exists paros_aviso_idx on paros (aviso);

-- Historial de cargas del Excel.
create table if not exists cargas (
  id           bigint generated always as identity primary key,
  fecha_carga  timestamptz not null default now(),
  usuario      uuid,
  archivo      text,
  ruta_storage text,
  filas        jsonb,                  -- conteo por tabla: {"equipos": n, "paros": n, ...}
  fecha_min    date,                   -- menor fecha_inicio de paros
  fecha_max    date,                   -- mayor fecha_inicio de paros
  notas        text
);

-- Quién puede cargar datos (una persona).
create table if not exists administradores (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from administradores where user_id = auth.uid())
$$;

-- ===== 002_seguridad.sql =====
-- Seguridad: lectura pública (anon y authenticated), sin escritura directa para nadie.
-- Las cargas se hacen solo con cargar_datos() (003), que verifica es_admin().

do $$
declare t text;
begin
  foreach t in array array['equipos','responsables','tipos_mantto','metas','paros','cargas','administradores'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public, anon, authenticated', t);
  end loop;

  foreach t in array array['equipos','responsables','tipos_mantto','metas','paros','cargas'] loop
    execute format('grant select on %I to anon, authenticated', t);
    execute format('drop policy if exists leer_%I on %I', t, t);
    execute format('create policy leer_%I on %I for select to anon, authenticated using (true)', t, t);
  end loop;
  -- administradores: sin permisos ni políticas; solo es_admin() (security definer) la consulta.
end $$;

revoke execute on function es_admin() from public;
grant execute on function es_admin() to anon, authenticated;

-- ===== 003_carga.sql =====
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

-- ===== 004_storage.sql =====
-- Bucket privado «excel»: solo el administrador sube y lee los libros cargados.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage: se omite 004 (base local)';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('excel', 'excel', false)
  on conflict (id) do nothing;

  drop policy if exists leer_excel on storage.objects;
  create policy leer_excel on storage.objects for select to authenticated
    using (bucket_id = 'excel' and es_admin());

  drop policy if exists subir_excel on storage.objects;
  create policy subir_excel on storage.objects for insert to authenticated
    with check (bucket_id = 'excel' and es_admin());

  -- update: lo necesita subir con «upsert» sobre una ruta existente.
  drop policy if exists reemplazar_excel on storage.objects;
  create policy reemplazar_excel on storage.objects for update to authenticated
    using (bucket_id = 'excel' and es_admin()) with check (bucket_id = 'excel' and es_admin());
end $$;

-- ===== Alta del administrador (hacer una vez) =====
-- 1. Crear el usuario en Authentication > Users (correo y contraseña).
-- 2. Quitar los dos guiones del inicio de la línea siguiente, poner su correo y ejecutar:
-- insert into administradores(user_id) select id from auth.users where email = '<correo>';
-- Para verificar: select * from administradores;  (debe aparecer una fila).
