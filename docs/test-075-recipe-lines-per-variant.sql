-- ============================================================
--  Test for migration 075 (recipe lines per hot/iced variant, drink cost from the database)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("075 TEST RESULTS ..."), so everything rolls back, including the test menu and ingredients.
--  Every line should start with PASS. Run as postgres, copy the error text back.
--  Section "body of 075" is a copy of supabase/migrations/075_recipe_lines_per_variant.sql
--  (this file is built from docs/test-075.template.sql by scripts/build-migration-test.sh).
-- ============================================================
DO $test$
DECLARE
  c_shop   constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_owner  uuid;
  c_mgr    uuid := gen_random_uuid();
  report   text := '';
  v_body   text;
  r_menu   uuid;
  r_other  uuid;
  v_hot    uuid;
  v_iced   uuid;
  v_otherv uuid;
  i_coffee uuid;
  i_ice    uuid;
  i_sugar  uuid;
  i_cup    uuid;
  i_milk   uuid;
  i_nocost uuid;
  b_mix    uuid;
  v_items  jsonb;
  v_n      int;
  v_c      record;
BEGIN
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active ORDER BY id LIMIT 1;
  IF c_owner IS NULL THEN RAISE EXCEPTION '075 TEST: the shop has no active owner'; END IF;

  -- ---- body of 075 ----
  v_body := $body$
-- ============================================================
--  075 — set 2 step 2: recipe lines per hot/iced variant, drink cost from the database only
--
--  * save_recipe_lines(recipe, items): replaces every recipe line of a menu item, including
--    lines for one variant only (variant_id must be a variant of that item). The screen no
--    longer sends a cost: recipes.cost_per_cup_lak is set here from variant_unit_cost of the
--    cheapest active variant that has lines (old reports still read that column until set 4).
--    qty_less / qty_more left empty are stored as NULL = "same as normal" (072 calculator);
--    the old screen stored 0 there, so "less sweet" would have used 0 g of coffee too.
--  * get_menu_costs(): ingredient cost of one drink per variant and sweetness, from the same
--    calculator checkout uses (base recipes expanded, sweeteners 0 for "none"). NULL cost =
--    an ingredient it uses has no cost yet. Owner / manager of the real shop only
--    (variant_unit_cost is closed to signed-in users; anyone can sign up).
--  * save_recipe_cost (screen-computed cost, kept hot/iced lines it did not show) is closed
--    to signed-in users; the function stays (not dropped, as in 043).
--  Order on production: run 075, then push the recipe page that calls save_recipe_lines.
-- ============================================================

-- 0) save_recipe_cost must still be the 073 version (md5 as docs/check-075-live-before.sql
--    prints: CR removed, blank lines at both ends dropped); a second run sees 075 and goes on
DO $chk$
DECLARE
  v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname = 'save_recipe_cost';
  IF v_src IS NULL THEN
    RAISE EXCEPTION '075: save_recipe_cost not found, nothing changed';
  END IF;
  IF md5(regexp_replace(regexp_replace(replace(v_src, E'\r', ''), '^([ ]*\n)+', ''), '(\n[ ]*)+$', '')) <> '8af669bd376b0ea83f85a046500d8306'
     AND to_regprocedure('public.save_recipe_lines(uuid, jsonb)') IS NULL THEN
    RAISE EXCEPTION '075: save_recipe_cost is not the 073 version, nothing changed';
  END IF;
  IF to_regprocedure('public.variant_unit_cost(uuid, text, integer)') IS NULL THEN
    RAISE EXCEPTION '075: variant_unit_cost (072) not found, nothing changed';
  END IF;
END
$chk$;

