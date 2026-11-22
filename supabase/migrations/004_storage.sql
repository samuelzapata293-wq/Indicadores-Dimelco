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
