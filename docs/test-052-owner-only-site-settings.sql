-- ============================================================
--  Test for migration 052 (owner-only update_site_setting)
--
--  CHANGES NOTHING. Everything runs in one transaction that always ends
--  in an error ("052 TEST RESULTS ...") so Postgres rolls it all back --
--  the 052 function, the test writes to site_settings, and the
--  temporary owner deactivation in T13. The error message IS the report:
--  every line should start with PASS or SKIP.
--  After reading the report, run `ROLLBACK;` on its own once: if the
--  editor keeps the connection open, the aborted transaction still holds
--  row locks (real owner's shop_users row, touched site_settings rows)
--  until it is closed. The trailing ROLLBACK below does not run after
--  the error when the whole script is sent as one batch.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor) as postgres.
--  The function body below is a copy of
--  supabase/migrations/052_owner_only_site_settings.sql -- keep in sync.
--
--  Callers are simulated the way PostgREST does it: SET ROLE anon /
--  authenticated plus request.jwt.claims (which auth.uid() reads).
-- ============================================================

BEGIN;

-- ---- 052 body (copy) ----
CREATE OR REPLACE FUNCTION public.update_site_setting(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid
      AND user_id = auth.uid()
      AND role = 'owner'
      AND active IS TRUE
  ) THEN
    RAISE EXCEPTION 'only the shop owner can change site settings' USING ERRCODE = '42501';
  END IF;
  IF p_key IN ('telegram_bot_token', 'low_stock_alert_line_token', 'daily_report_line_token') THEN
    RAISE EXCEPTION 'site setting "%" is a secret and cannot be changed from the app', p_key
      USING ERRCODE = '42501';
  END IF;
  IF p_key IN ('payment_banks', 'qr_payment_number', 'qr_payment_name') THEN
    RAISE EXCEPTION 'site setting "%" can only be changed by the owner (use update_payment_setting)', p_key
      USING ERRCODE = '42501';
  END IF;
  IF NOT (p_key = ANY (public.site_settings_public_keys())) THEN
    RAISE EXCEPTION 'unknown site setting "%"', p_key USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.site_settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_site_setting(TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_site_setting(TEXT, TEXT) TO authenticated;
-- ---- end of 052 body ----

CREATE TEMP TABLE t052 (n INT, name TEXT, result TEXT);

-- Calls fn(key, value) as p_role with auth.uid() = p_sub; returns 'OK' or 'ERR <sqlstate> <message>'
CREATE FUNCTION pg_temp.try_call(p_fn TEXT, p_role TEXT, p_sub UUID, p_key TEXT, p_value TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      CASE WHEN p_sub IS NULL THEN json_build_object('role', p_role)
           ELSE json_build_object('sub', p_sub, 'role', p_role) END::text, true);
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub::text, ''), true);
    PERFORM set_config('role', p_role, true);
    EXECUTE format('SELECT public.%I($1, $2)', p_fn) USING p_key, p_value;
    RESET ROLE;
    RETURN 'OK';
  EXCEPTION WHEN OTHERS THEN
    RETURN 'ERR ' || SQLSTATE || ' ' || SQLERRM;
  END;
END;
$$;

