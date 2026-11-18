-- ============================================================
--  Test for migration 072 (hot/iced variants, stock + cost calculator, checkout, void)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("072 TEST RESULTS ..."), so everything rolls back, including the test
--  ingredients, menu items, employees and bills. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres, copy the error text back.
--  Section "body of 072" is a copy of supabase/migrations/072_set2_variants_stock_usage.sql
--  (this file is built from docs/test-072.template.sql by scripts/build-migration-test.sh).
-- ============================================================
DO $test$
DECLARE
  c_shop     constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_cash_pin constant text := '7391';
  c_mgr_pin  constant text := '8264';
  c_owner    uuid;
  report text := '';
  v_body text;
  v_cashier uuid; v_mgr uuid;
  i_coffee uuid; i_milk uuid; i_ice uuid; i_cup uuid; i_sugar uuid; i_cond uuid;
  v_base uuid; v_latte uuid; v_tea uuid; v_hot uuid; v_iced uuid; v_tea_def uuid;
  v_real uuid; v_real_price numeric; v_real_def uuid;
  v_before jsonb; v_after jsonb; v_res jsonb; v_order uuid; v_n int; v_x numeric; v_cost numeric;
BEGIN
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active ORDER BY id LIMIT 1;
  IF c_owner IS NULL THEN RAISE EXCEPTION '072 TEST: the shop has no active owner'; END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE shop_id = c_shop AND is_active
             AND (pin_hash = extensions.crypt(c_cash_pin, pin_hash) OR pin_hash = extensions.crypt(c_mgr_pin, pin_hash))) THEN
    RAISE EXCEPTION '072 TEST: a real employee uses PIN % or % -- change them at the top and run again', c_cash_pin, c_mgr_pin;
  END IF;
  ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;
  SELECT count(*) INTO v_n FROM public.recipes;

  -- ---- body of 072 ----
  v_body := $body$