-- 1) save ----------------------------------------------------------------------------
-- p_items: [{"inventory_id"|"base_id": uuid, "variant_id": uuid|null, "qty_normal": n,
--            "qty_less": n|null, "qty_more": n|null}]
CREATE OR REPLACE FUNCTION public.save_recipe_lines(p_recipe_id uuid, p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_bad int;
BEGIN
  PERFORM public.require_real_shop_role(ARRAY['owner', 'manager']);

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'a recipe needs at least one ingredient' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.recipes WHERE id = p_recipe_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu item not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(p_items) i
  WHERE jsonb_typeof(i) <> 'object'
     OR (NULLIF(i ->> 'inventory_id', '') IS NULL) = (NULLIF(i ->> 'base_id', '') IS NULL)
     -- CASE, not OR: SQL may evaluate a cast before the type test next to it
     OR CASE WHEN jsonb_typeof(i -> 'qty_normal') = 'number' THEN (i ->> 'qty_normal')::numeric <= 0 ELSE true END
     OR CASE COALESCE(jsonb_typeof(i -> 'qty_less'), 'null') WHEN 'null' THEN false
             WHEN 'number' THEN (i ->> 'qty_less')::numeric < 0 ELSE true END
     OR CASE COALESCE(jsonb_typeof(i -> 'qty_more'), 'null') WHEN 'null' THEN false
             WHEN 'number' THEN (i ->> 'qty_more')::numeric < 0 ELSE true END;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'each line needs one ingredient or base recipe and an amount above 0' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(p_items) i
  WHERE NULLIF(i ->> 'variant_id', '') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.menu_variants v
                    WHERE v.id = (i ->> 'variant_id')::uuid AND v.recipe_id = p_recipe_id);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'hot / iced choice does not belong to this menu item' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.recipe_ingredients WHERE recipe_id = p_recipe_id;

  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, base_id, variant_id, qty_normal, qty_less, qty_more, sort_order)
  SELECT p_recipe_id,
         NULLIF(i ->> 'inventory_id', '')::uuid,
         NULLIF(i ->> 'base_id', '')::uuid,
         NULLIF(i ->> 'variant_id', '')::uuid,
         (i ->> 'qty_normal')::numeric,
         (i ->> 'qty_less')::numeric,
         (i ->> 'qty_more')::numeric,
         (n - 1)::int
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(i, n);

  UPDATE public.recipes r
     SET cost_per_cup_lak = (
       SELECT round(public.variant_unit_cost(v.id, 'normal', 0))
       FROM public.menu_variants v
       WHERE v.recipe_id = r.id AND v.is_active
         -- variant_unit_cost is 0 for a variant without lines; that is "no recipe", not free
         AND EXISTS (SELECT 1 FROM public.recipe_ingredients ri
                     WHERE ri.recipe_id = r.id AND (ri.variant_id IS NULL OR ri.variant_id = v.id))
       ORDER BY v.price_lak, v.sort_order
       LIMIT 1)
   WHERE r.id = p_recipe_id;
END
$fn$;

