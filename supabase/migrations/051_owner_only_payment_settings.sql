-- ============================================================
--  Alan Cafe OS -- Migration 051: owner-only payment settings
--
--  Before this (2026-10-25) the owner revoked EXECUTE on
--  update_site_setting from anon and authenticated as an emergency step:
--  anyone with the public anon key could change the payment account
--  shown on the POS QR / transfer screens. This file records that revoke
--  and adds an owner-only path for the 3 payment keys.
--  The emergency revoke was FROM PUBLIC, anon, authenticated.
--
--  Tested 2026-10-25 in BEGIN/ROLLBACK: T1-T9 pass (T3 skipped, no manager)
--  Applied live 2026-10-25, verified
--
--  After this:
--  - update_payment_setting(key, value): authenticated only; accepts only
--    payment_banks / qr_payment_number / qr_payment_name, and only when
--    auth.uid() is an active owner of the real shop.
--  - update_site_setting() rejects those 3 keys. They stay in
--    site_settings_public_keys(), so get_site_settings() and the POS
--    still read them.
--  - update_site_setting stays revoked from anon/authenticated (see the
--    commented block at the end).
--
--  site_settings is global (no shop_id), so the check is pinned to the
--  one real shop: anyone can sign up and onboard a shop of their own,
--  so "owner of any shop" is not enough.
--
--  Rollback: DROP FUNCTION public.update_payment_setting(TEXT, TEXT);
--  then re-run the update_site_setting definition from 042.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_payment_setting(p_key TEXT, p_value TEXT)
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
    RAISE EXCEPTION 'only the shop owner can change payment settings' USING ERRCODE = '42501';
  END IF;
  IF p_key NOT IN ('payment_banks', 'qr_payment_number', 'qr_payment_name') THEN
    RAISE EXCEPTION 'update_payment_setting does not accept "%"', p_key USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.site_settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_payment_setting(TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_payment_setting(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_site_setting(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  INSERT INTO site_settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

-- Records the emergency revoke so a DB rebuilt from migrations matches live
REVOKE EXECUTE ON FUNCTION public.update_site_setting(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Owner decision -- uncomment ONE line only if update_site_setting should open again:
-- GRANT EXECUTE ON FUNCTION public.update_site_setting(TEXT, TEXT) TO authenticated;

COMMIT;

-- Checks: update_payment_setting anon=false authenticated=true;
--         update_site_setting anon=false authenticated=false (unless the GRANT above was used)
SELECT p.oid::regprocedure::text AS signature,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can,
       p.prosecdef AS security_definer,
       array_to_string(p.proconfig, ',') AS config
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('update_payment_setting', 'update_site_setting', 'get_site_settings')
ORDER BY 1;
