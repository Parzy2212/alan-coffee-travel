-- ============================================================
--  Alan Cafe OS -- Migration 050: trim get_all_staff
--
--  RAN on production 2026-10-14, verified (SQL: 18
--  columns, ACL unchanged; app checks passed).
--  Tested first in local Docker (Postgres 17 + PostgREST).
--
--  EXECUTE: no REVOKE/GRANT here. Live proacl is the
--  default ({=X/postgres, postgres=X/postgres,
--  anon=X/postgres, authenticated=X/postgres,
--  service_role=X/postgres}); CREATE gives PUBLIC and
--  the owner, Supabase default privileges give anon,
--  authenticated and service_role (if they don't, the
--  ACL differs). The assertion compares the new ACL
--  with the one saved before the DROP: any difference
--  stops the run, nothing changes.
--  Making it service_role-only is left to 051 / POS auth.
--
--  Live DB before this migration (owner, 2026-10-14):
--  - get_all_staff() proacl as above (PUBLIC, postgres,
--    anon, authenticated, service_role: EXECUTE; all
--    granted by postgres)
--  - staff.hours_per_day is numeric and
--    staff.scheduled_start_time is time without time
--    zone (owner, 2026-10-14)
--  - get_all_staff() is SECURITY DEFINER, STABLE,
--    plpgsql, search_path public, returns 20 columns
--    incl. id_card_number, address, emergency_contact,
--    emergency_phone; anon can call it, so anyone with
--    the anon key reads them for every staff row
--  - it does not return hours_per_day or
--    scheduled_start_time, so /cafe payroll uses 8 hours
--    and the staff edit form shows 8 and 08:00, then
--    saves them over the real values on every edit
--
--  This migration drops and recreates get_all_staff()
--  (RETURNS TABLE changes, so CREATE OR REPLACE is not
--  allowed). Returns 18 columns: id, name, name_th,
--  name_lo, role, phone, photo_url, is_active, salary,
--  salary_type, hourly_rate_lak, hours_per_day (new),
--  scheduled_start_time (new), start_date, skills,
--  notes, rating, created_at.
--  Removed: id_card_number, address, emergency_contact,
--  emergency_phone. Flags and ORDER BY unchanged; body
--  otherwise unchanged.
--  - assertions: result columns and types exactly as
--    listed; one get_all_staff in public; owner and ACL
--    the same as before; DEFINER, STABLE, search_path
--    kept; the function runs.
--
--  Values already overwritten by the edit form (8 hours,
--  08:00) cannot be recovered by this migration. Do not
--  enter real staff data before 050 has run.
--
--  Who calls get_all_staff (repo, 2026-10-14), all anon;
--  none reads the 4 removed fields:
--  - app/cafe/CafeClient.tsx:1653 payroll: name, name_th,
--    salary, salary_type, hours_per_day, is_active
--  - components/cafe/StaffTab.tsx:403 leave list,
--    :628 card grid / profile / edit form, :1654 CSV
--    (name, name_th, role, salary, salary_type,
--    start_date, phone, is_active); the edit form reads
--    hours_per_day (:880) and scheduled_start_time
--    (:883) and writes them back (:906, :908)
--  - lib/solo-mode.ts:20 row count only
--  - type StaffMember (components/cafe/shared.tsx:232)
--    has no removed field
--
--  Not changed here: staff table, its grants and
--  policies, any other function.
--
--  Before running (read-only, SQL editor):
--  a) expected: the 5 entries above; owner postgres
--     (the grantor; the run stops if CREATE gives a
--     different owner)
--     SELECT proowner::regrole, proacl FROM pg_proc
--     WHERE oid = 'public.get_all_staff()'::regprocedure;
--  b) expected: 1 row (other overloads are not dropped
--     and would stop the run)
--     SELECT oid::regprocedure FROM pg_proc
--     WHERE proname = 'get_all_staff'
--       AND pronamespace = 'public'::regnamespace;
--
--  Rollback: scratchpad 050_get_all_staff_trim_rollback.sql
--  For the SQL Editor paste scratchpad
--  050_get_all_staff_trim_paste.sql (same statements
--  incl. assertions, no comments, no after-run checks).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) save owner and ACL to compare after the DROP
CREATE TEMP TABLE get_all_staff_acl_before ON COMMIT DROP AS
SELECT p.proowner, a.grantor, a.grantee, a.privilege_type,
       a.is_grantable
