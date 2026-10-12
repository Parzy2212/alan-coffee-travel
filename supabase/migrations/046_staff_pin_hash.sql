-- ============================================================
--  Alan Cafe OS -- Migration 046: hash staff PINs
--
--  Run on production 2026-10-12 via Supabase SQL Editor
--  (paste copy without comments). Post-run checks passed:
--  pin_code 0 rows, pin_hash 2 rows, trigger
--  staff_hash_pin enabled, verify_staff_pin search_path
--  includes extensions, anon can execute.
--
--  NOTE: the 2 existing staff PINs still work (their hash
--  was made from the old PIN), but they are now stored
--  only as bcrypt hashes. The plaintext cannot be
--  recovered, not even by the rollback. If a PIN is
--  forgotten, set a new one in the edit-staff screen.
--
--  Live DB (checked by the owner 2026-10-12):
--  - staff: 3 rows, 2 with pin_code, 0 with pin_hash
--  - pin_code and pin_hash are both TEXT; no triggers
--  - verify_staff_pin matches 021:585 (compares pin_code)
--  - only verify_staff_pin, create_staff, update_staff
--    reference pin_code (the last two are service_role only
--    since 043 and are left as is)
--
--  This migration:
--  1) trigger on staff: any incoming pin_code is checked
--     (4 digits), hashed into pin_hash, then cleared.
--     Without pin_code, pin_hash cannot be set or changed:
--     UPDATE keeps the old hash, INSERT gets NULL.
--  2) backfills the existing plaintext PINs via that trigger
--  3) verify_staff_pin compares pin_hash instead of
--     pin_code (same signature, return type, grants)
--  4) clears any pin_code left
--  5) asserts the result; any failure rolls back everything
--
--  Side effects of the trigger:
--  - a PIN can no longer be removed by writing NULL or ''
--    (e.g. update_staff p_pin_code => ''); old hash stays
--  - never upsert staff with pin_code = EXCLUDED.pin_code:
--    EXCLUDED.pin_code is already NULL, old PIN is kept
--  - anon can still read pin_hash (crackable for 4 digits)
--    and still set any PIN; 046 alone does not fix that
--
--  Not changed here: RLS, policies, table/column grants,
--  create_staff, update_staff. Hiding pin_hash from anon
--  is a later migration.
--
--  Client code needs no change: StaffTab writes pin_code,
--  StaffClient calls verify_staff_pin, nothing reads
--  pin_code back.
--
--  Rollback: scratchpad 046_staff_pin_hash_rollback.sql
--  For the SQL Editor paste scratchpad
--  046_staff_pin_hash_paste.sql (same statements, no comments).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) trigger function + trigger
CREATE OR REPLACE FUNCTION public.staff_hash_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NEW.pin_code IS NOT NULL THEN
    IF NEW.pin_code !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'PIN must be exactly 4 digits';
    END IF;
    NEW.pin_hash := crypt(NEW.pin_code, gen_salt('bf', 10));
    NEW.pin_code := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.pin_hash := OLD.pin_hash;
  ELSE
    NEW.pin_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_hash_pin()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS staff_hash_pin ON public.staff;
CREATE TRIGGER staff_hash_pin
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.staff_hash_pin();

-- 2) backfill through the trigger
-- A bad stored PIN stops the whole migration here.
DO $$
DECLARE
  n_plain int;
  n_bad int;
  n_done int;
BEGIN
  SELECT count(*) FILTER (WHERE pin_code IS NOT NULL),
         count(*) FILTER (WHERE pin_code !~ '^[0-9]{4}$')
  INTO n_plain, n_bad
  FROM public.staff;
  IF n_bad > 0 THEN
    RAISE EXCEPTION '% staff row(s) have a pin_code that is not 4 digits', n_bad;
  END IF;
  UPDATE public.staff SET pin_code = pin_code WHERE pin_code IS NOT NULL;
  GET DIAGNOSTICS n_done = ROW_COUNT;
  IF n_done <> n_plain THEN
    RAISE EXCEPTION 'backfill hashed % of % rows', n_done, n_plain;
  END IF;
END
$$;

-- 3) verify against pin_hash
-- Only the WHERE clause and search_path differ from 021.
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_staff_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff
    WHERE id = p_staff_id
      AND pin_hash IS NOT NULL
      AND pin_hash = crypt(p_pin, pin_hash)
      AND is_active = TRUE
  );
END;
$$;

-- 4) clear any plaintext left
UPDATE public.staff SET pin_code = NULL WHERE pin_code IS NOT NULL;

-- 5) assertions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.staff WHERE pin_code IS NOT NULL) THEN
    RAISE EXCEPTION 'plaintext pin_code still present';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.staff'::regclass
      AND tgname = 'staff_hash_pin'
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'trigger staff_hash_pin missing or disabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.verify_staff_pin(uuid, text)'::regprocedure
      AND array_to_string(proconfig, ',') LIKE '%extensions%'
  ) THEN
    RAISE EXCEPTION 'verify_staff_pin search_path lacks extensions';
  END IF;
  IF has_function_privilege('anon', 'public.staff_hash_pin()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.staff_hash_pin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'staff_hash_pin still executable by anon/authenticated';
  END IF;
END
$$;

COMMIT;

-- Checks (run one at a time, after COMMIT)
-- expected: total 3, has_pin_code 0, has_pin_hash 2
SELECT count(*) AS total,
       count(pin_code) AS has_pin_code,
       count(pin_hash) AS has_pin_hash
FROM public.staff;

-- expected: 1 row, staff_hash_pin, enabled O
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.staff'::regclass AND NOT tgisinternal;

-- expected: search_path includes extensions; anon_can true
SELECT p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can
FROM pg_proc p
WHERE p.oid = 'public.verify_staff_pin(uuid, text)'::regprocedure;
