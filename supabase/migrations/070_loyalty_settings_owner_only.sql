-- 070: the VIP discount % comes from the shop's loyalty settings; only the owner changes them
--
-- Before: the settings page (/shop/settings/loyalty) saved loyalty_settings, but the POS
-- (lib/loyalty.ts defaults) and the discount cap in checkout_order (061) used fixed
-- Gold 5 / Platinum 10, so a changed % did nothing. The table had an anon "do anything"
-- policy, so anyone with the public key could rewrite the settings.
-- After (owner decision 2026-11-18):
--   * checkout_order's cap = 15% + the % saved for the customer's tier (no row: 0 / 5 / 10)
--   * loyalty_settings is read-only for the app; changes go through update_loyalty_settings,
--     which only an active owner of that shop may call, and every change is logged
--     (who, when, before, after) in loyalty_settings_changes.
-- The points trigger (055) already reads points_per_lak and the tier thresholds from the table.
-- Run after 069. Test first: docs/test-070-loyalty-settings-owner-only.sql

-- 1) change log -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_settings_changes (
  id               bigserial PRIMARY KEY,
  shop_id          uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  changed_by       uuid NOT NULL,
  changed_by_email text,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  old_values       jsonb,
  new_values       jsonb NOT NULL
);
ALTER TABLE public.loyalty_settings_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loyalty_settings_changes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loyalty_settings_changes TO service_role;

-- 2) the table: everyone may read (the POS needs the %), nobody writes directly ----------
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
DO $pol$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'loyalty_settings' LOOP
    EXECUTE format('DROP POLICY %I ON public.loyalty_settings', p.policyname);
  END LOOP;
END
$pol$;
CREATE POLICY loyalty_settings_read ON public.loyalty_settings FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.loyalty_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.loyalty_settings TO anon, authenticated;

-- 3) the only way to change them -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_loyalty_settings(p_shop_id uuid, p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_keys  text[] := ARRAY['enabled', 'points_per_lak', 'vip_silver_threshold', 'vip_gold_threshold',
                          'vip_platinum_threshold', 'silver_discount_percent', 'gold_discount_percent',
                          'platinum_discount_percent', 'birthday_discount_percent'];
  v_bad   text;
  v_old   jsonb;
  v_new   jsonb;
  v_pct   text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE shop_id = p_shop_id AND user_id = auth.uid() AND role = 'owner' AND active
  ) THEN
    RAISE EXCEPTION 'only the shop owner can change loyalty settings' USING ERRCODE = '42501';
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'settings must be an object' USING ERRCODE = '22023';
  END IF;
  SELECT k INTO v_bad FROM jsonb_object_keys(p_settings) k WHERE k <> ALL (v_keys) LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'unknown loyalty setting: %', v_bad USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(l) - 'shop_id' - 'created_at' INTO v_old
  FROM public.loyalty_settings l WHERE l.shop_id = p_shop_id FOR UPDATE;
  -- missing keys keep the saved value, or the defaults the app shows when nothing is saved
  v_new := COALESCE(v_old, jsonb_build_object(
             'enabled', true, 'points_per_lak', 0.0001, 'vip_silver_threshold', 500,
             'vip_gold_threshold', 2000, 'vip_platinum_threshold', 5000, 'silver_discount_percent', 0,
             'gold_discount_percent', 5, 'platinum_discount_percent', 10, 'birthday_discount_percent', 20))
           || p_settings;

  BEGIN
    IF EXISTS (SELECT 1 FROM unnest(v_keys) k WHERE v_new->>k IS NULL) THEN RAISE EXCEPTION 'x'; END IF;
    IF jsonb_typeof(v_new->'enabled') <> 'boolean' THEN RAISE EXCEPTION 'x'; END IF;
    IF (v_new->>'points_per_lak')::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'x'; END IF;
    IF NOT ((v_new->>'vip_silver_threshold')::int > 0
        AND (v_new->>'vip_silver_threshold')::int < (v_new->>'vip_gold_threshold')::int
        AND (v_new->>'vip_gold_threshold')::int < (v_new->>'vip_platinum_threshold')::int) THEN
      RAISE EXCEPTION 'x';
    END IF;
    FOREACH v_pct IN ARRAY ARRAY['silver_discount_percent', 'gold_discount_percent',
                                 'platinum_discount_percent', 'birthday_discount_percent'] LOOP
      IF (v_new->>v_pct)::int NOT BETWEEN 0 AND 100 OR (v_new->>v_pct)::numeric <> (v_new->>v_pct)::int THEN
        RAISE EXCEPTION 'x';
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'INVALID_LOYALTY_SETTINGS: percents 0-100 whole numbers, thresholds silver < gold < platinum, points per LAK 0-1'
      USING ERRCODE = '22023';
  END;

  INSERT INTO public.loyalty_settings AS l (shop_id, enabled, points_per_lak, vip_silver_threshold,
    vip_gold_threshold, vip_platinum_threshold, silver_discount_percent, gold_discount_percent,
    platinum_discount_percent, birthday_discount_percent)
  VALUES (p_shop_id, (v_new->>'enabled')::boolean, (v_new->>'points_per_lak')::numeric,
    (v_new->>'vip_silver_threshold')::int, (v_new->>'vip_gold_threshold')::int,
    (v_new->>'vip_platinum_threshold')::int, (v_new->>'silver_discount_percent')::int,
    (v_new->>'gold_discount_percent')::int, (v_new->>'platinum_discount_percent')::int,
    (v_new->>'birthday_discount_percent')::int)
  ON CONFLICT (shop_id) DO UPDATE SET
    enabled = EXCLUDED.enabled, points_per_lak = EXCLUDED.points_per_lak,
    vip_silver_threshold = EXCLUDED.vip_silver_threshold, vip_gold_threshold = EXCLUDED.vip_gold_threshold,
    vip_platinum_threshold = EXCLUDED.vip_platinum_threshold,
    silver_discount_percent = EXCLUDED.silver_discount_percent, gold_discount_percent = EXCLUDED.gold_discount_percent,
    platinum_discount_percent = EXCLUDED.platinum_discount_percent,
    birthday_discount_percent = EXCLUDED.birthday_discount_percent;

  SELECT to_jsonb(l) - 'shop_id' - 'created_at' INTO v_new FROM public.loyalty_settings l WHERE l.shop_id = p_shop_id;
  INSERT INTO public.loyalty_settings_changes (shop_id, changed_by, changed_by_email, old_values, new_values)
  VALUES (p_shop_id, auth.uid(), auth.jwt()->>'email', v_old, v_new);
  RETURN v_new;
