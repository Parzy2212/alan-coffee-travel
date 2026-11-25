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