__BODY__
$body$;
  EXECUTE v_body;

  -- T1 every menu item that existed has exactly one default variant at its price
  report := report || CASE WHEN (SELECT count(*) FROM public.recipes r JOIN public.menu_variants v
                                   ON v.recipe_id = r.id AND v.kind = 'default' AND v.price_lak = r.price_lak) = v_n
                             AND (SELECT count(*) FROM public.menu_variants) = v_n
    THEN E'\nPASS T1 ' || v_n || ' menu items got a default variant at today''s price'
    ELSE E'\nFAIL T1 variants do not match the menu' END;

  -- helpers (pg_temp, rolled back with everything else)
  CREATE FUNCTION pg_temp.t_qty(p uuid) RETURNS numeric LANGUAGE sql AS $f$ SELECT current_qty FROM public.inventory WHERE id = p $f$;
  CREATE FUNCTION pg_temp.t_sell(p_cart jsonb, p_total numeric, p_emp uuid, p_test boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $f$
    SELECT public.checkout_order(gen_random_uuid(), '9afdd9eb-728d-4e36-8077-492c92dbef30', p_emp, p_cart, NULL, 'cash',
                                 p_total, 0, NULL, NULL, NULL, NULL, p_test, p_total) $f$;

  -- test data: ingredients, a milk-mix base, a latte (hot / iced) and a tea (one price)
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST072 cashier', 'cashier', extensions.crypt(c_cash_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_cashier;
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST072 manager', 'manager', extensions.crypt(c_mgr_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_mgr;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__072 coffee', 'g', 1000, 100, c_shop) RETURNING id INTO i_coffee;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__072 milk', 'ml', 5000, 20, c_shop) RETURNING id INTO i_milk;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__072 ice', 'g', 10000, 1, c_shop) RETURNING id INTO i_ice;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__072 cup', 'pcs', 100, 2000, c_shop) RETURNING id INTO i_cup;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id, is_sweetener) VALUES ('__072 sugar', 'g', 1000, 10, c_shop, true) RETURNING id INTO i_sugar;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__072 condensed', 'ml', 1000, 30, c_shop) RETURNING id INTO i_cond;
  INSERT INTO public.recipe_bases (name, unit, yield_qty) VALUES ('__072 milk mix', 'ml', 1000) RETURNING id INTO v_base;
  INSERT INTO public.recipe_base_ingredients (base_id, inventory_id, qty, unit) VALUES (v_base, i_milk, 800, 'ml'), (v_base, i_cond, 200, 'ml');
  INSERT INTO public.recipes (product_name, price_lak, shop_id) VALUES ('__072 Latte', 35000, c_shop) RETURNING id INTO v_latte;
  INSERT INTO public.recipes (product_name, price_lak, shop_id) VALUES ('__072 Tea', 20000, c_shop) RETURNING id INTO v_tea;
  SELECT id INTO v_tea_def FROM public.menu_variants WHERE recipe_id = v_tea AND kind = 'default';

  -- owner sets hot 35,000 / iced 40,000 (T9: a non-owner is refused first)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.save_menu_variants(v_latte, '[{"kind":"hot","price_lak":35000},{"kind":"iced","price_lak":40000}]');
    report := report || E'\nFAIL T9 a non-owner saved variants';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLSTATE = '42501' THEN E'\nPASS T9 non-owner cannot save variants' ELSE E'\nFAIL T9 ' || SQLERRM END;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_owner, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', c_owner::text, true);
  PERFORM public.save_menu_variants(v_latte, '[{"kind":"hot","price_lak":35000},{"kind":"iced","price_lak":40000}]');
  v_n := 0;
  BEGIN PERFORM public.save_menu_variants(v_latte, '[{"kind":"default","price_lak":1},{"kind":"hot","price_lak":2}]'); EXCEPTION WHEN OTHERS THEN v_n := v_n + 1; END;
  BEGIN PERFORM public.save_menu_variants(v_latte, '[{"kind":"hot","price_lak":0}]'); EXCEPTION WHEN OTHERS THEN v_n := v_n + 1; END;
  BEGIN PERFORM public.save_menu_variants(v_latte, '[{"kind":"hot","price_lak":1},{"kind":"hot","price_lak":2}]'); EXCEPTION WHEN OTHERS THEN v_n := v_n + 1; END;
  BEGIN PERFORM public.save_menu_variants(v_latte, '[]'); EXCEPTION WHEN OTHERS THEN v_n := v_n + 1; END;
  BEGIN PERFORM public.save_menu_variants(v_latte, '[{"kind":"frappe","price_lak":1}]'); EXCEPTION WHEN OTHERS THEN v_n := v_n + 1; END;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT id INTO v_hot FROM public.menu_variants WHERE recipe_id = v_latte AND kind = 'hot';
  SELECT id INTO v_iced FROM public.menu_variants WHERE recipe_id = v_latte AND kind = 'iced';
  report := report || CASE WHEN v_n = 5 AND v_hot IS NOT NULL AND v_iced IS NOT NULL
      AND NOT (SELECT is_active FROM public.menu_variants WHERE recipe_id = v_latte AND kind = 'default')
      AND (SELECT price_lak FROM public.recipes WHERE id = v_latte) = 35000
    THEN E'\nPASS T10 owner saved hot/iced, default switched off, menu shows from 35,000, 5 bad inputs refused'
    ELSE E'\nFAIL T10 variants: refused ' || v_n || '/5' END;

  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, base_id, variant_id, qty_normal, qty_less, qty_more, unit) VALUES
    (v_latte, i_coffee, NULL, NULL,   18, NULL, NULL, 'g'),
    (v_latte, i_milk,   NULL, v_hot,  150, NULL, NULL, 'ml'),
    (v_latte, i_milk,   NULL, v_iced, 120, NULL, NULL, 'ml'),
    (v_latte, i_ice,    NULL, v_iced, 175, NULL, NULL, 'g'),
    (v_latte, i_cup,    NULL, v_iced, 1,   NULL, NULL, 'pcs'),
    (v_latte, i_sugar,  NULL, NULL,   15,  8,    25,   'g'),
    (v_latte, NULL,     v_base, NULL, 100, NULL, NULL, 'ml');

  -- T11 a recipe line cannot point at another item's variant
  BEGIN
    INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, variant_id, qty_normal) VALUES (v_tea, i_milk, v_iced, 1);
    report := report || E'\nFAIL T11 a recipe line used another item''s variant';
  EXCEPTION WHEN foreign_key_violation THEN
    report := report || E'\nPASS T11 recipe line cannot use another item''s variant';
  END;

  -- T2 + T3 iced latte: 40,000; milk 120 + 80 from the mix, condensed 20, ice, cup, coffee, sugar; hot milk not used
  v_before := jsonb_build_array(pg_temp.t_qty(i_coffee), pg_temp.t_qty(i_milk), pg_temp.t_qty(i_ice), pg_temp.t_qty(i_cup), pg_temp.t_qty(i_sugar), pg_temp.t_qty(i_cond));
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_iced, 'qty', 1, 'sweetness', 'normal')), 40000, v_cashier);
  v_order := (v_res->>'order_id')::uuid;
  v_after := jsonb_build_array(pg_temp.t_qty(i_coffee), pg_temp.t_qty(i_milk), pg_temp.t_qty(i_ice), pg_temp.t_qty(i_cup), pg_temp.t_qty(i_sugar), pg_temp.t_qty(i_cond));
  report := report || CASE WHEN (v_res->>'total_lak')::numeric = 40000
      AND (v_before->>0)::numeric - (v_after->>0)::numeric = 18 AND (v_before->>1)::numeric - (v_after->>1)::numeric = 200
      AND (v_before->>2)::numeric - (v_after->>2)::numeric = 175 AND (v_before->>3)::numeric - (v_after->>3)::numeric = 1
      AND (v_before->>4)::numeric - (v_after->>4)::numeric = 15 AND (v_before->>5)::numeric - (v_after->>5)::numeric = 20
    THEN E'\nPASS T2 iced latte 40,000 cut coffee 18, milk 120+80 (mix), ice 175, cup 1, sugar 15, condensed 20'
    ELSE E'\nFAIL T2 ' || v_res::text || ' before ' || v_before::text || ' after ' || v_after::text END;

  -- T8 the bill keeps the cost of the moment: 1,800 + 4,000 + 175 + 2,000 + 150 + 600 = 8,725
  SELECT unit_cost_lak INTO v_cost FROM public.order_items WHERE order_id = v_order;
  UPDATE public.inventory SET cost_per_unit = 999 WHERE id = i_coffee;
  report := report || CASE WHEN v_cost = 8725 AND (SELECT unit_cost_lak FROM public.order_items WHERE order_id = v_order) = 8725
      AND public.variant_unit_cost(v_iced) = 8725 + 18 * 899
    THEN E'\nPASS T8 bill line keeps cost 8,725 after the coffee price changes'
    ELSE E'\nFAIL T8 cost ' || COALESCE(v_cost::text, 'null') END;
  UPDATE public.inventory SET cost_per_unit = 100 WHERE id = i_coffee;

  -- T14 void gives back exactly what was cut (base + variant lines), average cost untouched
  v_res := public.void_order_with_approval(v_order, c_shop, c_mgr_pin, 'TEST072');
  v_after := jsonb_build_array(pg_temp.t_qty(i_coffee), pg_temp.t_qty(i_milk), pg_temp.t_qty(i_ice), pg_temp.t_qty(i_cup), pg_temp.t_qty(i_sugar), pg_temp.t_qty(i_cond));
  report := report || CASE WHEN (v_res->>'ok')::boolean AND v_after = v_before
      AND (SELECT cost_per_unit FROM public.inventory WHERE id = i_milk) = 20
    THEN E'\nPASS T14 void put back all 6 ingredients exactly'
    ELSE E'\nFAIL T14 ' || v_res::text || ' before ' || v_before::text || ' after ' || v_after::text END;

  -- T4 sweetness: less 8, more 25, none 0 for a sweetener (coffee still 18)
  v_x := pg_temp.t_qty(i_sugar);
  PERFORM pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1, 'sweetness', 'less')), 35000, v_cashier);
  v_n := (v_x - pg_temp.t_qty(i_sugar))::int; v_x := pg_temp.t_qty(i_sugar);
  PERFORM pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1, 'sweetness', 'more')), 35000, v_cashier);
  v_cost := v_x - pg_temp.t_qty(i_sugar); v_x := pg_temp.t_qty(i_sugar);
  v_before := to_jsonb(pg_temp.t_qty(i_coffee));
  PERFORM pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1, 'sweetness', 'none')), 35000, v_cashier);
  report := report || CASE WHEN v_n = 8 AND v_cost = 25 AND v_x = pg_temp.t_qty(i_sugar)
      AND (v_before::text)::numeric - pg_temp.t_qty(i_coffee) = 18
    THEN E'\nPASS T4 sugar: less 8, more 25, none 0; coffee still 18'
    ELSE E'\nFAIL T4 less ' || v_n || ' more ' || v_cost || ' none ' || (v_x - pg_temp.t_qty(i_sugar)) END;

  -- T5 old POS code: no variant_id / sweetness, the note says "หวานน้อย · เย็น" -> iced 40,000, sugar 8
  v_x := pg_temp.t_qty(i_sugar);
  BEGIN
    v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'qty', 1, 'customization', 'หวานน้อย · เย็น')), 40000, v_cashier);
    report := report || CASE WHEN (SELECT variant_id FROM public.order_items WHERE order_id = (v_res->>'order_id')::uuid) = v_iced
        AND v_x - pg_temp.t_qty(i_sugar) = 8
      THEN E'\nPASS T5 old cart without variant: iced from the note, 40,000, less sugar'
      ELSE E'\nFAIL T5 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T5 refused: ' || SQLERRM;
  END;
  -- T5b old cart for a one-price item uses that price
  BEGIN
    v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_tea, 'qty', 2)), 40000, v_cashier);
    report := report || CASE WHEN (SELECT variant_id FROM public.order_items WHERE order_id = (v_res->>'order_id')::uuid) = v_tea_def
      THEN E'\nPASS T5b old cart for a one-price item: default variant' ELSE E'\nFAIL T5b ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T5b refused: ' || SQLERRM;
  END;

  -- T6 a variant of another item is refused
  BEGIN
    PERFORM pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_tea, 'variant_id', v_iced, 'qty', 1)), 40000, v_cashier);
    report := report || E'\nFAIL T6 sold tea at the iced latte price';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE 'variant does not belong%' THEN E'\nPASS T6 another item''s variant refused' ELSE E'\nFAIL T6 ' || SQLERRM END;
  END;

  -- T7 not enough cups (1 left, sell 2): the sale goes through, stock -1, a warning comes back
  UPDATE public.inventory SET current_qty = 1 WHERE id = i_cup;
  BEGIN
    v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_iced, 'qty', 2)), 80000, v_cashier);
    report := report || CASE WHEN pg_temp.t_qty(i_cup) = -1 AND jsonb_array_length(v_res->'stock_warnings') = 1
        AND (v_res->'stock_warnings'->0->>'inventory_id')::uuid = i_cup
      THEN E'\nPASS T7 oversell accepted, cup -1, one warning returned' ELSE E'\nFAIL T7 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T7 refused: ' || SQLERRM;
  END;

  -- T12 extra shot: refused while not set; after the owner sets 5,000 / 9 g: price + 10,000, coffee 18 + 18
  BEGIN
    PERFORM pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1, 'extra_shots', 1)), 35000, v_cashier);
    report := report || E'\nFAIL T12a extra shot sold while not set';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE 'EXTRA_SHOT_NOT_SET%' THEN E'\nPASS T12a extra shot refused while not set' ELSE E'\nFAIL T12a ' || SQLERRM END;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_owner, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', c_owner::text, true);
  PERFORM public.set_extra_shot(5000, i_coffee, 9);
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  v_x := pg_temp.t_qty(i_coffee);
  BEGIN
    v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1, 'extra_shots', 2)), 45000, v_cashier);
    report := report || CASE WHEN (v_res->>'total_lak')::numeric = 45000 AND v_x - pg_temp.t_qty(i_coffee) = 36
        AND (SELECT unit_cost_lak FROM public.order_items WHERE order_id = (v_res->>'order_id')::uuid) = public.variant_unit_cost(v_hot, 'normal', 2)
      THEN E'\nPASS T12b 2 extra shots: 45,000, coffee 36 g, cost includes the shots' ELSE E'\nFAIL T12b ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T12b refused: ' || SQLERRM;
  END;

  -- T13 the old menu form: a one-price item's variant follows; a hot/iced item refuses a single price
  UPDATE public.recipes SET price_lak = 22000 WHERE id = v_tea;
  BEGIN
    UPDATE public.recipes SET price_lak = 30000 WHERE id = v_latte;
    report := report || E'\nFAIL T13 single price written over hot/iced';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE 'MENU_HAS_VARIANTS%' AND (SELECT price_lak FROM public.menu_variants WHERE id = v_tea_def) = 22000
      THEN E'\nPASS T13 old form: tea variant follows 22,000, latte single price refused' ELSE E'\nFAIL T13 ' || SQLERRM END;
  END;

  -- T15 test bill: no stock cut, cost still recorded
  INSERT INTO public.pos_test_windows (shop_id, started_at, ends_at) VALUES (c_shop, now() - interval '1 minute', now() + interval '10 minutes');
  v_x := pg_temp.t_qty(i_coffee);
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1)), 35000, v_cashier, true);
  report := report || CASE WHEN v_res->>'status' = 'test' AND pg_temp.t_qty(i_coffee) = v_x
      AND (SELECT unit_cost_lak FROM public.order_items WHERE order_id = (v_res->>'order_id')::uuid) > 0
    THEN E'\nPASS T15 test bill: no stock cut, cost recorded' ELSE E'\nFAIL T15 ' || v_res::text END;
  UPDATE public.pos_test_windows SET ended_at = now() WHERE shop_id = c_shop AND ended_at IS NULL;

  -- T16 a bill saved before 072 (no variant) is given back the old way: direct, untagged lines, qty_normal
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 2)), 70000, v_cashier);
  UPDATE public.order_items SET variant_id = NULL, sweetness = NULL WHERE order_id = (v_res->>'order_id')::uuid;
  SELECT jsonb_object_agg(inventory_id::text, qty) INTO v_after FROM public.order_stock_usage((v_res->>'order_id')::uuid);
  report := report || CASE WHEN v_after = jsonb_build_object(i_coffee::text, 36, i_sugar::text, 30)
    THEN E'\nPASS T16 pre-072 bill line: coffee 36 + sugar 30 only (as it was cut then)' ELSE E'\nFAIL T16 ' || COALESCE(v_after::text, 'null') END;

  -- T17 a base with yield 0 is skipped, not divided by zero
  UPDATE public.recipe_bases SET yield_qty = 0 WHERE id = v_base;
  BEGIN
    v_x := public.variant_unit_cost(v_hot);
    report := report || CASE WHEN v_x = 18 * 100 + 150 * 20 + 15 * 10 THEN E'\nPASS T17 base yield 0 skipped' ELSE E'\nFAIL T17 cost ' || v_x END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T17 ' || SQLERRM;
  END;
  UPDATE public.recipe_bases SET yield_qty = 1000 WHERE id = v_base;

  -- T22 an ingredient with no cost yet = drink cost unknown (NULL), not cheaper
  UPDATE public.inventory SET cost_per_unit = NULL WHERE id = i_sugar;
  v_x := public.variant_unit_cost(v_hot);
  report := report || CASE WHEN v_x IS NULL AND public.variant_unit_cost(v_hot, 'none') IS NOT NULL
    THEN E'\nPASS T22 uncosted ingredient -> cost NULL (no sugar = sugar not used -> cost known)'
    ELSE E'\nFAIL T22 ' || COALESCE(v_x::text, 'null') END;
  UPDATE public.inventory SET cost_per_unit = 10 WHERE id = i_sugar;

  -- T18 the rest of checkout unchanged: wrong total, inactive variant, discount cap, test mode off
  v_n := 0;
  BEGIN PERFORM pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1)), 30000, v_cashier);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'PRICE_CHANGED%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', (SELECT id FROM public.menu_variants WHERE recipe_id = v_latte AND kind = 'default'), 'qty', 1)), 35000, v_cashier);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'menu item not available%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1)),
          NULL, 'cash', 35000, 20000, 'T18', NULL, NULL, NULL, false, 15000);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'DISCOUNT_NEEDS_PIN%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1)), 35000, v_cashier, true);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST_MODE_OFF%' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_n = 4 THEN E'\nPASS T18 wrong total / switched-off variant / big discount / test mode off still refused'
    ELSE E'\nFAIL T18 only ' || v_n || ' of 4 refused' END;

  -- T23 offline bill and the open drawer session (071 kept): 3 minutes before it opened
  -- (slow tablet clock) accepted, 10 minutes before refused
  UPDATE public.cash_sessions SET opened_at = now() - interval '30 minutes' WHERE shop_id = c_shop AND status <> 'closed';
  IF NOT FOUND THEN
    INSERT INTO public.cash_sessions (shop_id, status, opened_at, opening_cash_lak, window_start)
    VALUES (c_shop, 'open', now() - interval '30 minutes', 0, now() - interval '30 minutes');
  END IF;
  v_n := 0;
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1)),
               NULL, 'cash', 35000, 0, NULL, NULL, NULL, NULL, false, 35000, now() - interval '33 minutes', 931);
    IF v_res ? 'order_id' THEN v_n := v_n + 1; END IF;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T23 3 minutes early refused: ' || SQLERRM;
  END;
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_latte, 'variant_id', v_hot, 'qty', 1)),
               NULL, 'cash', 35000, 0, NULL, NULL, NULL, NULL, false, 35000, now() - interval '40 minutes', 932);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'SALE_TOO_OLD%' THEN v_n := v_n + 1; END IF;
  END;
  report := report || CASE WHEN v_n = 2 THEN E'\nPASS T23 offline bill 3 min before the session opened accepted, 10 min before refused'
    ELSE E'\nFAIL T23 ' || v_n || ' of 2' END;

  -- T21 realtime: hot/iced price changes reach the POS whenever menu changes do
  report := report || CASE WHEN EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'recipes')
                            = EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'menu_variants')
    THEN E'\nPASS T21 menu_variants is in realtime exactly when recipes is (recipes in realtime: '
         || CASE WHEN EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'recipes') THEN 'yes' ELSE 'NO - the POS will not live-update menu prices' END || ')'
    ELSE E'\nFAIL T21 realtime publication' END;

  -- T19 privileges
  report := report || CASE WHEN has_table_privilege('anon', 'public.menu_variants', 'SELECT')
      AND NOT has_table_privilege('anon', 'public.menu_variants', 'INSERT')
      AND NOT has_table_privilege('authenticated', 'public.menu_variants', 'UPDATE')
      AND NOT has_function_privilege('anon', 'public.save_menu_variants(uuid, jsonb)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.set_extra_shot(numeric, uuid, numeric)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.set_inventory_sweetener(uuid, boolean)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.variant_unit_cost(uuid, text, int)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.variant_unit_cost(uuid, text, int)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.order_stock_usage(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.check_stock_for_cart(jsonb)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.check_stock_for_cart(jsonb)', 'EXECUTE')
    THEN E'\nPASS T19 anon reads variants only; writes and internals closed' ELSE E'\nFAIL T19 privileges' END;

  -- T20 running the migration again: no error, no second set of variants
  SELECT count(*) INTO v_n FROM public.menu_variants;
  BEGIN
    EXECUTE v_body;
    report := report || CASE WHEN (SELECT count(*) FROM public.menu_variants) = v_n
      THEN E'\nPASS T20 second run changes nothing' ELSE E'\nFAIL T20 second run added variants' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T20 second run: ' || SQLERRM;
  END;

  RAISE EXCEPTION '072 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