FROM pg_proc p,
aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS a
WHERE p.oid = 'public.get_all_staff()'::regprocedure;

-- 2) recreate without the 4 fields, with hours_per_day
--    and scheduled_start_time
DROP FUNCTION public.get_all_staff();

CREATE FUNCTION public.get_all_staff()
 RETURNS TABLE(id uuid, name text, name_th text, name_lo text, role text, phone text, photo_url text, is_active boolean, salary numeric, salary_type text, hourly_rate_lak numeric, hours_per_day numeric, scheduled_start_time time without time zone, start_date date, skills text[], notes text, rating numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT
      s.id, s.name, s.name_th, s.name_lo, s.role, s.phone,
      COALESCE(s.avatar_url, s.photo_url), s.is_active,
      s.salary, s.salary_type, s.hourly_rate_lak,
      s.hours_per_day, s.scheduled_start_time,
      s.start_date, s.skills, s.notes, COALESCE(s.rating, 5.0),
      s.created_at
    FROM staff s
    ORDER BY s.is_active DESC, s.name;
END;
$function$;

-- 3) assertions
DO $$
DECLARE
  f oid := 'public.get_all_staff()'::regprocedure;
  bad text;
BEGIN
  IF pg_get_function_result(f) <> 'TABLE(id uuid, name text, '
     'name_th text, name_lo text, role text, phone text, '
     'photo_url text, is_active boolean, salary numeric, '
     'salary_type text, hourly_rate_lak numeric, '
     'hours_per_day numeric, '
     'scheduled_start_time time without time zone, '
     'start_date date, skills text[], '
     'notes text, rating numeric, '
     'created_at timestamp with time zone)' THEN
    RAISE EXCEPTION 'get_all_staff result differs: %',
      pg_get_function_result(f);
  END IF;

  IF (SELECT count(*) FROM pg_proc
      WHERE proname = 'get_all_staff'
        AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'more than one get_all_staff in public';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc
                 WHERE oid = f AND prosecdef
                   AND provolatile = 's'
                   AND proconfig = ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'get_all_staff flags changed';
  END IF;

  SELECT string_agg(coalesce(n.rolname, 'PUBLIC') || ' '
                    || d.privilege_type, ', ') INTO bad
  FROM (
    (SELECT p.proowner, a.grantor, a.grantee, a.privilege_type,
            a.is_grantable
     FROM pg_proc p,
     aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS a
     WHERE p.oid = f
     EXCEPT SELECT * FROM get_all_staff_acl_before)
    UNION ALL
    (SELECT * FROM get_all_staff_acl_before
     EXCEPT
     SELECT p.proowner, a.grantor, a.grantee, a.privilege_type,
            a.is_grantable
     FROM pg_proc p,
     aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS a
     WHERE p.oid = f)
  ) AS d
  LEFT JOIN pg_roles n ON n.oid = d.grantee;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'owner or ACL differs from before on: %', bad;
  END IF;

  PERFORM count(*) FROM public.get_all_staff();
END
$$;

-- refresh PostgREST's schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Checks (run one at a time, after COMMIT)
--
-- expected: the 18 columns above, incl. hours_per_day
-- and scheduled_start_time
-- SELECT pg_get_function_result(
--   'public.get_all_staff()'::regprocedure);
--
-- expected: the same proowner and proacl as check a
-- SELECT proowner::regrole, proacl FROM pg_proc
-- WHERE oid = 'public.get_all_staff()'::regprocedure;
--
-- Through the REST API with the anon key.
-- expected: HTTP 200, rows with hours_per_day,
-- scheduled_start_time ("08:00:00" form) and
-- without id_card_number
-- curl -s -X POST
--   "$SUPABASE_URL/rest/v1/rpc/get_all_staff"
--   -H "apikey: $ANON_KEY"
--   -H "Authorization: Bearer $ANON_KEY"
--   -H "Content-Type: application/json" -d "{}"
-- (one command; join the lines with spaces)
--
-- In the app:
-- /cafe staff tab: card grid loads, open a profile,
--   edit a test staff: hours and start time fields
--   show the saved values (were always 8 / 08:00); save
--   without changes, reopen: values unchanged; change
--   start time, save, kiosk late check uses the new time;
--   CSV export, leave list
-- /cafe costs: load salaries from staff; hourly staff
--   use their own hours_per_day
-- /pos, /cafe: solo-mode banner not shown when staff exist
