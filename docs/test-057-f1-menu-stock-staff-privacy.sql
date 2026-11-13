-- ============================================================
--  Test for migration 057 (package F, set 1: menu / price / recipes /
--  stock + staff privacy)
--
--  CHANGES NOTHING. The whole file is ONE DO block that always ends in
--  an error ("057 TEST RESULTS ..."), so Postgres rolls everything back:
--  the new functions, the policies, the rights and the test rows. The
--  error message IS the report: every line should start with PASS or
--  SKIP. No BEGIN/ROLLBACK needed (the SQL Editor does not keep a BEGIN
--  open).
--
--  It makes no sale and writes no order, so no order trigger fires.
--  Callers are simulated the way the website does it: role anon /
--  authenticated plus request.jwt.claims (which auth.uid() reads).
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor) as postgres:
--  paste the whole file, Run, copy the error text back.
--  The body is a generated copy of
--  supabase/migrations/057_f1_menu_stock_staff_privacy.sql -- keep in sync.
-- ============================================================

DO $test$
DECLARE
  c_shop constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_guarded constant text[] := ARRAY[
    'create_recipe_full', 'update_recipe_full', 'toggle_recipe_active', 'create_category', 'update_category',
    'delete_category', 'swap_category_sort', 'add_stock', 'create_inventory_item', 'update_inventory_item',
    'delete_inventory_item', 'approve_purchase', 'start_stock_audit', 'submit_stock_audit', 'get_all_staff',
    'save_recipe_cost'];
  c_selling constant text[] := ARRAY[
    'checkout_order', 'verify_employee_pin', 'void_order_with_approval', 'get_site_settings', 'get_today_orders',
    'get_today_pos_queue', 'update_queue_status', 'get_menu_with_stats', 'get_categories_tree', 'get_stock_detail'];
  report text := '';
  r text; r2 text; r3 text; r4 text; r5 text; r6 text;
  n int; n2 int;
  b_sell text; b_data text; b_bodies text;
  v_owner uuid; v_owner2 uuid; v_stranger uuid := gen_random_uuid();
  v_recipe uuid; v_inv uuid; v_active boolean; v_staff int; v_recipes int;
