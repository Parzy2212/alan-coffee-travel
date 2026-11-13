-- ============================================================
--  058  Package F, set 2: money tables, sold-out button, discount rounding
--
--  Before: anyone holding the public anon key (it ships in the web page)
--  could read, add, change and delete the shop's money records
--  (cash_flow, initial_capital, budgets) and call the old checkout
--  functions that no screen uses any more.
--  After (owner decisions 2026-11-13):
--    cash_flow / initial_capital / budgets -> signed-in OWNER of the real shop only
--    old checkout + old cash summary functions -> nobody from the app
--    sold-out button (toggle_recipe_active) -> OWNER or MANAGER (price stays owner only)
--    menu items can no longer be deleted (hide = archive only)
--    new shop setting discount_round_step (500 / 1000, the app defaults to 1000)
--  Selling is not touched: sales still go through checkout_order, and the
--  two cash_flow triggers keep writing sales / purchases (they now run as
--  the function owner, so a sale never fails because of these rules).
--
--  Safe to run twice. Test first: docs/test-058-f2-money-soldout-rounding.sql
--  Run this migration, then push the matching app code: between the two,
--  the finance page shows nothing for the public role (selling works).
-- ============================================================

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
DO $mig$
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
$mig$;

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
DO $mig$
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
$mig$;

-- 5) sold-out button: a manager may switch a menu item on / off
--    (057 set it to owner only; the price still needs the owner)
DO $mig$
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
$mig$;

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
DO $mig$
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
$mig$;