DO $$
DECLARE
  real_shop  CONSTANT UUID := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  owner_id   UUID;
  other_id   UUID;
  member_id  UUID;
  marker     TEXT := 'test052-' || md5(random()::text);
  r          TEXT;
  stored     TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM public.shop_users
  WHERE shop_id = real_shop AND role = 'owner' AND active IS TRUE AND user_id IS NOT NULL LIMIT 1;

  -- An owner of some other shop who is not also an active owner of the real shop
  SELECT su.user_id INTO other_id FROM public.shop_users su
  WHERE su.shop_id <> real_shop AND su.role = 'owner' AND su.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.shop_users x WHERE x.shop_id = real_shop AND x.user_id = su.user_id
                    AND x.role = 'owner' AND x.active IS TRUE)
  LIMIT 1;

  -- A non-owner member of the real shop (manager / cashier / viewer)
  SELECT su.user_id INTO member_id FROM public.shop_users su
  WHERE su.shop_id = real_shop AND su.role <> 'owner' AND su.active IS TRUE AND su.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.shop_users x WHERE x.shop_id = real_shop AND x.user_id = su.user_id
                    AND x.role = 'owner' AND x.active IS TRUE)
  LIMIT 1;

  -- T1 grants
  INSERT INTO t052 SELECT 1, 'grants: site anon=f auth=t, payment anon=f auth=t',
    CASE WHEN NOT has_function_privilege('anon', 'public.update_site_setting(text,text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.update_site_setting(text,text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.update_payment_setting(text,text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.update_payment_setting(text,text)', 'EXECUTE')
         THEN 'PASS' ELSE 'FAIL' END;

  -- T2 anon cannot call it at all
  r := pg_temp.try_call('update_site_setting', 'anon', NULL, 'shop_name', marker);
  INSERT INTO t052 VALUES (2, 'anon -> permission denied',
    CASE WHEN r LIKE 'ERR 42501 permission denied%' THEN 'PASS' ELSE 'FAIL: ' || r END);

  -- T3 signed-in user with no shop_users row
  r := pg_temp.try_call('update_site_setting', 'authenticated', gen_random_uuid(), 'shop_name', marker);
  INSERT INTO t052 VALUES (3, 'authenticated stranger -> owner error',
    CASE WHEN r LIKE 'ERR 42501 only the shop owner%' THEN 'PASS' ELSE 'FAIL: ' || r END);

  -- T4 authenticated role but no sub claim (auth.uid() is NULL)
  r := pg_temp.try_call('update_site_setting', 'authenticated', NULL, 'shop_name', marker);
  INSERT INTO t052 VALUES (4, 'authenticated without uid -> owner error',
    CASE WHEN r LIKE 'ERR 42501 only the shop owner%' THEN 'PASS' ELSE 'FAIL: ' || r END);

  -- T5 owner of a different shop
  IF other_id IS NULL THEN
    INSERT INTO t052 VALUES (5, 'owner of another shop -> owner error', 'SKIP (no such user)');
  ELSE
    r := pg_temp.try_call('update_site_setting', 'authenticated', other_id, 'shop_name', marker);
    INSERT INTO t052 VALUES (5, 'owner of another shop -> owner error',
      CASE WHEN r LIKE 'ERR 42501 only the shop owner%' THEN 'PASS' ELSE 'FAIL: ' || r END);
  END IF;

  -- T6 non-owner member of the real shop
  IF member_id IS NULL THEN
    INSERT INTO t052 VALUES (6, 'manager/cashier of real shop -> owner error', 'SKIP (no such user)');
  ELSE
    r := pg_temp.try_call('update_site_setting', 'authenticated', member_id, 'shop_name', marker);
    INSERT INTO t052 VALUES (6, 'manager/cashier of real shop -> owner error',
      CASE WHEN r LIKE 'ERR 42501 only the shop owner%' THEN 'PASS' ELSE 'FAIL: ' || r END);
  END IF;

  IF owner_id IS NULL THEN
    INSERT INTO t052 VALUES (7, 'real owner tests', 'FAIL: no active owner row with user_id for the real shop');
  ELSE
    -- T7 owner writes a normal key, value is stored
    r := pg_temp.try_call('update_site_setting', 'authenticated', owner_id, 'shop_name', marker);
    SELECT value INTO stored FROM public.site_settings WHERE key = 'shop_name';
    INSERT INTO t052 VALUES (7, 'owner writes shop_name',
      CASE WHEN r = 'OK' AND stored = marker THEN 'PASS' ELSE 'FAIL: ' || r || ' stored=' || COALESCE(stored, 'NULL') END);

    -- T8 owner flips the AI toggle key
    r := pg_temp.try_call('update_site_setting', 'authenticated', owner_id, 'alan_insights_enabled', 'false');
    SELECT value INTO stored FROM public.site_settings WHERE key = 'alan_insights_enabled';
    INSERT INTO t052 VALUES (8, 'owner writes alan_insights_enabled',
      CASE WHEN r = 'OK' AND stored = 'false' THEN 'PASS' ELSE 'FAIL: ' || r || ' stored=' || COALESCE(stored, 'NULL') END);

    -- T9 payment key still refused here
    r := pg_temp.try_call('update_site_setting', 'authenticated', owner_id, 'qr_payment_number', marker);
    INSERT INTO t052 VALUES (9, 'owner, payment key via update_site_setting -> refused',
      CASE WHEN r LIKE 'ERR 42501 %update_payment_setting%' THEN 'PASS' ELSE 'FAIL: ' || r END);

    -- T10 secret key refused
    r := pg_temp.try_call('update_site_setting', 'authenticated', owner_id, 'telegram_bot_token', marker);
    INSERT INTO t052 VALUES (10, 'owner, secret key -> refused',
      CASE WHEN r LIKE 'ERR 42501 %is a secret%' THEN 'PASS' ELSE 'FAIL: ' || r END);

    -- T11 unknown key refused (hero_image_url is written only by /admin with the service role)
    r := pg_temp.try_call('update_site_setting', 'authenticated', owner_id, 'hero_image_url', marker);
    INSERT INTO t052 VALUES (11, 'owner, unknown key -> refused',
      CASE WHEN r LIKE 'ERR 22023 unknown site setting%' THEN 'PASS' ELSE 'FAIL: ' || r END);

    -- T12 051 path still works for the owner
    r := pg_temp.try_call('update_payment_setting', 'authenticated', owner_id, 'qr_payment_name', marker);
    SELECT value INTO stored FROM public.site_settings WHERE key = 'qr_payment_name';
    INSERT INTO t052 VALUES (12, 'owner writes qr_payment_name via update_payment_setting',
      CASE WHEN r = 'OK' AND stored = marker THEN 'PASS' ELSE 'FAIL: ' || r || ' stored=' || COALESCE(stored, 'NULL') END);

    -- T13 deactivated owner is refused (rolled back with everything else)
    UPDATE public.shop_users SET active = FALSE WHERE shop_id = real_shop AND user_id = owner_id;
    r := pg_temp.try_call('update_site_setting', 'authenticated', owner_id, 'shop_name', marker);
    INSERT INTO t052 VALUES (13, 'deactivated owner -> owner error',
      CASE WHEN r LIKE 'ERR 42501 only the shop owner%' THEN 'PASS' ELSE 'FAIL: ' || r END);
  END IF;
END;
$$;

-- Report and abort: this error rolls back the whole transaction on purpose.
DO $$
DECLARE report TEXT;
BEGIN
  SELECT string_agg(format('T%s %s: %s', n, result, name), E'\n' ORDER BY n) INTO report FROM t052;
  RAISE EXCEPTION E'052 TEST RESULTS (everything rolled back, nothing changed):\n%', report;
END;
$$;

ROLLBACK;
