-- READ-ONLY, one SELECT. Run on production before test-075 / 075.
-- 075 closes save_recipe_cost: it must still be the 073 version (md5 below = the number 075's
-- first check expects; CR removed, blank lines at both ends dropped). The two new functions
-- must not exist yet; variant_unit_cost (072) and require_real_shop_role (057) must. Changes nothing.
SELECT 'save_recipe_cost versions' AS what, count(*)::text AS detail, (count(*) = 1)::text AS ok
FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'save_recipe_cost'
UNION ALL
SELECT 'save_recipe_cost md5', md5(regexp_replace(regexp_replace(replace(prosrc, E'\r', ''), '^([ ]*\n)+', ''), '(\n[ ]*)+$', '')),
       (md5(regexp_replace(regexp_replace(replace(prosrc, E'\r', ''), '^([ ]*\n)+', ''), '(\n[ ]*)+$', '')) = '8af669bd376b0ea83f85a046500d8306')::text
FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'save_recipe_cost'
UNION ALL
SELECT 'save_recipe_lines / get_menu_costs exist (must be false)',
       (to_regprocedure('public.save_recipe_lines(uuid, jsonb)') IS NOT NULL OR to_regprocedure('public.get_menu_costs()') IS NOT NULL)::text,
       (to_regprocedure('public.save_recipe_lines(uuid, jsonb)') IS NULL AND to_regprocedure('public.get_menu_costs()') IS NULL)::text
UNION ALL
SELECT 'variant_unit_cost + require_real_shop_role exist',
       (to_regprocedure('public.variant_unit_cost(uuid, text, integer)') IS NOT NULL)::text || ' / ' || (to_regprocedure('public.require_real_shop_role(text[])') IS NOT NULL)::text,
       (to_regprocedure('public.variant_unit_cost(uuid, text, integer)') IS NOT NULL AND to_regprocedure('public.require_real_shop_role(text[])') IS NOT NULL)::text
UNION ALL
SELECT 'recipe_ingredients rows / variant lines / less-or-more stored as 0',
       count(*)::text || ' / ' || count(*) FILTER (WHERE variant_id IS NOT NULL) || ' / ' || count(*) FILTER (WHERE qty_less = 0 OR qty_more = 0),
       'info'
FROM public.recipe_ingredients
UNION ALL
SELECT 'recipes not archived / with cost_per_cup_lak',
       count(*)::text || ' / ' || count(*) FILTER (WHERE cost_per_cup_lak IS NOT NULL), 'info'
FROM public.recipes WHERE NOT COALESCE(is_archived, false);
