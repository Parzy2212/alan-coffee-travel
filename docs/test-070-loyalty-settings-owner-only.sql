-- ============================================================
--  Test for migration 070 (VIP % from loyalty settings, owner-only changes)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("070 TEST RESULTS ..."), so everything rolls back, including the test
--  employee, customers, bills and the settings change. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres, copy the error text back.
--  Section "body of 070" is a copy of supabase/migrations/070_loyalty_settings_owner_only.sql.
-- ============================================================
DO $test$
DECLARE
  c_shop     constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_owner    uuid;
  c_cash_pin constant text := '7391';
  report text := '';
  r text;
  v_cashier uuid; v_recipe uuid; v_price numeric; v_cart jsonb; v_sub numeric;
  v_gold uuid; v_cap numeric; v_res jsonb; v_n int; v_log record; v_body text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pos_discount_approve') THEN
    RAISE EXCEPTION '070 TEST: run 061 first';
  END IF;
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active ORDER BY id LIMIT 1;
  IF c_owner IS NULL THEN RAISE EXCEPTION '070 TEST: the shop has no active owner'; END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE shop_id = c_shop AND is_active
             AND pin_hash = extensions.crypt(c_cash_pin, pin_hash)) THEN
    RAISE EXCEPTION '070 TEST: a real employee uses PIN % -- change it at the top and run again', c_cash_pin;
  END IF;
  SELECT id, price_lak INTO v_recipe, v_price FROM public.recipes
   WHERE COALESCE(is_active, true) AND NOT COALESCE(is_archived, false) AND price_lak > 0
   ORDER BY created_at, id LIMIT 1;
  IF v_recipe IS NULL THEN RAISE EXCEPTION '070 TEST: no active menu item to sell'; END IF;
  ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;

  -- ---- body of 070 ----
  v_body := $body$
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
  $body$;
  EXECUTE v_body;

  -- ---- tests ----
  -- T1 the app's roles can read the settings but not write them, and no policy besides read is left
  report := report || CASE WHEN has_table_privilege('anon', 'public.loyalty_settings', 'SELECT')
      AND NOT has_table_privilege('anon', 'public.loyalty_settings', 'UPDATE')
      AND NOT has_table_privilege('anon', 'public.loyalty_settings', 'INSERT')
      AND NOT has_table_privilege('authenticated', 'public.loyalty_settings', 'UPDATE')
      AND NOT has_table_privilege('authenticated', 'public.loyalty_settings', 'DELETE')
      AND (SELECT count(*) FROM pg_policies WHERE tablename = 'loyalty_settings') = 1
      THEN E'\nPASS T1 loyalty_settings read-only for anon / authenticated' ELSE E'\nFAIL T1 grants or policies' END;

  -- T2 anon cannot call the update function; the change log is closed to the app
  report := report || CASE WHEN NOT has_function_privilege('anon', 'public.update_loyalty_settings(uuid, jsonb)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.update_loyalty_settings(uuid, jsonb)', 'EXECUTE')
      AND NOT has_table_privilege('authenticated', 'public.loyalty_settings_changes', 'SELECT')
      AND NOT has_function_privilege('anon', 'public.vip_discount_percent(uuid, text)', 'EXECUTE')
      THEN E'\nPASS T2 function grants' ELSE E'\nFAIL T2 function grants' END;

  -- T3 a signed-in user who is not the owner is refused
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM public.update_loyalty_settings(c_shop, '{"gold_discount_percent": 50}');
    report := report || E'\nFAIL T3 a non-owner changed the settings';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLSTATE = '42501' THEN E'\nPASS T3 non-owner refused' ELSE E'\nFAIL T3 ' || SQLERRM END;
  END;

  -- the owner from here on
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_owner, 'role', 'authenticated', 'email', 'owner@test070')::text, true);
  PERFORM set_config('request.jwt.claim.sub', c_owner::text, true);

  -- T4 bad values are refused (each one separately)
  v_n := 0;
  FOREACH r IN ARRAY ARRAY['{"gold_discount_percent": 101}', '{"gold_discount_percent": -1}',
      '{"gold_discount_percent": 7.5}', '{"gold_discount_percent": null}', '{"gold_discount_percent": "abc"}',
      '{"vip_gold_threshold": 100}', '{"points_per_lak": 2}', '{"enabled": "yes"}', '{"shop_name": "x"}', '[1]'] LOOP
    BEGIN
      PERFORM public.update_loyalty_settings(c_shop, r::jsonb);
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = '22023' THEN v_n := v_n + 1; END IF;
    END;
  END LOOP;
  report := report || CASE WHEN v_n = 10 THEN E'\nPASS T4 10 kinds of bad values refused' ELSE E'\nFAIL T4 only ' || v_n || ' of 10 refused' END;

  -- T5 the owner changes Gold to 8%: saved, other values kept, logged with who and before/after
  v_res := public.update_loyalty_settings(c_shop, '{"gold_discount_percent": 8}');
  SELECT * INTO v_log FROM public.loyalty_settings_changes WHERE shop_id = c_shop ORDER BY id DESC LIMIT 1;
  report := report || CASE WHEN (SELECT gold_discount_percent FROM public.loyalty_settings WHERE shop_id = c_shop) = 8
      AND (v_res->>'gold_discount_percent')::int = 8
      AND (v_res->>'platinum_discount_percent')::int = (v_log.old_values->>'platinum_discount_percent')::int
      AND v_log.changed_by = c_owner AND v_log.changed_by_email = 'owner@test070'
      AND (v_log.new_values->>'gold_discount_percent')::int = 8
      THEN E'\nPASS T5 owner change saved and logged (was ' || COALESCE(v_log.old_values->>'gold_discount_percent', 'no row') || ')'
      ELSE E'\nFAIL T5 ' || v_res::text END;

  -- T6 the cap helper reads the saved %; a shop with no settings row gets the old defaults
  report := report || CASE WHEN public.vip_discount_percent(c_shop, 'gold') = 8
      AND public.vip_discount_percent(gen_random_uuid(), 'gold') = 5
      AND public.vip_discount_percent(gen_random_uuid(), 'platinum') = 10
      AND public.vip_discount_percent(c_shop, 'regular') = 0
      THEN E'\nPASS T6 vip_discount_percent' ELSE E'\nFAIL T6 vip_discount_percent' END;

  -- T7 checkout_order now uses the helper, nothing else in it changed size unexpectedly
  report := report || CASE WHEN position('vip_discount_percent(p_shop_id, c.vip_tier)' IN pg_get_functiondef('public.checkout_order'::regproc)) > 0
      AND position($o$WHEN 'platinum' THEN 10 WHEN 'gold' THEN 5$o$ IN pg_get_functiondef('public.checkout_order'::regproc)) = 0
      AND (SELECT prosecdef FROM pg_proc WHERE proname = 'checkout_order')
      THEN E'\nPASS T7 checkout_order swapped, still SECURITY DEFINER' ELSE E'\nFAIL T7 checkout_order definition' END;

  -- T8 a real bill: a Gold customer gets 15% + 8% with no PIN, one LAK more needs the PIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST070 cashier', 'cashier', extensions.crypt(c_cash_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_cashier;
  INSERT INTO public.customers (name, vip_tier) VALUES ('TEST070 gold', 'gold') RETURNING id INTO v_gold;
  v_cart := jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 7));
  v_sub := 7 * v_price;
  v_cap := v_sub - GREATEST(floor((v_sub - round(v_sub * 23 / 100.0)) / 1000) * 1000, 0);
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, v_gold, 'cash', v_sub, v_cap, 'T8', NULL, NULL, NULL, false, v_sub - v_cap);
    report := report || CASE WHEN (v_res->>'discount_lak')::numeric = v_cap THEN E'\nPASS T8a Gold 23% accepted without PIN' ELSE E'\nFAIL T8a ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T8a refused: ' || SQLERRM;
  END;
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, v_gold, 'cash', v_sub, v_cap + 1, 'T8', NULL, NULL, NULL, false, v_sub - v_cap - 1);
    report := report || E'\nFAIL T8b above 23% went through';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE 'DISCOUNT_NEEDS_PIN%' THEN E'\nPASS T8b above 23% needs the PIN' ELSE E'\nFAIL T8b ' || SQLERRM END;
  END;

  -- T9 running the migration a second time stops at the swap without breaking anything
  BEGIN
    EXECUTE v_body;
    report := report || E'
FAIL T9 second run did not stop';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE '070: checkout_order does not look%' THEN E'
PASS T9 second run stops safely' ELSE E'
FAIL T9 ' || SQLERRM END;
  END;

  RAISE EXCEPTION '070 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