-- 2) read ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_menu_costs()
RETURNS TABLE (recipe_id uuid, variant_id uuid, kind text, price_lak numeric, is_active boolean,
               line_count int, cost_less numeric, cost_normal numeric, cost_more numeric, cost_none numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  PERFORM public.require_real_shop_role(ARRAY['owner', 'manager']);
  RETURN QUERY
  SELECT v.recipe_id, v.id, v.kind, v.price_lak, v.is_active,
         (SELECT count(*)::int FROM public.recipe_ingredients ri
          WHERE ri.recipe_id = v.recipe_id AND (ri.variant_id IS NULL OR ri.variant_id = v.id)),
         public.variant_unit_cost(v.id, 'less', 0),
         public.variant_unit_cost(v.id, 'normal', 0),
         public.variant_unit_cost(v.id, 'more', 0),
         public.variant_unit_cost(v.id, 'none', 0)
  FROM public.menu_variants v
  JOIN public.recipes r ON r.id = v.recipe_id
  WHERE COALESCE(r.is_archived, false) = false;
END
$fn$;

REVOKE ALL ON FUNCTION public.save_recipe_lines(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_menu_costs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_recipe_lines(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_menu_costs() TO authenticated;

-- 3) old path ------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.save_recipe_cost(uuid, boolean, numeric, jsonb) FROM PUBLIC, anon, authenticated;
$body$;
  EXECUTE v_body;

  CREATE FUNCTION pg_temp.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $f$
    SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
           set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $f$;
  CREATE FUNCTION pg_temp.t_lines(p uuid) RETURNS int LANGUAGE sql AS $f$ SELECT count(*)::int FROM public.recipe_ingredients WHERE recipe_id = p $f$;

  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__075 coffee', 'g', 1000, 500, c_shop) RETURNING id INTO i_coffee;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__075 ice', 'g', 10000, 1, c_shop) RETURNING id INTO i_ice;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id, is_sweetener) VALUES ('__075 sugar', 'g', 1000, 10, c_shop, true) RETURNING id INTO i_sugar;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__075 cup', 'pcs', 100, 1000, c_shop) RETURNING id INTO i_cup;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__075 milk', 'ml', 5000, 20, c_shop) RETURNING id INTO i_milk;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__075 no cost', 'g', 100, NULL, c_shop) RETURNING id INTO i_nocost;
  -- milk mix: 1,000 ml from 800 ml milk -> 16 per ml
  INSERT INTO public.recipe_bases (name, unit, yield_qty) VALUES ('__075 mix', 'ml', 1000) RETURNING id INTO b_mix;
  INSERT INTO public.recipe_base_ingredients (base_id, inventory_id, qty) VALUES (b_mix, i_milk, 800);
  INSERT INTO public.recipes (product_name, price_lak, shop_id) VALUES ('__075 latte', 35000, c_shop) RETURNING id INTO r_menu;
  INSERT INTO public.recipes (product_name, price_lak, shop_id) VALUES ('__075 other', 20000, c_shop) RETURNING id INTO r_other;
  SELECT id INTO v_otherv FROM public.menu_variants WHERE recipe_id = r_other;

  -- T1 privileges
  report := report || CASE WHEN NOT has_function_privilege('anon', 'public.save_recipe_lines(uuid, jsonb)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.get_menu_costs()', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.save_recipe_lines(uuid, jsonb)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.get_menu_costs()', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.save_recipe_cost(uuid, boolean, numeric, jsonb)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.save_recipe_cost(uuid, boolean, numeric, jsonb)', 'EXECUTE')
    THEN E'\nPASS T1 new functions: signed-in only; old save_recipe_cost closed to signed-in and anon'
    ELSE E'\nFAIL T1 privileges' END;

  -- T2 a signed-in non-member is refused both ways
  PERFORM pg_temp.t_as(gen_random_uuid());
  v_n := 0;
  BEGIN PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 18))); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  BEGIN PERFORM * FROM public.get_menu_costs(); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  report := report || CASE WHEN v_n = 2 AND pg_temp.t_lines(r_menu) = 0 THEN E'\nPASS T2 non-member refused (save and read), nothing saved' ELSE E'\nFAIL T2 non-member' END;

  PERFORM pg_temp.t_as(c_owner);
  PERFORM public.save_menu_variants(r_menu, '[{"kind":"hot","price_lak":35000},{"kind":"iced","price_lak":40000}]');
  SELECT id INTO v_hot FROM public.menu_variants WHERE recipe_id = r_menu AND kind = 'hot';
  SELECT id INTO v_iced FROM public.menu_variants WHERE recipe_id = r_menu AND kind = 'iced';

  -- T3 lines for every variant + hot only + iced only; costs per variant and sweetness
  v_items := jsonb_build_array(
    jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 18, 'qty_less', NULL, 'qty_more', NULL),
    jsonb_build_object('inventory_id', i_sugar, 'qty_normal', 10, 'qty_less', 5, 'qty_more', 15),
    jsonb_build_object('inventory_id', i_ice, 'variant_id', v_iced, 'qty_normal', 175),
    jsonb_build_object('inventory_id', i_cup, 'qty_normal', 1),
    jsonb_build_object('base_id', b_mix, 'variant_id', v_hot, 'qty_normal', 100));
  PERFORM public.save_recipe_lines(r_menu, v_items);
  SELECT * INTO v_c FROM public.get_menu_costs() c WHERE c.variant_id = v_hot;
  report := report || CASE WHEN v_c.cost_normal = 11700 AND v_c.cost_less = 11650 AND v_c.cost_more = 11750 AND v_c.cost_none = 11600 AND v_c.line_count = 4
    THEN E'\nPASS T3a hot: 11,700 normal / 11,650 less / 11,750 more / 11,600 no sugar, 4 lines (milk mix expanded, no ice)'
    ELSE E'\nFAIL T3a hot ' || row_to_json(v_c)::text END;
  SELECT * INTO v_c FROM public.get_menu_costs() c WHERE c.variant_id = v_iced;
  report := report || CASE WHEN v_c.cost_normal = 10275 AND v_c.line_count = 4 AND v_c.price_lak = 40000
    THEN E'\nPASS T3b iced: 10,275 normal (ice, no milk mix), 4 lines, price 40,000'
    ELSE E'\nFAIL T3b iced ' || row_to_json(v_c)::text END;
  report := report || CASE WHEN (SELECT cost_per_cup_lak FROM public.recipes WHERE id = r_menu) = 11700
    THEN E'\nPASS T3c recipes.cost_per_cup_lak = cheapest active variant (hot) normal cost, set by the database'
    ELSE E'\nFAIL T3c cost_per_cup_lak ' || COALESCE((SELECT cost_per_cup_lak FROM public.recipes WHERE id = r_menu)::text, 'NULL') END;

  -- T3d every line iced-only: hot (cheaper) has no recipe, so the column takes iced, not 0
  PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_ice, 'variant_id', v_iced, 'qty_normal', 175)));
  report := report || CASE WHEN (SELECT cost_per_cup_lak FROM public.recipes WHERE id = r_menu) = 175
    THEN E'\nPASS T3d only iced lines: cost_per_cup_lak = 175 (iced), not 0 from hot without a recipe'
    ELSE E'\nFAIL T3d cost_per_cup_lak ' || COALESCE((SELECT cost_per_cup_lak FROM public.recipes WHERE id = r_menu)::text, 'NULL') END;
  PERFORM public.save_recipe_lines(r_menu, v_items);

  -- T4 stored as sent: empty less/more stay NULL (= same as normal), order kept
  report := report || CASE WHEN pg_temp.t_lines(r_menu) = 5
      AND (SELECT qty_less IS NULL AND qty_more IS NULL FROM public.recipe_ingredients WHERE recipe_id = r_menu AND inventory_id = i_coffee)
      AND (SELECT variant_id FROM public.recipe_ingredients WHERE recipe_id = r_menu AND inventory_id = i_ice) = v_iced
      AND (SELECT array_agg(sort_order ORDER BY sort_order) FROM public.recipe_ingredients WHERE recipe_id = r_menu) = ARRAY[0,1,2,3,4]
    THEN E'\nPASS T4 5 lines stored, empty less/more kept empty, ice tied to iced, order 0-4'
    ELSE E'\nFAIL T4 stored lines' END;

  -- T5 a variant of another menu item is refused, lines unchanged
  v_n := 0;
  BEGIN PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'variant_id', v_otherv, 'qty_normal', 18)));
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'hot / iced choice does not belong%' THEN v_n := 1; END IF; END;
  report := report || CASE WHEN v_n = 1 AND pg_temp.t_lines(r_menu) = 5 THEN E'\nPASS T5 variant of another menu item refused, lines unchanged' ELSE E'\nFAIL T5' END;

  -- T6 bad lines refused one by one, lines unchanged
  v_n := 0;
  BEGIN PERFORM public.save_recipe_lines(r_menu, '[]'); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = '22023' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 0))); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = '22023' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'base_id', b_mix, 'qty_normal', 5))); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = '22023' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 'abc'))); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = '22023' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 18, 'qty_less', -1))); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = '22023' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 18, 'qty_more', 'x'))); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = '22023' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.save_recipe_lines(gen_random_uuid(), jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 18))); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = 'P0002' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_n = 7 AND pg_temp.t_lines(r_menu) = 5
    THEN E'\nPASS T6 empty list / amount 0 / ingredient+base / text amount / negative less / text more / unknown menu: all refused, lines unchanged'
    ELSE E'\nFAIL T6 only ' || v_n || ' of 7 refused' END;

  -- T7 a manager of the real shop may save; saving again replaces every line (incl. hot/iced-only ones)
  -- a throw-away sign-in (no email, no password, nobody can log in with it), rolled back with the rest
  INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', c_mgr, 'authenticated', 'authenticated', now(), now());
  INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (c_shop, c_mgr, '__075mgr@test.invalid', 'manager', true);
  PERFORM pg_temp.t_as(c_mgr);
  PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 18)));
  SELECT * INTO v_c FROM public.get_menu_costs() c WHERE c.variant_id = v_iced;
  report := report || CASE WHEN pg_temp.t_lines(r_menu) = 1 AND v_c.cost_normal = 9000 AND v_c.line_count = 1
    THEN E'\nPASS T7 manager saved; old lines (incl. iced-only ice) replaced, iced cost now 9,000'
    ELSE E'\nFAIL T7 lines ' || pg_temp.t_lines(r_menu) || ' ' || row_to_json(v_c)::text END;

  -- T8 an ingredient without a cost: cost unknown (NULL), not counted as free
  PERFORM public.save_recipe_lines(r_menu, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 18),
                                                              jsonb_build_object('inventory_id', i_nocost, 'qty_normal', 2)));
  SELECT * INTO v_c FROM public.get_menu_costs() c WHERE c.variant_id = v_hot;
  report := report || CASE WHEN v_c.cost_normal IS NULL AND (SELECT cost_per_cup_lak FROM public.recipes WHERE id = r_menu) IS NULL
    THEN E'\nPASS T8 ingredient without a cost: drink cost unknown (NULL) on screen and in recipes'
    ELSE E'\nFAIL T8 ' || row_to_json(v_c)::text END;

  -- T9 a menu item with no recipe: 0 lines (the screen says "no recipe", not "free")
  SELECT * INTO v_c FROM public.get_menu_costs() c WHERE c.recipe_id = r_other;
  report := report || CASE WHEN v_c.line_count = 0 THEN E'\nPASS T9 menu item without a recipe reports 0 lines' ELSE E'\nFAIL T9 ' || row_to_json(v_c)::text END;

  -- T10 running the migration again: no error, lines unchanged
  PERFORM pg_temp.t_as(NULL);
  BEGIN
    EXECUTE v_body;
    report := report || CASE WHEN pg_temp.t_lines(r_menu) = 2 THEN E'\nPASS T10 second run changes nothing' ELSE E'\nFAIL T10 second run changed lines' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T10 second run: ' || SQLERRM;
  END;

  -- T11 the gate: a save_recipe_cost that is not the 073 version stops a first run before any change
  DROP FUNCTION public.save_recipe_lines(uuid, jsonb);
  DROP FUNCTION public.get_menu_costs();
  CREATE OR REPLACE FUNCTION public.save_recipe_cost(p_recipe_id uuid, p_uses_ice boolean, p_cost_per_cup_lak numeric, p_items jsonb)
    RETURNS void LANGUAGE sql AS $f$ SELECT $f$;
  v_n := 0;
  BEGIN EXECUTE v_body; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '075: save_recipe_cost is not the 073 version%' THEN v_n := 1; END IF; END;
  report := report || CASE WHEN v_n = 1 AND to_regprocedure('public.save_recipe_lines(uuid, jsonb)') IS NULL
    THEN E'\nPASS T11 a changed save_recipe_cost stops the migration, nothing added' ELSE E'\nFAIL T11 gate did not refuse' END;

  RAISE EXCEPTION '075 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