BEGIN
  SELECT user_id INTO v_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active IS TRUE AND user_id IS NOT NULL ORDER BY user_id LIMIT 1;
  SELECT user_id INTO v_owner2 FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active IS TRUE AND user_id IS NOT NULL AND user_id <> v_owner
   ORDER BY user_id LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION '057 TEST: the real shop has no active owner account'; END IF;
  SELECT id, is_active INTO v_recipe, v_active FROM public.recipes ORDER BY created_at, id LIMIT 1;
  SELECT id INTO v_inv FROM public.inventory ORDER BY name, id LIMIT 1;
  SELECT count(*) INTO v_staff FROM public.staff;
  SELECT count(*) INTO v_recipes FROM public.recipes;

  -- the selling functions, to prove 057 does not touch them
  SELECT md5(string_agg(pg_get_functiondef(p.oid), '|' ORDER BY p.oid::regprocedure::text)) INTO b_sell
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_selling);
  -- the guarded functions with the new first line taken out again, to prove nothing else in them changes
  SELECT md5(string_agg(regexp_replace(pg_get_functiondef(p.oid), '\n[ \t]*BEGIN[ \t\r]*\n', E'\nBEGIN\n'),
                        '|' ORDER BY p.oid::regprocedure::text)) INTO b_bodies
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_guarded);
  SELECT md5(
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipes t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipe_ingredients t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipe_bases t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipe_base_ingredients t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.categories t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.inventory t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.staff t)) INTO b_data;

  -- ---- 057 body (generated copy) ----
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
  END;

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

  -- ---- end of 057 body ----

  -- helper: run one statement as a given caller; returns ok:<rows> / denied / error
  CREATE FUNCTION pg_temp.t057_try(p_role text, p_sub uuid, p_sql text) RETURNS text
  LANGUAGE plpgsql AS $h$
  DECLARE n bigint;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', COALESCE(p_sub::text, ''), 'role', p_role)::text, true);
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub::text, ''), true);
    PERFORM set_config('role', p_role, true);
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    RESET ROLE;
    RETURN 'ok:' || n;
  EXCEPTION
    WHEN insufficient_privilege THEN RESET ROLE; RETURN 'denied';
    WHEN OTHERS THEN RESET ROLE; RETURN 'error ' || SQLSTATE || ' ' || SQLERRM;
  END
  $h$;
  GRANT EXECUTE ON FUNCTION pg_temp.t057_try(text, uuid, text) TO anon, authenticated;

  -- T1 rights
  SELECT count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE')),
         count(*) FILTER (WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    INTO n, n2
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_guarded);
  report := report || CASE WHEN n = 0 AND n2 = cardinality(c_guarded) THEN 'PASS' ELSE 'FAIL' END
    || format(' T1 the %s menu / stock / staff-list functions: callable by anon %s (want 0), by a signed-in user %s',
              cardinality(c_guarded), n, n2) || E'\n';

  -- T2 selling untouched
  SELECT md5(string_agg(pg_get_functiondef(p.oid), '|' ORDER BY p.oid::regprocedure::text)),
         count(*) FILTER (WHERE NOT has_function_privilege('anon', p.oid, 'EXECUTE'))
    INTO r, n
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_selling);
  report := report || CASE WHEN r = b_sell AND n = 0 THEN 'PASS' ELSE 'FAIL' END
    || format(' T2 the %s selling-screen functions are unchanged and still callable (not callable: %s)',
              cardinality(c_selling), n) || E'\n';

  -- T3 only the first line was added to the guarded functions
  SELECT md5(string_agg(
           regexp_replace(pg_get_functiondef(p.oid),
                          '\nBEGIN\n  PERFORM public\.require_real_shop_role\([^\n]*\);\n', E'\nBEGIN\n'),
           '|' ORDER BY p.oid::regprocedure::text))
    INTO r
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_guarded)
                   AND p.proname <> 'save_recipe_cost';
  report := report || CASE WHEN r = b_bodies THEN 'PASS' ELSE 'FAIL' END
    || ' T3 the guarded functions are the same as before except for the new first line (caller check)' || E'\n';

  -- T4 data untouched by the migration itself
  SELECT md5(
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipes t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipe_ingredients t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipe_bases t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipe_base_ingredients t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.categories t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.inventory t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.staff t)) INTO r;
  report := report || CASE WHEN r = b_data THEN 'PASS' ELSE 'FAIL' END
    || ' T4 menu, recipes, categories, stock and staff rows are exactly as before' || E'\n';

  -- T5 the public (anon) can still read what the selling screen reads
  r  := pg_temp.t057_try('anon', NULL, 'SELECT id, product_name, price_lak FROM public.recipes');
  r2 := pg_temp.t057_try('anon', NULL, 'SELECT id, name FROM public.categories');
  r3 := pg_temp.t057_try('anon', NULL, 'SELECT id, name, name_th, avatar_url, scheduled_start_time, is_active, employee_id FROM public.staff');
  report := report || CASE WHEN r = 'ok:' || v_recipes AND r2 LIKE 'ok:%' AND r3 LIKE 'ok:%' THEN 'PASS' ELSE 'FAIL' END
    || format(' T5 anon still reads menu (%s), categories (%s), staff names (%s)', r, r2, r3) || E'\n';

  -- T6 the public (anon) can no longer change menu / recipes / stock
  IF v_recipe IS NULL OR v_inv IS NULL THEN
    report := report || 'SKIP T6-T12 need at least one menu item and one stock item' || E'\n';
  ELSE
    r  := pg_temp.t057_try('anon', NULL, format('UPDATE public.recipes SET price_lak = price_lak + 1 WHERE id = %L', v_recipe));
    r2 := pg_temp.t057_try('anon', NULL, format('SELECT public.toggle_recipe_active(%L)', v_recipe));
    r3 := pg_temp.t057_try('anon', NULL, 'INSERT INTO public.recipe_bases (name, unit, yield_qty) VALUES (''T057'', ''ml'', 1)');
    r4 := pg_temp.t057_try('anon', NULL, 'DELETE FROM public.recipe_ingredients');
    r5 := pg_temp.t057_try('anon', NULL, format('SELECT public.add_stock(%L, 1, 0, ''T057'', now())', v_inv));
    r6 := pg_temp.t057_try('anon', NULL, format('DELETE FROM public.recipes WHERE id = %L', v_recipe));
    report := report || CASE WHEN r = 'ok:0' AND r2 = 'denied' AND r3 = 'denied' AND r4 = 'ok:0' AND r5 = 'denied' AND r6 = 'ok:0'
        THEN 'PASS' ELSE 'FAIL' END
      || format(' T6 anon cannot change: price %s, menu on/off %s, new base recipe %s, delete recipe lines %s, add stock %s, delete menu %s',
                r, r2, r3, r4, r5, r6) || E'\n';

    -- T7 the public (anon) can no longer read staff pay / phone / face data
    r  := pg_temp.t057_try('anon', NULL, 'SELECT salary FROM public.staff');
    r2 := pg_temp.t057_try('anon', NULL, 'SELECT phone FROM public.staff');
    r3 := pg_temp.t057_try('anon', NULL, 'SELECT face_descriptor FROM public.staff');
    r4 := pg_temp.t057_try('anon', NULL, 'SELECT * FROM public.get_all_staff()');
    r5 := pg_temp.t057_try('anon', NULL, 'SELECT notes FROM public.staff');
    report := report || CASE WHEN r = 'denied' AND r2 = 'denied' AND r3 = 'denied' AND r4 = 'denied' AND r5 = 'denied'
        THEN 'PASS' ELSE 'FAIL' END
      || format(' T7 anon cannot read staff: pay %s, phone %s, face data %s, full staff list %s, notes %s', r, r2, r3, r4, r5) || E'\n';

    -- T8 a signed-in account that does not belong to the real shop
    r  := pg_temp.t057_try('authenticated', v_stranger, format('SELECT public.toggle_recipe_active(%L)', v_recipe));
    r2 := pg_temp.t057_try('authenticated', v_stranger, format('UPDATE public.recipes SET price_lak = price_lak + 1 WHERE id = %L', v_recipe));
    r3 := pg_temp.t057_try('authenticated', v_stranger, 'SELECT salary FROM public.staff');
    r4 := pg_temp.t057_try('authenticated', v_stranger, format('SELECT public.save_recipe_cost(%L, true, 1, %L::jsonb)', v_recipe,
            json_build_array(json_build_object('inventory_id', v_inv, 'qty_normal', 1))::text));
    r5 := pg_temp.t057_try('authenticated', v_stranger, 'SELECT * FROM public.get_all_staff()');
    r6 := pg_temp.t057_try('authenticated', v_stranger, 'INSERT INTO public.recipe_bases (name, unit, yield_qty) VALUES (''T057'', ''ml'', 1)');
    report := report || CASE WHEN r = 'denied' AND r2 = 'ok:0' AND r3 = 'ok:0' AND r4 = 'denied' AND r5 = 'denied' AND r6 = 'denied'
        THEN 'PASS' ELSE 'FAIL' END
      || format(' T8 a signed-in stranger cannot: menu on/off %s, price %s, staff pay rows %s, save recipe %s, staff list %s, base recipe %s',
                r, r2, r3, r4, r5, r6) || E'\n';

    -- T9 the owner can do everything
    r  := pg_temp.t057_try('authenticated', v_owner, format('SELECT public.toggle_recipe_active(%L)', v_recipe));
    r  := r || ',' || pg_temp.t057_try('authenticated', v_owner, format('SELECT public.toggle_recipe_active(%L)', v_recipe));
    r2 := pg_temp.t057_try('authenticated', v_owner, format('UPDATE public.recipes SET price_lak = price_lak WHERE id = %L', v_recipe));
    r3 := pg_temp.t057_try('authenticated', v_owner, 'SELECT public.create_category(''T057 cat'', ''T057'', ''T057'', NULL, NULL, NULL, 99)');
    r4 := pg_temp.t057_try('authenticated', v_owner, format('SELECT public.add_stock(%L, 1, 0, ''T057'', now())', v_inv));
    r5 := pg_temp.t057_try('authenticated', v_owner, 'SELECT * FROM public.get_all_staff()');
    r6 := pg_temp.t057_try('authenticated', v_owner, 'SELECT salary, phone, face_descriptor FROM public.staff');
    SELECT is_active = v_active INTO v_active FROM public.recipes WHERE id = v_recipe;
    report := report || CASE WHEN r = 'ok:1,ok:1' AND COALESCE(v_active, false) AND r2 = 'ok:1' AND r3 = 'ok:1' AND r4 = 'ok:1'
          AND r5 = 'ok:' || v_staff AND r6 = 'ok:' || v_staff THEN 'PASS' ELSE 'FAIL' END
      || format(' T9 the owner can: menu on/off twice %s, price %s, new category %s, add stock %s, staff list %s, staff pay %s',
                r, r2, r3, r4, r5, r6) || E'\n';

    -- T10 saving a recipe + cost in one step
    r := pg_temp.t057_try('authenticated', v_owner, format('SELECT public.save_recipe_cost(%L, true, 4321.4, %L::jsonb)', v_recipe,
           json_build_array(json_build_object('inventory_id', v_inv, 'base_id', NULL, 'qty_normal', '2', 'qty_less', '1', 'qty_more', '3'))::text));
    SELECT count(*) INTO n FROM public.recipe_ingredients
     WHERE recipe_id = v_recipe AND inventory_id = v_inv AND qty_normal = 2 AND qty_less = 1 AND qty_more = 3;
    SELECT count(*) INTO n2 FROM public.recipe_ingredients WHERE recipe_id = v_recipe;
    r2 := pg_temp.t057_try('authenticated', v_owner, format('SELECT public.save_recipe_cost(%L, true, 1, ''[]''::jsonb)', v_recipe));
    r3 := pg_temp.t057_try('authenticated', v_owner, format('SELECT public.save_recipe_cost(%L, true, 1, %L::jsonb)', gen_random_uuid(),
            json_build_array(json_build_object('inventory_id', v_inv, 'qty_normal', 1))::text));
    report := report || CASE WHEN r = 'ok:1' AND n = 1 AND n2 = 1 AND r2 LIKE 'error 22023%' AND r3 LIKE 'error P0002%'
          AND (SELECT cost_per_cup_lak = 4321 AND uses_ice FROM public.recipes WHERE id = v_recipe)
        THEN 'PASS' ELSE 'FAIL' END
      || format(' T10 save recipe: %s, lines now %s; empty recipe refused (%s); unknown menu refused (%s)',
                r, n2, left(r2, 11), left(r3, 11)) || E'\n';

    -- T11 a manager: stock and recipes yes, menu and price no
    IF v_owner2 IS NULL THEN
      report := report || 'SKIP T11-T12 the real shop has only one owner account to try as manager' || E'\n';
    ELSE
      UPDATE public.shop_users SET role = 'manager' WHERE shop_id = c_shop AND user_id = v_owner2;
      r  := pg_temp.t057_try('authenticated', v_owner2, format('SELECT public.toggle_recipe_active(%L)', v_recipe));
      r2 := pg_temp.t057_try('authenticated', v_owner2, format('UPDATE public.recipes SET price_lak = price_lak + 1 WHERE id = %L', v_recipe));
      r3 := pg_temp.t057_try('authenticated', v_owner2, format('SELECT public.add_stock(%L, 1, 0, ''T057'', now())', v_inv));
      r4 := pg_temp.t057_try('authenticated', v_owner2, format('SELECT public.save_recipe_cost(%L, false, 10, %L::jsonb)', v_recipe,
              json_build_array(json_build_object('inventory_id', v_inv, 'qty_normal', 1))::text));
      r5 := pg_temp.t057_try('authenticated', v_owner2, 'INSERT INTO public.recipe_bases (name, unit, yield_qty) VALUES (''T057'', ''ml'', 1)');
      r6 := pg_temp.t057_try('authenticated', v_owner2, 'SELECT public.create_category(''T057 cat2'', ''T057'', ''T057'', NULL, NULL, NULL, 99)');
      report := report || CASE WHEN r = 'denied' AND r2 = 'ok:0' AND r3 = 'ok:1' AND r4 = 'ok:1' AND r5 = 'ok:1' AND r6 = 'denied'
          THEN 'PASS' ELSE 'FAIL' END
        || format(' T11 a manager: menu on/off %s, price %s, new category %s (all refused); add stock %s, save recipe %s, base recipe %s (all allowed)',
                  r, r2, r6, r3, r4, r5) || E'\n';

      -- T12 an account that was switched off
      UPDATE public.shop_users SET active = false WHERE shop_id = c_shop AND user_id = v_owner2;
      r  := pg_temp.t057_try('authenticated', v_owner2, format('SELECT public.add_stock(%L, 1, 0, ''T057'', now())', v_inv));
      r2 := pg_temp.t057_try('authenticated', v_owner2, 'SELECT salary FROM public.staff');
      report := report || CASE WHEN r = 'denied' AND r2 = 'ok:0' THEN 'PASS' ELSE 'FAIL' END
        || format(' T12 a switched-off account: add stock %s, staff pay rows %s', r, r2) || E'\n';
    END IF;
  END IF;

  -- T13 things created from now on are closed to the public
  CREATE TABLE public.t057_new_table (id int);
  CREATE FUNCTION public.t057_new_fn() RETURNS int LANGUAGE sql AS 'SELECT 1';
  report := report || CASE WHEN NOT has_table_privilege('anon', 'public.t057_new_table', 'SELECT')
        AND NOT has_table_privilege('anon', 'public.t057_new_table', 'INSERT')
        AND NOT has_function_privilege('anon', 'public.t057_new_fn()', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.t057_new_fn()', 'EXECUTE')
      THEN 'PASS' ELSE 'FAIL' END
    || ' T13 a new table / function is not open to anon by default' || E'\n';

  -- T14 policies
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND 'anon' = ANY (roles) AND cmd <> 'SELECT'
     AND tablename IN ('recipes', 'recipe_ingredients', 'recipe_bases', 'recipe_base_ingredients',
                       'cost_ingredients', 'cost_base_recipes', 'cost_formulas');
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END
    || format(' T14 anon write policies left on menu / recipe / cost tables: %s', n) || E'\n';

  RAISE EXCEPTION E'057 TEST RESULTS (everything rolled back, nothing changed):\n%', report;
END
$test$;
