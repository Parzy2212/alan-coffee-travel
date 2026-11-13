-- ============================================================
--  057  Package F, set 1: menu / price / recipes / stock + staff privacy
--
--  Before: anyone holding the public anon key (it ships in the web page)
--  could change prices, menu items, categories, recipes and stock, and
--  read staff pay and phone numbers.
--  After (owner decision 2026-11-13):
--    menu, price, category      -> signed-in OWNER of the real shop only
--    stock, recipes, purchases  -> signed-in OWNER or MANAGER
--    staff pay / phone / notes / face data -> not readable by anon
--  Selling is not touched: the POS still reads the menu as before and
--  pays through checkout_order.
--
--  The real shop is pinned (as in 051 / 052): these tables have no
--  reliable shop_id and anyone can sign up and open a shop of their own.
--
--  Safe to run twice. Test first: docs/test-057-f1-menu-stock-staff-privacy.sql
--  Run this migration and push the matching app code together: between
--  the two, the back office cannot edit menu / stock (selling works).
-- ============================================================

-- 1) who is the caller in the real shop
CREATE OR REPLACE FUNCTION public.real_shop_role_in(p_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid
      AND user_id = auth.uid()
      AND active IS TRUE
      AND role = ANY (p_roles)
  )
$fn$;
REVOKE ALL ON FUNCTION public.real_shop_role_in(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.real_shop_role_in(text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.require_real_shop_role(p_roles text[])
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT public.real_shop_role_in(p_roles) THEN
    RAISE EXCEPTION 'not allowed: sign in as the shop %', array_to_string(p_roles, ' or ')
      USING ERRCODE = '42501';
  END IF;
END
$fn$;
REVOKE ALL ON FUNCTION public.require_real_shop_role(text[]) FROM PUBLIC, anon, authenticated;

-- 2) existing functions: add the caller check as the first statement and
--    take the anon right away. The body is taken from the database itself,
--    so nothing else in it changes.
DO $mig$
DECLARE
  r record;
  v_oid oid;
  v_n int;
  v_def text;
  v_new text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('create_recipe_full',    'owner'),
      ('update_recipe_full',    'owner'),
      ('toggle_recipe_active',  'owner'),
      ('create_category',       'owner'),
      ('update_category',       'owner'),
      ('delete_category',       'owner'),
      ('swap_category_sort',    'owner'),
      ('add_stock',             'owner,manager'),
      ('create_inventory_item', 'owner,manager'),
      ('update_inventory_item', 'owner,manager'),
      ('delete_inventory_item', 'owner,manager'),
      ('approve_purchase',      'owner,manager'),
      ('start_stock_audit',     'owner,manager'),
      ('submit_stock_audit',    'owner,manager'),
      ('get_all_staff',         'owner,manager')
    ) AS t(fn, roles)
  LOOP
    SELECT count(*), min(p.oid) INTO v_n, v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r.fn;
    IF v_n <> 1 THEN
      RAISE EXCEPTION '057: expected exactly 1 function public.%, found %', r.fn, v_n;
    END IF;

    v_def := pg_get_functiondef(v_oid);
    IF position('require_real_shop_role' IN v_def) = 0 THEN
      v_new := regexp_replace(
        v_def,
        '\n[ \t]*BEGIN[ \t\r]*\n',
        format(E'\nBEGIN\n  PERFORM public.require_real_shop_role(%L::text[]);\n',
               string_to_array(r.roles, ',')::text),
        'i');
      IF v_new = v_def THEN
        RAISE EXCEPTION '057: could not find the start of the body of public.%', r.fn;
      END IF;
      EXECUTE v_new;
    END IF;

    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_oid::regprocedure);
  END LOOP;
END
$mig$;

