#!/usr/bin/env bash
# Corre las migraciones y los tests de RLS en una base Postgres vacía.
# Uso: DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
# La base se BORRA y se vuelve a crear: no usar contra Supabase.
set -euo pipefail

: "${DATABASE_URL:?Definí DATABASE_URL apuntando a un Postgres de prueba}"
cd "$(dirname "$0")/.."

ADMIN_URL="$DATABASE_URL"
DB_NAME="pulso_test"
TEST_URL="${DATABASE_URL%/*}/${DB_NAME}"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -qc "drop database if exists ${DB_NAME}" -c "create database ${DB_NAME}"

run() { psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }

run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  run "$f"
done
run supabase/tests/10_rls.test.sql
