-- ============================================================
--  Alan Coffee & Travel -- Migration 044: /admin login rate limit
--
--  /api/admin/login had no attempt limit (only a fixed 400 ms delay).
--  This adds a per-IP failure counter that only the login route can
--  touch (via SUPABASE_SERVICE_ROLE_KEY):
--    - 5 failures from one IP  -> locked 1 min, then 2, 4, 8 ... max 60
--    - while locked, every attempt is refused, even the right password
--    - a successful login deletes that IP's row
--    - the count starts again from 1 only after 24 h with no failure and
--      no lock (so after the 60 min cap each further failure locks 60 min)
--  No global row: a guesser must not be able to lock the owner out.
--
--  Unlock by hand (SQL editor):  DELETE FROM public.admin_login_attempts;
--
--  Rollback: scratchpad 044_admin_login_rate_limit_rollback.sql
--  (DROP FUNCTION + DROP TABLE; nothing else depends on them).
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  scope        TEXT        PRIMARY KEY CHECK (char_length(scope) BETWEEN 1 AND 100),
  fail_count   INT         NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on with no policies: anon/authenticated see and change nothing.
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_login_attempts FROM PUBLIC, anon, authenticated;

-- p_scope = client IP (IPv6 reduced to its /64), p_ok = password was correct.
-- Returns allowed = true only when p_ok and the scope is not locked.
-- retry_after = seconds until the lock ends (0 = not locked).
CREATE OR REPLACE FUNCTION public.admin_login_attempt(p_scope TEXT, p_ok BOOLEAN)
RETURNS TABLE (allowed BOOLEAN, retry_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.admin_login_attempts%ROWTYPE;
BEGIN
  IF p_scope IS NULL OR char_length(p_scope) NOT BETWEEN 1 AND 100 OR p_ok IS NULL THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;

  DELETE FROM public.admin_login_attempts
  WHERE GREATEST(updated_at, COALESCE(locked_until, updated_at)) < now() - INTERVAL '1 day';

  INSERT INTO public.admin_login_attempts (scope) VALUES (p_scope)
  ON CONFLICT (scope) DO NOTHING;

  SELECT * INTO r FROM public.admin_login_attempts WHERE scope = p_scope FOR UPDATE;
  IF NOT FOUND THEN
    -- a concurrent successful login deleted the row while we waited
    INSERT INTO public.admin_login_attempts (scope) VALUES (p_scope)
    ON CONFLICT (scope) DO NOTHING;
    SELECT * INTO r FROM public.admin_login_attempts WHERE scope = p_scope FOR UPDATE;
  END IF;

  IF r.locked_until IS NOT NULL AND r.locked_until > now() THEN
    RETURN QUERY SELECT false, GREATEST(1, CEIL(EXTRACT(EPOCH FROM r.locked_until - now())))::INT;
    RETURN;
  END IF;

  IF p_ok THEN
    DELETE FROM public.admin_login_attempts WHERE scope = p_scope;
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  IF GREATEST(r.updated_at, COALESCE(r.locked_until, r.updated_at)) < now() - INTERVAL '1 day' THEN
    r.fail_count := 0;
  END IF;
  r.fail_count := r.fail_count + 1;
  r.locked_until := NULL;
  IF r.fail_count >= 5 THEN
    r.locked_until := now() + make_interval(mins => LEAST(60, power(2, LEAST(r.fail_count - 5, 6))::INT));
  END IF;

  UPDATE public.admin_login_attempts
  SET fail_count = r.fail_count, locked_until = r.locked_until, updated_at = now()
  WHERE scope = p_scope;

  RETURN QUERY SELECT false,
    CASE WHEN r.locked_until IS NULL THEN 0
         ELSE CEIL(EXTRACT(EPOCH FROM r.locked_until - now()))::INT END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_login_attempt(TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_login_attempt(TEXT, BOOLEAN)
  TO service_role;

COMMIT;

-- Checks -- expected: anon_can = false, authenticated_can = false, service_role_can = true
SELECT
  has_function_privilege('anon',          'public.admin_login_attempt(text, boolean)', 'EXECUTE') AS anon_can,
  has_function_privilege('authenticated', 'public.admin_login_attempt(text, boolean)', 'EXECUTE') AS authenticated_can,
  has_function_privilege('service_role',  'public.admin_login_attempt(text, boolean)', 'EXECUTE') AS service_role_can;

-- expected: rls = true, anon/authenticated = false
SELECT
  c.relrowsecurity AS rls,
  has_table_privilege('anon',          'public.admin_login_attempts', 'SELECT,INSERT,UPDATE,DELETE') AS anon_any,
  has_table_privilege('authenticated', 'public.admin_login_attempts', 'SELECT,INSERT,UPDATE,DELETE') AS authenticated_any
FROM pg_class c
WHERE c.oid = 'public.admin_login_attempts'::regclass;

-- expected: 0 rows
SELECT policyname FROM pg_policies WHERE tablename = 'admin_login_attempts';
