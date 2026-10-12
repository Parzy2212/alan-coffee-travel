-- ============================================================
--  Alan Cafe OS -- Migration 045: phase 2 quick hardening
--
--  Run on production 2026-10-12 via Supabase SQL Editor. Post-run checks
--  passed: proconfig set on all 3 PIN functions; TRUNCATE/TRIGGER/REFERENCES
--  false for anon+authenticated on staff, employees, employee_shifts;
--  SELECT/INSERT/UPDATE/DELETE unchanged.
--  Note: the version pasted into the editor had comments stripped
--  (copy/paste merged comment lines into DO $$); statements are identical.
--
--  Live DB (checked 2026-10-12, docs/phase2-plan.md section E):
--  - hash_employee_pin, reset_employee_pins, verify_employee_pin are
--    SECURITY DEFINER with no search_path (proconfig NULL). They call
--    crypt()/gen_salt() from pgcrypto, which lives in schema `extensions`.
--  - anon and authenticated hold every table privilege on staff and
--    employees, including TRUNCATE, TRIGGER and REFERENCES. RLS does not
--    apply to TRUNCATE. PostgREST doesn't expose TRUNCATE, so this is
--    defense in depth, not a hole reachable from the browser today.
--  - Postgres 17 also grants MAINTAIN by default; left as is (not asked).
--
--  This migration:
--  1) pins search_path = public, extensions, pg_temp on those 3 functions
--     (function bodies unchanged)
--  2) revokes TRUNCATE, TRIGGER, REFERENCES on staff, employees and
--     employee_shifts from PUBLIC, anon, authenticated.
--     SELECT / INSERT / UPDATE / DELETE are NOT touched here.
--     No app code truncates, creates triggers, or adds foreign keys
--     through the API, so nothing in the app should change.
--
--  Rollback: scratchpad 045_phase2_hardening_quick_rollback.sql
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) search_path on every overload of the 3 PIN functions
DO $$
DECLARE
  f regprocedure;
  n int;
BEGIN
  SELECT count(DISTINCT p.proname) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname IN ('hash_employee_pin', 'reset_employee_pins', 'verify_employee_pin');
  IF n <> 3 THEN
    RAISE EXCEPTION 'expected 3 PIN functions, found %', n;
  END IF;
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.proname IN ('hash_employee_pin', 'reset_employee_pins', 'verify_employee_pin')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', f);
  END LOOP;
END $$;

-- 2) table privileges RLS can't guard
REVOKE TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.staff, public.employees, public.employee_shifts
  FROM PUBLIC, anon, authenticated;

-- REVOKE silently does nothing on grants made by another grantor
-- (e.g. supabase_admin) -- fail the whole transaction instead.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(r || ' ' || t || ' ' || pr, ', ') INTO bad
  FROM unnest(ARRAY['public.staff', 'public.employees', 'public.employee_shifts']) AS t,
       unnest(ARRAY['anon', 'authenticated']) AS r,
       unnest(ARRAY['TRUNCATE', 'TRIGGER', 'REFERENCES']) AS pr
  WHERE has_table_privilege(r, t, pr);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'privileges still held after REVOKE: %', bad;
  END IF;
END $$;

COMMIT;

-- Checks -- expected: 3 rows, proconfig = {"search_path=public, extensions, pg_temp"}
SELECT p.oid::regprocedure AS signature, p.prosecdef, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('hash_employee_pin', 'reset_employee_pins', 'verify_employee_pin')
ORDER BY 1;

-- expected: truncate/trigger/references = false on every row;
--           select/insert/update/delete unchanged (true today)
SELECT t.tbl, r.role,
  has_table_privilege(r.role, t.tbl, 'TRUNCATE')   AS truncate,
  has_table_privilege(r.role, t.tbl, 'TRIGGER')    AS trigger,
  has_table_privilege(r.role, t.tbl, 'REFERENCES') AS references_,
  has_table_privilege(r.role, t.tbl, 'SELECT')     AS select_,
  has_table_privilege(r.role, t.tbl, 'INSERT')     AS insert_,
  has_table_privilege(r.role, t.tbl, 'UPDATE')     AS update_,
  has_table_privilege(r.role, t.tbl, 'DELETE')     AS delete_
FROM (VALUES ('public.staff'), ('public.employees'), ('public.employee_shifts')) AS t(tbl)
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role)
ORDER BY 1, 2;
