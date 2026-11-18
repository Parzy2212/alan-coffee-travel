#!/usr/bin/env bash
# Builds a "run in SQL Editor" test file from a template by pasting the migration in place of
# the line __BODY__, so the copy inside the test can never drift from the migration file.
# usage: scripts/build-migration-test.sh docs/test-072.template.sql supabase/migrations/072_x.sql docs/test-072-x.sql
set -euo pipefail
template=$1; migration=$2; out=$3
if grep -q '\$body\$' "$migration"; then
  echo "migration contains \$body\$, which would end the test's quoted copy early" >&2; exit 1
fi
[ "$(grep -c '^__BODY__$' "$template")" = 1 ] || { echo "template needs exactly one __BODY__ line" >&2; exit 1; }
awk -v m="$migration" '$0 == "__BODY__" { while ((getline line < m) > 0) print line; next } { print }' "$template" > "$out"
echo "wrote $out"
