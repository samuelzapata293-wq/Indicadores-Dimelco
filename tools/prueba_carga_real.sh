#!/usr/bin/env bash
# Carga el Excel real (datos_local/LIBRO_MAESTRO_15-09-2026.xlsx) en un PostgreSQL temporal con las migraciones,
# llamando a cargar_datos como administrador, y compara los conteos con los de leerLibro.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
LIBRO="${LIBRO:-$RAIZ/datos_local/LIBRO_MAESTRO_15-09-2026.xlsx}"
if [ ! -f "$LIBRO" ]; then echo "AVISO: no existe $LIBRO; se omite la prueba de carga real."; exit 0; fi
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
DIR="$(mktemp -d)"
PUERTO="${PUERTO:-55434}"
COMO=""; [ "$(id -u)" = "0" ] && { chown -R postgres "$DIR"; COMO="runuser -u postgres --"; }
trap '[ $? -ne 0 ] && tail -5 "$DIR/log" >&2 2>/dev/null; $COMO "$PGBIN/pg_ctl" -D "$DIR/datos" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
JSON="$DIR/datos.json"; CONTEOS="$DIR/conteos.json"
(cd "$RAIZ" && npx vite-node tools/prueba_carga_real.ts "$LIBRO" "$JSON" "$CONTEOS")
chmod a+r "$JSON" "$CONTEOS"
$COMO "$PGBIN/initdb" -D "$DIR/datos" -U postgres -A trust >/dev/null
$COMO "$PGBIN/pg_ctl" -D "$DIR/datos" -o "-p $PUERTO -k $DIR" -l "$DIR/log" start -w >/dev/null
PSQL=(psql -h "$DIR" -p "$PUERTO" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
export PGOPTIONS="-c client_min_messages=warning"
"${PSQL[@]}" -f "$RAIZ/tools/base_local.sql"
for f in "$RAIZ"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
CONT="$(cat "$CONTEOS")"
"${PSQL[@]}" -v json="$JSON" -v esperado="$CONT" <<'SQL'
\set contenido `cat :json`
set client_min_messages = warning;
\o /dev/null
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'real@x.com') on conflict do nothing;
insert into administradores (user_id) values ('00000000-0000-0000-0000-0000000000aa') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa"}', false);
select set_config('prueba.esperado', :'esperado', false);
create temp table _t as select clock_timestamp() as t0, null::timestamptz as t1, null::bigint as id;
update _t set id = cargar_datos(:'contenido'::jsonb, 'LIBRO_MAESTRO.xlsx', 'excel/LIBRO_MAESTRO.xlsx');
update _t set t1 = clock_timestamp();
\o
do $$
declare
  esp jsonb := current_setting('prueba.esperado')::jsonb;
  real jsonb;
  seg numeric;
begin
  select extract(epoch from t1 - t0) into seg from _t;
  real := jsonb_build_object('equipos', (select count(*) from equipos), 'responsables', (select count(*) from responsables),
    'tipos_mantto', (select count(*) from tipos_mantto), 'metas', (select count(*) from metas), 'paros', (select count(*) from paros));
  raise warning 'Conteos en la base: %', real;
  raise warning 'Conteos de leerLibro: %', esp;
  raise warning 'cargar_datos: % s', round(seg, 2);
  if real is distinct from esp then raise exception 'Los conteos no coinciden con los de leerLibro'; end if;
  if (select filas from cargas order by id desc limit 1) is distinct from esp then
    raise exception 'El registro de cargas no coincide con los conteos';
  end if;
end $$;
SQL
echo "CARGA REAL APROBADA"
