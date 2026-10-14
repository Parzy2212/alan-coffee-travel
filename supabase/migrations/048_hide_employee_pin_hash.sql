-- ============================================================
--  Alan Cafe OS -- Migration 048: hide employees.pin_hash
--
--  RAN on production 2026-10-14, verified.
--  Run via Supabase SQL Editor (paste copy without
--  comments). Post-run checks passed: anon and
--  authenticated cannot read pin_hash, anon can read id;
--  /shop/team/employees add/edit/PIN/toggle, POS PIN
--  pad, /cafe checklist and health check all work.
--
--  Live DB before this migration (phase2-plan, 10-12):
--  - employees has the 11 columns of 005
--  - policies: employees_shop_member (authenticated, ALL,
--    own shops) and employees_anon_read (anon, SELECT,
--    USING true)
--  - anon and authenticated hold table-level SELECT,
--    INSERT, UPDATE, DELETE (045 removed the rest), so
--    both can read pin_hash through REST. A bcrypt hash
--    of a 4-digit PIN is cracked offline in minutes.
--
--  This migration changes SELECT only:
--  - table-level SELECT revoked from PUBLIC, anon and
--    authenticated, plus any column-level SELECT on
--    pin_hash, hourly_rate, notes
--  - anon gets SELECT on id, shop_id, name, photo_url,
--    role, is_active, created_at, updated_at
--    (no pin_hash, hourly_rate, notes)
--    anon can still read name/photo_url/role/shop_id:
--    8 columns kept for now, cut with POS auth session
--  - authenticated gets SELECT on every column except
--    pin_hash
--  - assertions: a column not listed above but still
--    readable (e.g. granted by another role), or a
--    listed column not readable, stops the run;
--    authenticated still has INSERT/UPDATE/DELETE.
--    A column added later is in neither list, so it is
--    hidden (42501), not an assertion failure.
--
--  A column added to employees later is NOT readable by
--  anon/authenticated until granted explicitly; app code
--  that selects it gets 42501.
--
--  Before running (read-only, SQL editor):
--  a) non-DEFINER functions or policies that read
--     employees as the caller break after this.
--     expected: 0 rows each
--     SELECT p.proname FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname = 'public' AND NOT p.prosecdef
--       AND p.prosrc ILIKE '%employees%';
--     SELECT tablename, policyname FROM pg_policies
--     WHERE tablename <> 'employees'
--       AND (qual ILIKE '%employees%'
--            OR with_check ILIKE '%employees%');
--  b) REVOKE only removes grants made by the role that
--     runs it. If anon/authenticated SELECT was granted
--     by another role, the assertion stops the run and
--     nothing changes. Check the "/grantor" part of the
--     anon= and authenticated= entries:
--     SELECT relacl FROM pg_class
--     WHERE oid = 'public.employees'::regclass;
--
--  Who reads employees today (repo, 2026-10-13):
--  - anon: lib/health-check.ts:33 select('id', count),
--    GettingStartedChecklist.tsx:41 select('id', head)
--  - authenticated (authClient), /shop/team/employees:
--    page.tsx:37 select id, name, role, is_active,
--    hourly_rate, notes filtered by shop_id;
--    update/delete .eq('id') at page.tsx:55, 63, 66;
--    AddEmployeeModal.tsx:66 insert (with pin_hash);
--    EditEmployeeModal.tsx:65 and :89 update by id
--  - no select('*') and no embed of employees anywhere
--  - verify_employee_pin, hash_employee_pin,
--    reset_employee_pins: SECURITY DEFINER (owner's
--    rights), not affected
--
--  After this, select('*') or select=pin_hash on
--  employees as anon/authenticated fails with 42501
--  (the whole request, not just the column).
--  Writes still work: INSERT/UPDATE may set pin_hash,
--  they only need SELECT on columns in WHERE/RETURNING.
--
--  Not changed here: RLS, policies, INSERT/UPDATE/DELETE
--  grants, staff, employee_shifts, service_role.
--
--  Rollback: scratchpad 048_hide_employee_pin_hash_rollback.sql
--  Paste copy that was run: scratchpad
--  048_hide_employee_pin_hash_paste.sql (same statements,
--  no comments, no checks).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) drop table-level and stray column-level SELECT
REVOKE SELECT ON TABLE public.employees
  FROM PUBLIC, anon, authenticated;
