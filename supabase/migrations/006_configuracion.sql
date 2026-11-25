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
