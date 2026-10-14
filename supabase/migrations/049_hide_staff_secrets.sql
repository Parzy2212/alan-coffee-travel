-- ============================================================
--  Alan Cafe OS -- Migration 049: hide staff PIN and ID data
--
--  RAN on production 2026-10-14; SQL post-run check
--  passed (pin_hash, id_card_number hidden from
--  anon/authenticated; face_descriptor still readable).
--  App checks recorded separately by owner.
--  Tested first in local Docker (Postgres 17 + PostgREST).
--
--  Live DB before this migration (owner, 2026-10-14):
--  - staff has 30 columns (list below), no column ACLs
--  - relacl: anon=arwdm/postgres, authenticated=arwdm/
--    postgres (granted by postgres, so REVOKE as postgres
--    removes them)
--  - 7 policies on staff: "anon: read active staff"
--    (SELECT, is_active), "anon: write staff" (ALL, true),
--    and 5 for authenticated through get_my_role():
--    owner: all on staff, manager: select all staff,
--    manager: update staff, staff: select own row,
--    staff: update own row
--  - no non-DEFINER function references staff
--  - get_all_staff (DEFINER, anon) returns 20 columns,
--    incl. id_card_number, address, emergency_*
--
--  This migration changes SELECT only. Hidden from anon
--  and authenticated (8): pin_hash, pin_code,
--  id_card_number, address, address_th, address_lo,
--  emergency_contact, emergency_phone.
--  Still readable (22): id, name, role, phone, photo_url,
--  hourly_rate_lak, is_active, performance_score,
--  created_at, name_lo, name_th, avatar_url, salary,
--  salary_type, start_date, skills, notes, rating,
--  scheduled_start_time, face_descriptor, hours_per_day,
--  shop_id.
--  - assertions: a hidden column still readable (e.g.
--    granted by another role) or a listed column not
--    readable stops the run; INSERT, UPDATE, DELETE
--    kept for both. A column missing from both lists is
--    hidden silently, so check (b) below counts them.
--
--  A column added to staff later is NOT readable by
--  anon/authenticated until granted explicitly; app code
--  that selects it gets 42501.
--
--  Who reads staff today (repo, 2026-10-14), all anon:
--  - app/staff/StaffClient.tsx:677 id, name, name_th,
--    avatar_url, scheduled_start_time, face_descriptor
--  - app/pos/POSClient.tsx:2195 id, name
--  - components/cafe/ScheduleTab.tsx:182 id, name,
--    name_th, avatar_url
--  - StaffTab.tsx:393 embed staff:staff_id(name) from
--    leave_requests
--  - StaffTab.tsx writes: update by id (:281, :913,
--    :1357), delete by id (:944), insert with
--    .select('id') (:1331); pin_code is written only
--  - no select('*') on staff anywhere
--  - get_all_staff, get_staff_today_status,
--    toggle_staff_active, verify_staff_pin, clock_in,
--    staff_hash_pin: SECURITY DEFINER, not affected
--
--  STILL OPEN after this migration:
--  - get_all_staff still returns id_card_number,
--    address, emergency_* to anon (planned: 050)
--  - salary, phone, notes, face_descriptor stay readable
--    (UI needs them while /cafe and /staff run as anon)
--  - "anon: write staff" (ALL) stays: anyone with the
--    anon key can still set any PIN, face or salary
--    (planned: 051, server route)
--
--  Before running (read-only, SQL editor):
--  a) relacl must still show anon/authenticated granted
--     by postgres:
--     SELECT relacl FROM pg_class
--     WHERE oid = 'public.staff'::regclass;
--  b) expected: 30
--     SELECT count(*) FROM information_schema.columns
--     WHERE table_schema = 'public'
--       AND table_name = 'staff';
--  c) policies on other tables and views read staff with
--     the caller's rights; one that reads a hidden column
--     breaks. expected: 0 rows each
--     SELECT tablename, policyname FROM pg_policies
--     WHERE tablename <> 'staff'
--       AND (qual ILIKE '%staff%'
--            OR with_check ILIKE '%staff%');
--     SELECT viewname FROM pg_views
--     WHERE schemaname = 'public'
--       AND definition ILIKE '%staff%';
--
--  Not changed here: RLS, policies, INSERT/UPDATE/DELETE
--  grants, functions, service_role.
--
--  Rollback: scratchpad 049_hide_staff_secrets_rollback.sql
--  For the SQL Editor paste scratchpad
--  049_hide_staff_secrets_paste.sql (same statements,
--  no comments, no checks).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) drop table-level and stray column-level SELECT
REVOKE SELECT ON TABLE public.staff
  FROM PUBLIC, anon, authenticated;
