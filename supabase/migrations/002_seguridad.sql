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
