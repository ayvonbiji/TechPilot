#!/usr/bin/env bash
# Applies the migration to a throwaway database on a local PostgreSQL server
# and runs the RLS tests. Usage: PGHOST=... PGPORT=... PGUSER=... ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="itec_rls_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"; psql -d postgres -qc "drop role if exists anon; drop role if exists authenticated;" >/dev/null 2>&1 || true' EXIT
psql -d postgres -qc "drop role if exists anon; drop role if exists authenticated;" >/dev/null 2>&1 || true
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