REVOKE SELECT (pin_hash, pin_code, id_card_number,
               address, address_th, address_lo,
               emergency_contact, emergency_phone)
  ON TABLE public.staff
  FROM PUBLIC, anon, authenticated;

-- 2) column-level SELECT on the 22 non-secret columns
GRANT SELECT (id, name, role, phone, photo_url,
              hourly_rate_lak, is_active, performance_score,
              created_at, name_lo, name_th, avatar_url,
              salary, salary_type, start_date, skills,
              notes, rating, scheduled_start_time,
              face_descriptor, hours_per_day, shop_id)
  ON TABLE public.staff TO anon, authenticated;

-- 3) assertions
-- has_column_privilege also sees grants made by other
-- grantors, which REVOKE above would leave in place.
DO $$
DECLARE
  bad text;
  ok_cols text[] := ARRAY[
    'id', 'name', 'role', 'phone', 'photo_url',
    'hourly_rate_lak', 'is_active', 'performance_score',
    'created_at', 'name_lo', 'name_th', 'avatar_url',
    'salary', 'salary_type', 'start_date', 'skills',
    'notes', 'rating', 'scheduled_start_time',
    'face_descriptor', 'hours_per_day', 'shop_id'];
BEGIN
  SELECT string_agg(r || ' ' || a.attname, ', ') INTO bad
  FROM pg_attribute a,
  unnest(ARRAY['anon', 'authenticated']) AS r
  WHERE a.attrelid = 'public.staff'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND has_column_privilege(r, a.attrelid, a.attnum, 'SELECT')
        <> (a.attname = ANY (ok_cols));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'SELECT differs from plan on: %', bad;
  END IF;

  IF has_table_privilege('anon', 'public.staff', 'SELECT')
     OR has_table_privilege('authenticated', 'public.staff', 'SELECT') THEN
    RAISE EXCEPTION 'table-level SELECT still held on staff';
  END IF;

  SELECT string_agg(r || ' ' || pr, ', ') INTO bad
  FROM unnest(ARRAY['anon', 'authenticated']) AS r,
  unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS pr
  WHERE NOT has_table_privilege(r, 'public.staff', pr);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'write privileges lost: %', bad;
  END IF;

  IF NOT has_function_privilege('anon', 'public.verify_staff_pin(uuid, text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.get_all_staff()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon lost EXECUTE on a staff function';
  END IF;
END
$$;

-- refresh PostgREST's schema cache (Postgres itself
-- enforces the new privileges right away)
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Checks (run one at a time, after COMMIT)
--
-- expected: anon_pin false, anon_idcard false,
--           auth_pin false, anon_face true, anon_name true
-- SELECT
--   has_column_privilege('anon', 'public.staff',
--     'pin_hash', 'SELECT') AS anon_pin,
--   has_column_privilege('anon', 'public.staff',
--     'id_card_number', 'SELECT') AS anon_idcard,
--   has_column_privilege('authenticated', 'public.staff',
--     'pin_hash', 'SELECT') AS auth_pin,
--   has_column_privilege('anon', 'public.staff',
--     'face_descriptor', 'SELECT') AS anon_face,
--   has_column_privilege('anon', 'public.staff',
--     'name', 'SELECT') AS anon_name;
--
-- Through the REST API with the anon key.
-- expected: HTTP 401, code 42501
-- curl -s -X GET
--   "$SUPABASE_URL/rest/v1/staff?select=pin_hash"
--   -H "apikey: $ANON_KEY"
--   -H "Authorization: Bearer $ANON_KEY"
-- expected: HTTP 200, a JSON array of ids and names
-- curl -s -X GET
--   "$SUPABASE_URL/rest/v1/staff?select=id,name"
--   -H "apikey: $ANON_KEY"
--   -H "Authorization: Bearer $ANON_KEY"
-- (one command each; join the lines with spaces)
--
-- In the app:
-- /staff kiosk: staff list loads, clock in with PIN and
--   face check
-- /cafe staff tab: list, add (with PIN and photo), edit
--   (incl. PIN), toggle active, delete a test staff,
--   CSV export, leave requests list shows names
-- /cafe schedule tab: staff list loads
-- /pos close-shift: staff dropdown loads
