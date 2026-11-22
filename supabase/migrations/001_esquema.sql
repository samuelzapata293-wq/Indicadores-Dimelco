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