-- 3) save one menu item's recipe and cost in one step (was 4 separate
--    table writes from the browser, which could stop half way)
CREATE OR REPLACE FUNCTION public.save_recipe_cost(
  p_recipe_id uuid,
  p_uses_ice boolean,
  p_cost_per_cup_lak numeric,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM public.require_real_shop_role(ARRAY['owner', 'manager']);

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'a recipe needs at least one ingredient' USING ERRCODE = '22023';
  END IF;
  IF p_cost_per_cup_lak IS NULL OR p_cost_per_cup_lak < 0 THEN
    RAISE EXCEPTION 'cost must be zero or more' USING ERRCODE = '22023';
  END IF;

  UPDATE public.recipes
     SET uses_ice = COALESCE(p_uses_ice, uses_ice),
         cost_per_cup_lak = round(p_cost_per_cup_lak)
   WHERE id = p_recipe_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu item not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.recipe_ingredients WHERE recipe_id = p_recipe_id;

  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, base_id, qty_normal, qty_less, qty_more)
  SELECT p_recipe_id,
         NULLIF(i ->> 'inventory_id', '')::uuid,
         NULLIF(i ->> 'base_id', '')::uuid,
         COALESCE((i ->> 'qty_normal')::numeric, 0),
         COALESCE((i ->> 'qty_less')::numeric, 0),
         COALESCE((i ->> 'qty_more')::numeric, 0)
  FROM jsonb_array_elements(p_items) AS i;
END
$fn$;
REVOKE ALL ON FUNCTION public.save_recipe_cost(uuid, boolean, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_recipe_cost(uuid, boolean, numeric, jsonb) TO authenticated, service_role;

-- 4) tables: anon may no longer write; the signed-in shop account may
DROP POLICY IF EXISTS "anon: write recipes" ON public.recipes;
DROP POLICY IF EXISTS f_recipes_owner_write ON public.recipes;
CREATE POLICY f_recipes_owner_write ON public.recipes
  FOR ALL TO authenticated
  USING (public.real_shop_role_in(ARRAY['owner']))
  WITH CHECK (public.real_shop_role_in(ARRAY['owner']));

DROP POLICY IF EXISTS anon_all ON public.recipe_ingredients;
DROP POLICY IF EXISTS f_recipe_ingredients_staff ON public.recipe_ingredients;
CREATE POLICY f_recipe_ingredients_staff ON public.recipe_ingredients
  FOR ALL TO authenticated
  USING (public.real_shop_role_in(ARRAY['owner', 'manager']))
  WITH CHECK (public.real_shop_role_in(ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS anon_all ON public.recipe_bases;
DROP POLICY IF EXISTS f_recipe_bases_staff ON public.recipe_bases;
CREATE POLICY f_recipe_bases_staff ON public.recipe_bases
  FOR ALL TO authenticated
  USING (public.real_shop_role_in(ARRAY['owner', 'manager']))
  WITH CHECK (public.real_shop_role_in(ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS anon_all ON public.recipe_base_ingredients;
DROP POLICY IF EXISTS f_recipe_base_ingredients_staff ON public.recipe_base_ingredients;
CREATE POLICY f_recipe_base_ingredients_staff ON public.recipe_base_ingredients
  FOR ALL TO authenticated
  USING (public.real_shop_role_in(ARRAY['owner', 'manager']))
  WITH CHECK (public.real_shop_role_in(ARRAY['owner', 'manager']));

-- no screen uses these three tables any more
DROP POLICY IF EXISTS anon_all_cost_ingredients ON public.cost_ingredients;
DROP POLICY IF EXISTS anon_all_cost_base_recipes ON public.cost_base_recipes;
DROP POLICY IF EXISTS anon_all_cost_formulas ON public.cost_formulas;

-- 5) staff privacy: anon keeps only what the selling and clock-in screens
--    list by name; pay, phone, notes and face data need a signed-in
--    owner / manager
REVOKE SELECT (phone, salary, salary_type, hourly_rate_lak, hours_per_day, start_date,
               skills, notes, rating, performance_score, face_descriptor)
  ON public.staff FROM anon;

DROP POLICY IF EXISTS f_staff_shop_read ON public.staff;
CREATE POLICY f_staff_shop_read ON public.staff
  FOR SELECT TO authenticated
  USING (public.real_shop_role_in(ARRAY['owner', 'manager']));

-- 6) new tables / functions / sequences made from now on are closed to
--    the public by default (they used to be born wide open)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
