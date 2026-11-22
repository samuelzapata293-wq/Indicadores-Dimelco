#!/usr/bin/env bash
# Une las migraciones en supabase/instalar_todo.sql para pegarlas de una vez en el SQL Editor.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
{
  echo "-- Instalación completa de la base de indicadores (generado por tools/base_armar_instalacion.sh)."
  echo "-- Pegar todo en el SQL Editor del proyecto Supabase y ejecutar. Se puede repetir."
  for f in "$RAIZ"/supabase/migrations/*.sql; do
    echo; echo "-- ===== $(basename "$f") ====="; cat "$f"
  done
  cat <<'FIN'

-- ===== Alta del administrador (hacer una vez) =====
-- 1. Crear el usuario en Authentication > Users (correo y contraseña).
-- 2. Quitar los dos guiones del inicio de la línea siguiente, poner su correo y ejecutar:
-- insert into administradores(user_id) select id from auth.users where email = '<correo>';
-- Para verificar: select * from administradores;  (debe aparecer una fila).
FIN
} > "$RAIZ/supabase/instalar_todo.sql"
echo "supabase/instalar_todo.sql armado"
