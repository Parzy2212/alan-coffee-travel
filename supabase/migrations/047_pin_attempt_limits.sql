-- ============================================================
--  Alan Cafe OS -- Migration 047: PIN attempt limits
--
--  RAN on production 2026-10-13, verified.
--  Run via Supabase SQL Editor (paste copy without
--  comments). Post-run checks passed: both verify
--  functions VOLATILE and executable by anon,
--  pin_attempts empty, /staff kiosk, employees page
--  and POS PIN pad checked in the app.
--
--  Live DB before this migration (owner, 2026-10-12):
--  - verify_staff_pin: STABLE, SECURITY DEFINER,
--    definition from 046, anon can execute
--  - verify_employee_pin: VOLATILE, SECURITY DEFINER,
--    definition from 005, anon can execute
--  - hash_employee_pin: anon can execute; the app calls
--    it only through authClient (lib/employee-pin.ts:17)
--  - employees: 2 rows, pin_hash NOT NULL; staff: 3 rows
--
--  This migration:
--  1) table pin_attempts (RLS on, no policies, no grants)
--  2) internal helpers, not callable by anon/authenticated:
--     pin_attempt_wait(scope) locks the scope row and
--     returns seconds left on its lock (0 = not locked);
--     pin_attempt_record(scope, ok, threshold, base, cap)
--     resets the counter on ok, otherwise adds 1 and locks
--     for least(cap, base * 2^(fails - threshold)) seconds
--     once fails >= threshold. Fails older than 24 h with
--     no newer fail count as 0.
--  3) verify_staff_pin: same signature and return type,
--     now VOLATILE (it writes). Scope 'staff:<id>'.
--     5 fails -> lock 60 s, then 2, 4, 8, 16, max 30 min.
--  4) verify_employee_pin: same signature and RETURNS
--     TABLE. Scope 'shop:<shop_id>' (option A, temporary).
--     10 fails -> lock 30 s, then 1, 2, 4, 8, max 15 min.
--  5) hash_employee_pin: EXECUTE revoked from PUBLIC and
--     anon; authenticated and service_role keep it.
--  6) assertions; any failure rolls back everything.
--
--  While a scope is locked, both verify functions raise
--  'PIN_LOCKED' (seconds left in DETAIL and HINT), even
--  for the right PIN, without running bcrypt and without
--  extending the lock. A wrong PIN returns false / no
--  rows normally: raising would roll back the counter.
--  verify_staff_pin returns false without counting when
--  the staff id does not exist or the PIN is not 4
--  digits. verify_employee_pin returns no rows without
--  counting when the shop has no employees. Neither
--  creates pin_attempts rows in those cases.
--
--  Option A: the lock on employees is per shop.
--  Anyone with the public anon key can lock the POS PIN
--  pad of a whole shop by sending 10 wrong PINs. Remove
--  this when the PIN pad picks the employee first and
--  verifies by employee id (lock per employee).
--  Also with option A, any correct PIN in the shop resets
--  the shop counter, so each normal clock-in gives a
--  guesser 10 more tries. Nothing alerts the owner.
--
--  Lock abuse: staff ids are readable by anon, so anyone
--  can keep one staff member locked (5 wrong PINs, then
--  1 more each time the lock ends).
--
--  Parallel calls on one scope wait for each other (row
--  lock held through bcrypt). A burst on one shop can
--  push a real call past the anon statement_timeout,
--  which the PIN pad shows as a wrong PIN.
--
--  Client code: no change needed to keep working. Today
--  a locked attempt shows the same as a wrong PIN
--  (StaffClient: 'PIN ไม่ถูกต้อง', PinPad: shake).
--
--  Unlock by hand (SQL editor), one staff member:
--    DELETE FROM public.pin_attempts
--    WHERE scope = 'staff:<uuid>';
--  one shop:  WHERE scope = 'shop:<uuid>';
--  everything:  DELETE FROM public.pin_attempts;
--
--  Not changed here: RLS, policies, table/column grants
--  on staff, employees or any other table (048/049).
--
--  Rollback: scratchpad 047_pin_attempt_limits_rollback.sql
--  Paste copy that was run: scratchpad
--  047_pin_attempt_limits_paste.sql (same statements,
--  no comments, no checks).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) attempts table
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  scope        text        PRIMARY KEY,
  fail_count   int         NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pin_attempts
  FROM PUBLIC, anon, authenticated;

