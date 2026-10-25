-- ============================================================
--  Alan Cafe OS -- Migration 042: site_settings whitelist (functions only)
--
--  Run on production (run date not recorded). Verified live 2026-10-25
--  with a read-only catalog query: all 3 function bodies match this file,
--  SECURITY DEFINER + search_path = public, anon/authenticated EXECUTE kept.
--
--  Live DB (2026-10-06): get_site_settings() returns EVERY key to anon,
--  including telegram_bot_token (46 chars). update_site_setting() lets
--  anon write any key.
--
--  After this:
--  - get_site_settings() returns only the 53 keys the app reads.
--  - update_site_setting() rejects the 3 secret keys and any key not on
--    that list.
--  Table policies are NOT touched: the live anon policy on site_settings
--  ("anon: select public site_settings") already only exposes
--  key = 'hero_image_url'.
--
--  ORDER MATTERS:
--  1. Deploy the CafeClient Settings change first. The version online
--     before it calls update_site_setting for every key it loaded,
--     including the tokens, so the guard below would reject those writes.
--     The new version saves only whitelisted keys and reports failures.
--  2. Rotate the Telegram bot token / LINE tokens. Anyone could read
--     them through get_site_settings() until this migration runs.
--  3. Run this file.
--
--  Whitelist = CafeClient FullSettings keys minus the 3 secrets, plus
--  receipt_footer (written by components/shop/ReceiptSection.tsx).
--  hero_image_url is intentionally excluded: nothing reads or writes it
--  through these RPCs. The homepage reads it from the table, and /admin
--  writes it with the service role.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--  Safe to run multiple times.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.site_settings_public_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'shop_name', 'shop_name_th', 'shop_name_lo', 'shop_address', 'shop_phone', 'shop_email', 'shop_facebook',
    'shop_instagram', 'shop_line', 'open_time', 'close_time', 'open_days', 'currency_primary',
    'currency_secondary', 'vat_percent', 'service_charge_percent', 'receipt_auto_print', 'ticker_text',
    'queue_ticker_text', 'queue_display_mode', 'low_stock_alert_enabled', 'daily_report_enabled',
    'ai_analyst_enabled', 'alan_insights_enabled', 'payment_banks', 'qr_payment_number', 'qr_payment_name',
    'shop_lat', 'shop_lng', 'telegram_chat_id', 'telegram_enabled', 'telegram_notify_low_stock',
    'telegram_notify_daily_report', 'telegram_notify_large_order', 'telegram_large_order_threshold',
    'cost_cup_lid', 'cost_straw', 'cost_bag', 'cost_bag_pct', 'cost_other_pkg', 'cost_waste_pct',
    'cost_ice_bag_price', 'cost_ice_melt_pct', 'cost_ice_per_cup_g', 'overhead_rent', 'overhead_electric',
    'overhead_water', 'overhead_salary', 'overhead_internet', 'overhead_consumables_json',
    'overhead_other_json', 'target_cups_month', 'receipt_footer'
  ]::text[]
$$;

CREATE OR REPLACE FUNCTION public.get_site_settings()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM site_settings
  WHERE key = ANY (public.site_settings_public_keys());
$$;

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
  IF NOT (p_key = ANY (public.site_settings_public_keys())) THEN
    RAISE EXCEPTION 'unknown site setting "%"', p_key USING ERRCODE = '22023';
  END IF;
  INSERT INTO site_settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

COMMIT;

-- Checks (expected: no token key returned; secret write rejected)
SELECT jsonb_object_keys(public.get_site_settings()) AS returned_key ORDER BY 1;
SELECT public.get_site_settings() ? 'telegram_bot_token' AS token_still_exposed;  -- must be false
-- Expect an error "is a secret": (run separately; it raises on purpose)
-- SELECT public.update_site_setting('telegram_bot_token', 'x');
