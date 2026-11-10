-- ============================================================
--  Alan Cafe OS -- Migration 052: owner-only update_site_setting
--
--  RAN on production 2026-11-10 via Supabase SQL Editor.
--  Tested first on production with docs/test-052-owner-only-site-settings.sql
--  (BEGIN ... ROLLBACK, changes nothing): T1-T5 PASS, T6 SKIP (no such
--  user: no active non-owner member of the real shop), T7-T13 PASS.
--  SQL post-run check passed: update_site_setting and
--  update_payment_setting both anon=false, authenticated=true,
--  SECURITY DEFINER, search_path=public, pg_temp.
--  App not checked yet (client code not deployed at the time of the run).
--
--  Before this: update_site_setting has been revoked from anon and
--  authenticated since 2026-10-25 (recorded in 051), so /cafe Settings,
--  the /cafe AI toggle and /shop/settings/receipt cannot save any
--  non-payment key.
--
--  After this:
--  - update_site_setting(key, value) works only when auth.uid() is an
--    active owner of the real shop -- the same check as
--    update_payment_setting in 051. Key rules are unchanged from 051:
--    secrets rejected, payment keys rejected (use update_payment_setting),
--    unknown keys rejected.
--  - EXECUTE: authenticated only (anon and PUBLIC stay revoked).
--
--  site_settings is global (no shop_id), so the check is pinned to the
--  one real shop: anyone can sign up and onboard a shop of their own,
--  so "owner of any shop" is not enough. Managers cannot save settings
--  (owner decision 2026-10-27).
--
--  The client side (CafeClient + ReceiptSection call this with the
--  signed-in session, authClient) must be deployed for this to help:
--  the old code calls it as anon, which stays revoked.
--
--  Rollback: re-run the update_site_setting definition and the REVOKE
--  from 051 (owner check removed, EXECUTE revoked from authenticated).
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

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

COMMIT;

-- Checks: update_site_setting and update_payment_setting both anon=false authenticated=true
SELECT p.oid::regprocedure::text AS signature,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can,
       p.prosecdef AS security_definer,
       array_to_string(p.proconfig, ',') AS config
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('update_payment_setting', 'update_site_setting')
ORDER BY 1;