-- 2a) lock the scope row; return seconds left on its lock
-- The row lock is held until the caller's transaction
-- ends, so parallel attempts on one scope run one by one.
-- Times use clock_timestamp(): now() is the start of a
-- transaction that may have waited for the row lock.
CREATE OR REPLACE FUNCTION public.pin_attempt_wait(p_scope text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_until timestamptz;
  v_got boolean := false;
  v_now timestamptz;
BEGIN
  IF p_scope IS NULL OR char_length(p_scope) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;
  FOR i IN 1..3 LOOP
    INSERT INTO public.pin_attempts (scope) VALUES (p_scope)
    ON CONFLICT (scope) DO NOTHING;
    SELECT locked_until INTO v_until
    FROM public.pin_attempts WHERE scope = p_scope FOR UPDATE;
    v_got := FOUND;
    EXIT WHEN v_got;
  END LOOP;
  IF NOT v_got THEN
    RAISE EXCEPTION 'pin_attempts row for % kept vanishing', p_scope;
  END IF;
  v_now := clock_timestamp();
  IF v_until IS NOT NULL AND v_until > v_now THEN
    RETURN GREATEST(1, CEIL(EXTRACT(EPOCH FROM v_until - v_now)))::int;
  END IF;
  RETURN 0;
END;
$$;

-- 2b) record one attempt; returns lock seconds (0 = none)
CREATE OR REPLACE FUNCTION public.pin_attempt_record(
  p_scope text,
  p_ok boolean,
  p_threshold int,
  p_base int,
  p_cap int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.pin_attempts%ROWTYPE;
  v_got boolean := false;
  v_secs int := 0;
  v_now timestamptz;
BEGIN
  IF p_scope IS NULL OR char_length(p_scope) NOT BETWEEN 1 AND 100
     OR p_ok IS NULL
     OR p_threshold IS NULL OR p_threshold < 1
     OR p_base IS NULL OR p_base < 1
     OR p_cap IS NULL OR p_cap < p_base THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;

  IF p_ok THEN
    DELETE FROM public.pin_attempts WHERE scope = p_scope;
    RETURN 0;
  END IF;

  FOR i IN 1..3 LOOP
    INSERT INTO public.pin_attempts (scope) VALUES (p_scope)
    ON CONFLICT (scope) DO NOTHING;
    SELECT * INTO r
    FROM public.pin_attempts WHERE scope = p_scope FOR UPDATE;
    v_got := FOUND;
    EXIT WHEN v_got;
  END LOOP;
  IF NOT v_got THEN
    RAISE EXCEPTION 'pin_attempts row for % kept vanishing', p_scope;
  END IF;

  v_now := clock_timestamp();
  IF r.updated_at < v_now - INTERVAL '24 hours' THEN
    r.fail_count := 0;
  END IF;
  r.fail_count := r.fail_count + 1;
  r.locked_until := NULL;
  IF r.fail_count >= p_threshold THEN
    v_secs := LEAST(
      p_cap,
      p_base * power(2, LEAST(r.fail_count - p_threshold, 20))
    )::int;
    r.locked_until := v_now + make_interval(secs => v_secs);
  END IF;

  UPDATE public.pin_attempts
  SET fail_count = r.fail_count,
      locked_until = r.locked_until,
      updated_at = v_now
  WHERE scope = p_scope;
  RETURN v_secs;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pin_attempt_wait(text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION
  public.pin_attempt_record(text, boolean, int, int, int)
  FROM PUBLIC, anon, authenticated;

-- 3) staff: lock per staff member
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_staff_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_scope text := 'staff:' || p_staff_id::text;
  v_wait int;
  v_ok boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff WHERE id = p_staff_id) THEN
    RETURN false;
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    RETURN false;
  END IF;

  v_wait := pin_attempt_wait(v_scope);
  IF v_wait > 0 THEN
    RAISE EXCEPTION 'PIN_LOCKED'
      USING DETAIL = v_wait::text,
            HINT = 'retry after ' || v_wait || ' seconds';
  END IF;

  SELECT s.pin_hash IS NOT NULL
         AND s.pin_hash = crypt(p_pin, s.pin_hash)
         AND s.is_active IS TRUE
  INTO v_ok
  FROM staff s
  WHERE s.id = p_staff_id;
  v_ok := COALESCE(v_ok, false);

  PERFORM pin_attempt_record(v_scope, v_ok, 5, 60, 1800);
  RETURN v_ok;
END;
$$;

-- 4) employees: lock per shop (option A, temporary)
-- bcrypt runs once per employee row; matches are
-- returned as they are found, the result is recorded
-- after the loop.
CREATE OR REPLACE FUNCTION public.verify_employee_pin(p_shop_id uuid, p_pin text)
RETURNS TABLE (
  id        uuid,
  name      text,
  role      text,
  photo_url text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_scope text := 'shop:' || p_shop_id::text;
  v_wait int;
  v_n int := 0;
  r record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.shop_id = p_shop_id
  ) THEN
    RETURN;
  END IF;

  v_wait := pin_attempt_wait(v_scope);
  IF v_wait > 0 THEN
    RAISE EXCEPTION 'PIN_LOCKED'
      USING DETAIL = v_wait::text,
            HINT = 'retry after ' || v_wait || ' seconds';
  END IF;

  FOR r IN
    SELECT e.id, e.name, e.role, e.photo_url
    FROM   employees e
    WHERE  e.shop_id   = p_shop_id
      AND  e.is_active = true
      AND  e.pin_hash  = crypt(p_pin, e.pin_hash)
  LOOP
    id := r.id;
    name := r.name;
    role := r.role;
    photo_url := r.photo_url;
    v_n := v_n + 1;
    RETURN NEXT;
  END LOOP;

  PERFORM pin_attempt_record(v_scope, v_n > 0, 10, 30, 900);
  RETURN;
