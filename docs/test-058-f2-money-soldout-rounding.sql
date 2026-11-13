-- ============================================================
--  Test for migration 058 (package F, set 2: money tables, sold-out
--  button, discount rounding)
--
--  CHANGES NOTHING. The whole file is ONE DO block that always ends in
--  an error ("058 TEST RESULTS ..."), so Postgres rolls everything back:
--  the policies, the rights, the test sale and every test row. The error
--  message IS the report: every line should start with PASS or SKIP.
--  No BEGIN/ROLLBACK needed (the SQL Editor does not keep a BEGIN open).
--
--  It adds one throw-away sign-in (auth.users row, no email or password)
--  for the stranger / manager checks; it is rolled back too.
--  T8 makes ONE test sale inside the block (rolled back) to prove a sale
--  still posts to cash_flow. The Telegram "large order" trigger is
--  switched off first inside the block, so nothing is sent.
--  Callers are simulated the way the website does it: role anon /
--  authenticated plus request.jwt.claims (which auth.uid() reads).
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor) as postgres:
--  paste the whole file, Run, copy the error text back.
--  The migration part is a generated copy of
--  supabase/migrations/058_f2_money_soldout_rounding.sql -- keep in sync.
-- ============================================================

DO $test$
DECLARE
  c_shop constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  report text := '';
  r text; r2 text; r3 text; r4 text; r5 text;
  n int; n2 int; v_num numeric; v_num2 numeric;
  b_data text; b_sell text;
  v_owner uuid; v_stranger uuid := gen_random_uuid();
  v_recipe uuid; v_price numeric; v_active boolean;
  v_res jsonb; v_order uuid; v_disc numeric; v_total numeric;
