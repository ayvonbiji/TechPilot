#!/usr/bin/env bash
# Applies every migration to a throwaway database on a local PostgreSQL server
# and runs the database security tests.
#   PGHOST=... PGPORT=... PGUSER=... ./supabase/tests/run.sh
# The first migration is applied, then pre-existing data is seeded, then the
# remaining migrations run — so upgrades are tested against real old data.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="itec_rls_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/auth_stub.sql
first=1
for f in supabase/migrations/*.sql; do
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"
  if [ "$first" = 1 ]; then
    psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/seed_before_workspaces.sql
    first=0
  fi
done
for t in supabase/tests/*_test.sql; do
  echo "== $t"
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$t" 2>&1 | sed -n 's/.*NOTICE:  //p; /ERROR/p; /CONTEXT/p; /passed/p'
done