END
$fn$;
REVOKE ALL ON FUNCTION public.update_loyalty_settings(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_loyalty_settings(uuid, jsonb) TO authenticated, service_role;

-- 4) the cap reads the saved % -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vip_discount_percent(p_shop_id uuid, p_tier text)
RETURNS int LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT COALESCE(
    (SELECT CASE p_tier WHEN 'platinum' THEN l.platinum_discount_percent WHEN 'gold' THEN l.gold_discount_percent
                        WHEN 'silver' THEN l.silver_discount_percent END
     FROM public.loyalty_settings l WHERE l.shop_id = p_shop_id),
    CASE p_tier WHEN 'platinum' THEN 10 WHEN 'gold' THEN 5 ELSE 0 END)
$fn$;
REVOKE ALL ON FUNCTION public.vip_discount_percent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vip_discount_percent(uuid, text) TO service_role;

-- checkout_order is edited in place on the live definition (repo copies of it have drifted
-- before): exactly one known piece is swapped, or the migration stops without changing anything.
DO $swap$
DECLARE
  v_fn  regprocedure;
  v_def text;
  v_old text := $o$CASE c.vip_tier WHEN 'platinum' THEN 10 WHEN 'gold' THEN 5 ELSE 0 END$o$;
  v_new text := $n$public.vip_discount_percent(p_shop_id, c.vip_tier)$n$;
  v_oldc text := $o$-- cap = 15% + the customer's VIP % (lib/loyalty.ts defaults), then the POS rounds the amount$o$;
  v_newc text := $n$-- cap = 15% + the customer's VIP % (loyalty_settings, 070), then the POS rounds the amount$n$;
BEGIN
  SELECT p.oid::regprocedure INTO STRICT v_fn FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'checkout_order';
  v_def := pg_get_functiondef(v_fn);
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1
     OR (length(v_def) - length(replace(v_def, v_oldc, ''))) / length(v_oldc) <> 1 THEN
    RAISE EXCEPTION '070: checkout_order does not look like the 061 version, nothing changed';
  END IF;
  EXECUTE replace(replace(v_def, v_old, v_new), v_oldc, v_newc);
END
$swap$;