BEGIN
  SELECT user_id INTO v_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active IS TRUE AND user_id IS NOT NULL ORDER BY user_id LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION '058 TEST: the real shop has no active owner account'; END IF;
  -- a throw-away sign-in for the "stranger" / "manager" checks: no email, no
  -- password, nobody can log in with it, and it is rolled back with the rest
  INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_stranger, 'authenticated', 'authenticated', now(), now());
  SELECT id, price_lak INTO v_recipe, v_price FROM public.recipes
   WHERE COALESCE(is_active, true) AND NOT COALESCE(is_archived, false) AND price_lak > 0
   ORDER BY created_at, id LIMIT 1;

  SELECT md5(
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.cash_flow t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.initial_capital t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.budgets t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipes t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.key), '') FROM public.site_settings t)) INTO b_data;
  SELECT md5(string_agg(pg_get_functiondef(p.oid), '|' ORDER BY p.oid::regprocedure::text)) INTO b_sell
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN ('checkout_order', 'void_order_with_approval', 'get_site_settings', 'update_site_setting');

  -- ---- body of 058 ----
  -- 1) money tables: anon out, the signed-in owner in
  DROP POLICY IF EXISTS anon_all_cash_flow ON public.cash_flow;
  DROP POLICY IF EXISTS f_cash_flow_owner ON public.cash_flow;
  CREATE POLICY f_cash_flow_owner ON public.cash_flow
    FOR ALL TO authenticated
    USING (public.real_shop_role_in(ARRAY['owner']))
    WITH CHECK (public.real_shop_role_in(ARRAY['owner']));

  DROP POLICY IF EXISTS anon_all_initial_capital ON public.initial_capital;
  DROP POLICY IF EXISTS f_initial_capital_owner ON public.initial_capital;
  CREATE POLICY f_initial_capital_owner ON public.initial_capital
    FOR ALL TO authenticated
    USING (public.real_shop_role_in(ARRAY['owner']))
    WITH CHECK (public.real_shop_role_in(ARRAY['owner']));

  DROP POLICY IF EXISTS anon_all_budgets ON public.budgets;
  DROP POLICY IF EXISTS f_budgets_owner ON public.budgets;
  CREATE POLICY f_budgets_owner ON public.budgets
    FOR ALL TO authenticated
    USING (public.real_shop_role_in(ARRAY['owner']))
    WITH CHECK (public.real_shop_role_in(ARRAY['owner']));

  REVOKE ALL ON public.cash_flow, public.initial_capital, public.budgets FROM anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_flow, public.initial_capital, public.budgets TO authenticated;

  -- 2) the triggers that post sales / purchases into cash_flow must keep
  --    working whoever changes the order or purchase row
  ALTER FUNCTION public.trg_fn_order_to_cashflow() SECURITY DEFINER;
  ALTER FUNCTION public.trg_fn_order_to_cashflow() SET search_path = public, pg_temp;
  ALTER FUNCTION public.trg_fn_purchase_to_cashflow() SECURITY DEFINER;
  ALTER FUNCTION public.trg_fn_purchase_to_cashflow() SET search_path = public, pg_temp;
  REVOKE ALL ON FUNCTION public.trg_fn_order_to_cashflow() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.trg_fn_purchase_to_cashflow() FROM PUBLIC, anon, authenticated;

  -- 3) finance read functions. These run as the caller, so the table rules
  --    above already decide what they see; take the anon right away too.
  EXECUTE $do$DO $mig$
  DECLARE
    r record;
    v_oid oid;
    v_n int;
  BEGIN
    FOR r IN
      SELECT * FROM (VALUES
        ('get_budget_summary'),
        ('get_cash_flow_entries'),
        ('get_cash_flow_summary'),
        ('get_current_cash_balance'),
        ('get_daily_cashflow')
      ) AS t(fn)
    LOOP
      SELECT count(*), min(p.oid) INTO v_n, v_oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = r.fn;
      IF v_n <> 1 THEN
        RAISE EXCEPTION '058: expected exactly 1 function public.%, found %', r.fn, v_n;
      END IF;
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_oid::regprocedure);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_oid::regprocedure);
    END LOOP;
  END
  $mig$$do$;

  --    get_cashflow_summary (closed-shift cash counts, used by the back
  --    office AI panel) runs as its owner, so it gets the owner check.
  --    Same query as before.
  CREATE OR REPLACE FUNCTION public.get_cashflow_summary(p_days integer DEFAULT 7)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  BEGIN
    PERFORM public.require_real_shop_role(ARRAY['owner']);
    RETURN (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'log_date',     log_date,
          'shift',        shift,
          'system_sales', system_sales,
          'actual_cash',  actual_cash,
          'variance_lak', variance_lak
        ) ORDER BY log_date DESC, shift
      ), '[]')
      FROM cashflow_logs
      WHERE log_date >= CURRENT_DATE - p_days
    );
  END
  $fn$;
  REVOKE ALL ON FUNCTION public.get_cashflow_summary(integer) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_cashflow_summary(integer) TO authenticated, service_role;

  -- 4) old checkout and old shift-cash functions: no screen calls them
  --    (checkout_order replaced them in 055). Kept in the database, but only
  --    the service role may call them.
  EXECUTE $do$DO $mig$
  DECLARE
    r record;
  BEGIN
    FOR r IN
      SELECT p.oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('create_order_with_deduction', 'finalize_order_payment', 'get_shift_cash_summary')
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.oid::regprocedure);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.oid::regprocedure);
    END LOOP;
  END
  $mig$$do$;

  -- 5) sold-out button: a manager may switch a menu item on / off
  --    (057 set it to owner only; the price still needs the owner)
  EXECUTE $do$DO $mig$
  DECLARE
    v_n int;
    v_oid oid;
    v_def text;
    v_new text;
  BEGIN
    SELECT count(*), min(p.oid) INTO v_n, v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'toggle_recipe_active';
    IF v_n <> 1 THEN
      RAISE EXCEPTION '058: expected exactly 1 function public.toggle_recipe_active, found %', v_n;
    END IF;
    v_def := pg_get_functiondef(v_oid);
    IF position('require_real_shop_role(''{owner}''::text[])' IN v_def) > 0 THEN
      v_new := replace(v_def,
        'require_real_shop_role(''{owner}''::text[])',
        'require_real_shop_role(''{owner,manager}''::text[])');
      EXECUTE v_new;
    ELSIF position('{owner,manager}' IN v_def) = 0 THEN
      RAISE EXCEPTION '058: toggle_recipe_active has no owner check to widen (run 057 first)';
    END IF;
  END
  $mig$$do$;

  -- 6) menu items: hide (archive) only, never delete. A deleted item takes
  --    its name out of every old bill and report.
  --    The two old get_my_role() rules ("owner/manager: all on recipes") go
  --    too: through them a manager with a row in the old staff table could
  --    still change prices. Reading the menu is not affected.
  DROP POLICY IF EXISTS "manager: all on recipes" ON public.recipes;
  DROP POLICY IF EXISTS "owner: all on recipes" ON public.recipes;
  DROP POLICY IF EXISTS f_recipes_owner_write ON public.recipes;
  DROP POLICY IF EXISTS f_recipes_owner_insert ON public.recipes;
  DROP POLICY IF EXISTS f_recipes_owner_update ON public.recipes;
  CREATE POLICY f_recipes_owner_insert ON public.recipes
    FOR INSERT TO authenticated
    WITH CHECK (public.real_shop_role_in(ARRAY['owner']));
  CREATE POLICY f_recipes_owner_update ON public.recipes
    FOR UPDATE TO authenticated
    USING (public.real_shop_role_in(ARRAY['owner']))
    WITH CHECK (public.real_shop_role_in(ARRAY['owner']));
  REVOKE DELETE ON public.recipes FROM anon, authenticated;

  -- 7) new shop setting: round the amount to pay down to 500 or 1,000 kip
  --    when a bill has a discount (the app treats a missing value as 1,000)
  EXECUTE $do$DO $mig$
  DECLARE
    v_keys text[];
  BEGIN
    v_keys := public.site_settings_public_keys();
    IF NOT ('discount_round_step' = ANY (v_keys)) THEN
      EXECUTE format(
        'CREATE OR REPLACE FUNCTION public.site_settings_public_keys() RETURNS text[] LANGUAGE sql STABLE AS $f$SELECT %L::text[]$f$',
        array_append(v_keys, 'discount_round_step'));
    END IF;
  END
  $mig$$do$;
  -- ---- end of 058 body ----

  -- helper: run one statement as a given caller; returns ok:<rows> / denied / error
  CREATE FUNCTION pg_temp.t058_try(p_role text, p_sub uuid, p_sql text) RETURNS text
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
  GRANT EXECUTE ON FUNCTION pg_temp.t058_try(text, uuid, text) TO anon, authenticated;

  -- T1 the migration itself changed no data
  SELECT md5(
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.cash_flow t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.initial_capital t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.budgets t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.id), '') FROM public.recipes t) ||
    (SELECT COALESCE(string_agg(t::text, '|' ORDER BY t.key), '') FROM public.site_settings t)) INTO r;
  report := report || CASE WHEN r = b_data THEN 'PASS' ELSE 'FAIL' END
    || ' T1 money records, menu and settings are exactly as before' || E'\n';

  -- T2 selling functions untouched
  SELECT md5(string_agg(pg_get_functiondef(p.oid), '|' ORDER BY p.oid::regprocedure::text)) INTO r
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN ('checkout_order', 'void_order_with_approval', 'get_site_settings', 'update_site_setting');
  report := report || CASE WHEN r = b_sell THEN 'PASS' ELSE 'FAIL' END
    || ' T2 checkout / void / settings functions unchanged' || E'\n';

  -- T3 the public key can no longer read or change money records
  r  := pg_temp.t058_try('anon', NULL, 'SELECT * FROM public.cash_flow');
  r2 := pg_temp.t058_try('anon', NULL, 'INSERT INTO public.cash_flow (type, category, amount_lak) VALUES ($q$income$q$, $q$t$q$, 1)');
  r3 := pg_temp.t058_try('anon', NULL, 'DELETE FROM public.budgets');
  r4 := pg_temp.t058_try('anon', NULL, 'SELECT * FROM public.initial_capital');
  r5 := pg_temp.t058_try('anon', NULL, 'SELECT public.get_current_cash_balance()');
  report := report || CASE WHEN r = 'denied' AND r2 = 'denied' AND r3 = 'denied' AND r4 = 'denied' AND r5 = 'denied' THEN 'PASS' ELSE 'FAIL' END
    || format(' T3 public key: read cash_flow %s, add %s, delete budgets %s, read capital %s, balance %s', r, r2, r3, r4, r5) || E'\n';

  -- T4 a signed-up stranger sees nothing and changes nothing
  r  := pg_temp.t058_try('authenticated', v_stranger, 'SELECT * FROM public.cash_flow');
  r2 := pg_temp.t058_try('authenticated', v_stranger, 'INSERT INTO public.cash_flow (type, category, amount_lak) VALUES ($q$income$q$, $q$t$q$, 1)');
  r3 := pg_temp.t058_try('authenticated', v_stranger, 'DELETE FROM public.cash_flow');
  r4 := pg_temp.t058_try('authenticated', v_stranger, 'SELECT public.get_cashflow_summary(30)');
  report := report || CASE WHEN r = 'ok:0' AND r2 = 'denied' AND r3 = 'ok:0' AND r4 = 'denied' THEN 'PASS' ELSE 'FAIL' END
    || format(' T4 stranger account: read %s, add %s, delete %s, shift summary %s', r, left(r2, 60), r3, left(r4, 60)) || E'\n';

  -- T5 the owner still sees and keeps the books
  SELECT count(*) INTO n FROM public.cash_flow;
  r  := pg_temp.t058_try('authenticated', v_owner, 'SELECT * FROM public.cash_flow');
  r2 := pg_temp.t058_try('authenticated', v_owner, 'INSERT INTO public.cash_flow (type, category, amount_lak, description) VALUES ($q$expense$q$, $q$058 test$q$, 1, $q$058 test$q$)');
  r3 := pg_temp.t058_try('authenticated', v_owner, 'DELETE FROM public.cash_flow WHERE description = $q$058 test$q$');
  r4 := pg_temp.t058_try('authenticated', v_owner, 'SELECT public.get_cashflow_summary(30)');
  r5 := pg_temp.t058_try('authenticated', v_owner, 'SELECT public.get_current_cash_balance(), public.get_budget_summary()');
  report := report || CASE WHEN r = 'ok:' || n AND r2 = 'ok:1' AND r3 = 'ok:1' AND r4 = 'ok:1' AND r5 LIKE 'ok:%' THEN 'PASS' ELSE 'FAIL' END
    || format(' T5 owner account: read %s (want ok:%s), add %s, delete %s, shift summary %s, balance + budgets %s', r, n, r2, r3, left(r4, 60), left(r5, 60)) || E'\n';

  -- T6 old checkout / old shift-cash functions are closed to the app
  SELECT count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE')),
         count(*)
    INTO n, n2
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN ('create_order_with_deduction', 'finalize_order_payment', 'get_shift_cash_summary');
  report := report || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END
    || format(' T6 old checkout functions still callable from the app: %s of %s', n, n2) || E'\n';

  -- T7 sold-out button: a manager may switch an item on/off but not change its price;
  --    nobody may delete a menu item
  IF v_recipe IS NULL THEN
    report := report || 'SKIP T7 no active menu item' || E'\n';
  ELSE
    INSERT INTO public.shop_users (shop_id, user_id, email, role, active)
    VALUES (c_shop, v_stranger, '058-test-manager@invalid.local', 'manager', true);
    r  := pg_temp.t058_try('authenticated', v_stranger, format('SELECT public.toggle_recipe_active(%L)', v_recipe));
    SELECT is_active INTO v_active FROM public.recipes WHERE id = v_recipe;
    r2 := pg_temp.t058_try('authenticated', v_stranger, format('UPDATE public.recipes SET price_lak = 1 WHERE id = %L', v_recipe));
    r3 := pg_temp.t058_try('authenticated', v_owner, format('DELETE FROM public.recipes WHERE id = %L', v_recipe));
    r4 := pg_temp.t058_try('authenticated', v_owner, format('UPDATE public.recipes SET is_archived = is_archived WHERE id = %L', v_recipe));
    SELECT count(*) INTO n FROM public.recipes WHERE id = v_recipe AND price_lak = v_price;
    report := report || CASE WHEN r = 'ok:1' AND v_active IS FALSE AND r2 = 'ok:0' AND r3 = 'denied' AND r4 = 'ok:1' AND n = 1 THEN 'PASS' ELSE 'FAIL' END
      || format(' T7 manager sold-out %s (item now active=%s), manager price change %s, owner delete %s, owner edit %s, price kept %s',
                left(r, 60), v_active, left(r2, 60), left(r3, 60), left(r4, 60), n) || E'\n';
    UPDATE public.recipes SET is_active = true WHERE id = v_recipe;

    -- T7b the same manager with a row in the old staff table still cannot change prices
    INSERT INTO public.staff (id, name, role) VALUES (v_stranger, '058 test', 'manager');
    r  := pg_temp.t058_try('authenticated', v_stranger, format('UPDATE public.recipes SET price_lak = 1 WHERE id = %L', v_recipe));
    SELECT count(*) INTO n FROM public.recipes WHERE id = v_recipe AND price_lak = v_price;
    report := report || CASE WHEN r = 'ok:0' AND n = 1 THEN 'PASS' ELSE 'FAIL' END
      || format(' T7b manager with an old staff row: price change %s, price kept %s', left(r, 60), n) || E'\n';

    -- T10 finance is owner only: a real manager of the shop sees and changes nothing
    r  := pg_temp.t058_try('authenticated', v_stranger, 'SELECT * FROM public.cash_flow');
    r2 := pg_temp.t058_try('authenticated', v_stranger, 'INSERT INTO public.budgets (category, monthly_budget_lak) VALUES ($q$058 test$q$, 1)');
    r3 := pg_temp.t058_try('authenticated', v_stranger, 'SELECT * FROM public.initial_capital');
    r4 := pg_temp.t058_try('authenticated', v_stranger, 'SELECT public.get_cashflow_summary(30)');
    r5 := pg_temp.t058_try('authenticated', v_stranger, 'UPDATE public.cash_flow SET amount_lak = amount_lak');
    report := report || CASE WHEN r = 'ok:0' AND r2 = 'denied' AND r3 = 'ok:0' AND r4 = 'denied' AND r5 = 'ok:0' THEN 'PASS' ELSE 'FAIL' END
      || format(' T10 manager account on money records: read %s, add budget %s, read capital %s, shift summary %s, change %s',
                r, left(r2, 60), r3, left(r4, 60), r5) || E'\n';
  END IF;

  -- T8 a sale with a rounded 5% discount is accepted and still posts to cash_flow
  --    (sent as an offline replay so a low stock count cannot block the test)
  IF v_recipe IS NULL THEN
    report := report || 'SKIP T8 no active menu item' || E'\n';
  ELSE
    ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;
    v_total := floor(v_price * 3 * 0.95 / 1000) * 1000;
    v_disc := v_price * 3 - v_total;
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('role', 'anon', true);
    v_res := public.checkout_order(gen_random_uuid(), c_shop, NULL,
      jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 3)),
      NULL, 'cash', v_total, v_disc, '058 test', NULL, NULL, NULL, false, v_total,
      now() - interval '1 minute', NULL);
    RESET ROLE;
    v_order := (v_res ->> 'order_id')::uuid;
    SELECT count(*), max(amount_lak) INTO n, v_num FROM public.cash_flow WHERE reference_id = v_order AND type = 'income';
    SELECT total_lak, discount_amount INTO v_num2, v_disc FROM public.orders WHERE id = v_order;
    report := report || CASE WHEN v_order IS NOT NULL AND n = 1 AND v_num = v_total AND v_num2 = v_total
                              AND (v_res ->> 'total_lak')::numeric = v_total THEN 'PASS' ELSE 'FAIL' END
      || format(' T8 test sale 3 x %s with 5%% off: bill total %s (want %s), discount %s, cash_flow rows %s amount %s',
                v_price, v_num2, v_total, v_disc, n, v_num) || E'\n';
  END IF;

  -- T9 the new setting: owner can save it, the selling screen can read it
  r  := pg_temp.t058_try('authenticated', v_owner, 'SELECT public.update_site_setting($q$discount_round_step$q$, $q$500$q$)');
  r2 := pg_temp.t058_try('authenticated', v_stranger, 'SELECT public.update_site_setting($q$discount_round_step$q$, $q$1000$q$)');
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
  r3 := public.get_site_settings() ->> 'discount_round_step';
  RESET ROLE;
  report := report || CASE WHEN r = 'ok:1' AND r2 = 'denied' AND r3 = '500' THEN 'PASS' ELSE 'FAIL' END
    || format(' T9 rounding setting: owner save %s, manager save %s, selling screen reads %s', left(r, 60), left(r2, 60), r3) || E'\n';

  RAISE EXCEPTION E'058 TEST RESULTS (everything rolled back, nothing changed):\n%', report;
END
$test$;