END;
$$;

-- 5) hash_employee_pin: signed-in users only
REVOKE EXECUTE ON FUNCTION public.hash_employee_pin(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hash_employee_pin(text)
  TO authenticated, service_role;

-- 6) assertions
-- REVOKE silently does nothing on grants made by another
-- grantor, so check the effective privileges instead.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(f, ', ') INTO bad
  FROM unnest(ARRAY[
    'public.verify_staff_pin(uuid, text)',
    'public.verify_employee_pin(uuid, text)'
  ]) AS f
  WHERE (SELECT provolatile FROM pg_proc
         WHERE oid = f::regprocedure) <> 'v';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'not VOLATILE: %', bad;
  END IF;

  SELECT string_agg(f, ', ') INTO bad
  FROM unnest(ARRAY[
    'public.verify_staff_pin(uuid, text)',
    'public.verify_employee_pin(uuid, text)'
  ]) AS f
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = f::regprocedure
      AND array_to_string(proconfig, ',') LIKE '%extensions%'
  );
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'search_path lacks extensions: %', bad;
  END IF;

  SELECT string_agg(r || ' ' || f, ', ') INTO bad
  FROM unnest(ARRAY[
    'public.pin_attempt_wait(text)',
    'public.pin_attempt_record(text, boolean, int, int, int)'
  ]) AS f,
  unnest(ARRAY['anon', 'authenticated']) AS r
  WHERE has_function_privilege(r, f, 'EXECUTE');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'helpers still executable: %', bad;
  END IF;

  SELECT string_agg(r || ' ' || pr, ', ') INTO bad
  FROM unnest(ARRAY['anon', 'authenticated']) AS r,
  unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE',
               'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS pr
  WHERE has_table_privilege(r, 'public.pin_attempts', pr);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'pin_attempts privileges still held: %', bad;
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.pin_attempts'::regclass) THEN
    RAISE EXCEPTION 'RLS is off on pin_attempts';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public'
               AND tablename = 'pin_attempts') THEN
    RAISE EXCEPTION 'pin_attempts has policies';
  END IF;

  IF has_function_privilege('anon', 'public.hash_employee_pin(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute hash_employee_pin';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.hash_employee_pin(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost hash_employee_pin';
  END IF;

  IF NOT has_function_privilege('anon', 'public.verify_staff_pin(uuid, text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.verify_employee_pin(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon lost EXECUTE on a verify function';
  END IF;
END
$$;

-- PostgREST picks read-only transactions for STABLE
-- functions from its schema cache; reload it.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Checks (run one at a time, after COMMIT)
--
-- expected: provolatile v for both, anon_can true
-- SELECT p.proname, p.provolatile, p.proconfig,
--   has_function_privilege('anon', p.oid, 'EXECUTE')
--     AS anon_can
-- FROM pg_proc p
-- WHERE p.oid IN (
--   'public.verify_staff_pin(uuid, text)'::regprocedure,
--   'public.verify_employee_pin(uuid, text)'::regprocedure
-- );
--
-- expected: anon_can false, auth_can true
-- SELECT
--   has_function_privilege('anon',
--     'public.hash_employee_pin(text)', 'EXECUTE')
--     AS anon_can,
--   has_function_privilege('authenticated',
--     'public.hash_employee_pin(text)', 'EXECUTE')
--     AS auth_can;
--
-- expected: rls true, anon_any false, auth_any false
-- SELECT c.relrowsecurity AS rls,
--   has_table_privilege('anon', 'public.pin_attempts',
--     'SELECT,INSERT,UPDATE,DELETE') AS anon_any,
--   has_table_privilege('authenticated',
--     'public.pin_attempts',
--     'SELECT,INSERT,UPDATE,DELETE') AS auth_any
-- FROM pg_class c
-- WHERE c.oid = 'public.pin_attempts'::regclass;
--
-- expected: 0 rows right after the run
-- SELECT scope, fail_count, locked_until
-- FROM public.pin_attempts;
--
-- Through the REST API (proves PostgREST allows the
-- write). Unknown uuid: returns false, writes nothing.
-- expected: HTTP 200, body false
-- curl -s -X POST
--   "$SUPABASE_URL/rest/v1/rpc/verify_staff_pin"
--   -H "apikey: $ANON_KEY"
--   -H "Authorization: Bearer $ANON_KEY"
--   -H "Content-Type: application/json"
--   -d '{"p_staff_id":"00000000-0000-0000-0000-000000000000",
--        "p_pin":"0000"}'
-- (one command; join the lines with spaces)
-- A wrong PIN for a real staff member must also give
-- 200 false (not "read-only transaction"): try it once
-- on the /staff kiosk, then clear the row:
-- DELETE FROM public.pin_attempts;
--
-- In the app: add or edit one employee PIN in
-- /shop/team/employees (hash_employee_pin as signed-in
-- user), then clock in with it on the POS PIN pad.
