-- Prueba de volumen: 15 000 paros en una sola llamada a cargar_datos, menos de 10 s.
\set ON_ERROR_STOP 1
\set contenido `cat :json`
set client_min_messages = warning;
\o /dev/null
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'vol@x.com') on conflict do nothing;
insert into administradores (user_id) values ('00000000-0000-0000-0000-0000000000aa') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa"}', false);
create temp table _t as select clock_timestamp() as t0, null::timestamptz as t1, null::bigint as id;
update _t set id = cargar_datos(:'contenido'::jsonb, 'volumen.xlsx', 'excel/volumen.xlsx');
update _t set t1 = clock_timestamp();
do $$
declare seg numeric; n int;
begin
  select extract(epoch from t1 - t0) into seg from _t;
  select count(*) into n from paros;
  if n <> 15000 then raise exception 'Volumen: se esperaban 15000 paros y hay %', n; end if;
  raise warning 'Volumen: 15000 paros cargados en % s', round(seg, 2);
  if seg >= 10 then raise exception 'Volumen: tardó % s (límite 10 s)', round(seg, 2); end if;
end $$;
\echo 'APROBADA: volumen (15000 paros en menos de 10 s)'