REVOKE SELECT (pin_hash, hourly_rate, notes)
  ON TABLE public.employees
  FROM PUBLIC, anon, authenticated;

-- 2) column-level SELECT, pin_hash never included
GRANT SELECT (id, shop_id, name, photo_url, role,
              is_active, created_at, updated_at)
  ON TABLE public.employees TO anon;
GRANT SELECT (id, shop_id, name, photo_url, role,
              is_active, hourly_rate, notes,
              created_at, updated_at)
  ON TABLE public.employees TO authenticated;

-- 3) assertions
-- has_column_privilege also sees grants made by other
-- grantors, which REVOKE above would leave in place.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(r.role || ' ' || a.attname, ', ') INTO bad
  FROM pg_attribute a
  CROSS JOIN (VALUES
    ('anon', ARRAY['id', 'shop_id', 'name', 'photo_url', 'role',
                   'is_active', 'created_at', 'updated_at']),
    ('authenticated', ARRAY['id', 'shop_id', 'name', 'photo_url',
                            'role', 'is_active', 'hourly_rate',
                            'notes', 'created_at', 'updated_at'])
  ) AS r(role, cols)
  WHERE a.attrelid = 'public.employees'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND has_column_privilege(r.role, a.attrelid, a.attnum, 'SELECT')
        <> (a.attname = ANY (r.cols));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'SELECT differs from plan on: %', bad;
  END IF;

  IF has_table_privilege('anon', 'public.employees', 'SELECT')
     OR has_table_privilege('authenticated', 'public.employees', 'SELECT') THEN
    RAISE EXCEPTION 'table-level SELECT still held on employees';
  END IF;

  SELECT string_agg(r || ' ' || pr, ', ') INTO bad
  FROM unnest(ARRAY['authenticated']) AS r,
  unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS pr
  WHERE NOT has_table_privilege(r, 'public.employees', pr);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'write privileges lost: %', bad;
  END IF;

  IF NOT has_function_privilege('anon', 'public.verify_employee_pin(uuid, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.hash_employee_pin(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PIN functions lost EXECUTE';
  END IF;
END
$$;

-- refresh PostgREST's schema cache (Postgres itself
-- enforces the new privileges right away)
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Checks (run one at a time, after COMMIT)
--
-- expected: anon_pin false, auth_pin false,
--           anon_id true, auth_rate true
-- SELECT
--   has_column_privilege('anon', 'public.employees',
--     'pin_hash', 'SELECT') AS anon_pin,
--   has_column_privilege('authenticated',
--     'public.employees', 'pin_hash', 'SELECT') AS auth_pin,
--   has_column_privilege('anon', 'public.employees',
--     'id', 'SELECT') AS anon_id,
--   has_column_privilege('authenticated',
--     'public.employees', 'hourly_rate', 'SELECT')
--     AS auth_rate;
--
-- Through the REST API with the anon key.
-- expected: HTTP 401, code 42501
-- curl -s -X GET
--   "$SUPABASE_URL/rest/v1/employees?select=pin_hash"
--   -H "apikey: $ANON_KEY"
--   -H "Authorization: Bearer $ANON_KEY"
-- expected: HTTP 200, a JSON array of ids
-- curl -s -X GET
--   "$SUPABASE_URL/rest/v1/employees?select=id"
--   -H "apikey: $ANON_KEY"
--   -H "Authorization: Bearer $ANON_KEY"
-- (one command each; join the lines with spaces)
--
-- In the app:
-- /shop/team/employees: list loads; add an employee,
--   edit info, change a PIN, toggle active
-- POS PIN pad: clock in with the new PIN
-- /cafe: getting-started checklist and health check
--   still count employees
