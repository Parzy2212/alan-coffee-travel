-- ============================================================
--  Test for migration 053 (void a bill only with a manager PIN)
--
--  DO NOT RE-RUN. Run on production 2026-11-10, the Supabase SQL Editor
--  did not keep this BEGIN open: the top-level statements (Telegram
--  trigger off, 053 body) and the whole test DO block committed; only the
--  report block failed. The claim below is wrong for that editor.
--  Cleanup check: docs/check-053-leftovers.sql.
--
--  CHANGES NOTHING. Everything runs in one transaction that always ends
--  in an error ("053 TEST RESULTS ...") so Postgres rolls it all back:
--  the 053 changes, a test sale made through the live
--  create_order_with_deduction, temporary employees and customer, the
--  stock top-up, a temporary second shop with its own manager, the
--  temporary deactivation of real employees, and the PIN attempt
--  counters. The error message IS the report: every line
--  should start with PASS.
--  After reading the report, run `ROLLBACK;` on its own once so the
--  aborted transaction stops holding locks.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor) as postgres.
--  The 053 body below is a copy of
--  supabase/migrations/053_void_order_with_approval.sql -- keep in sync.
--  Calls are made as role anon, the way the POS makes them.
-- ============================================================

BEGIN;

-- The test sale is 50,000 LAK (under the 500,000 threshold), but the trigger code was not
-- reviewed, so it is switched off for this transaction only (the final rollback restores it).
-- This locks orders until the transaction ends: run ROLLBACK; right after the report.
ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;

-- ---- 053 body (copy) ----
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voided_by_employee_id uuid REFERENCES public.employees(id);

CREATE OR REPLACE FUNCTION public.void_order_with_approval(
  p_order_id    uuid,
  p_shop_id     uuid,
  p_manager_pin text,
  p_reason      text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order    public.orders%ROWTYPE;
  v_reason   text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_scope    text := 'void:' || p_shop_id::text;
  v_wait     int;
  v_mgr_id   uuid;
  v_mgr_name text;
  v_earn_pts int;
  v_earn_n   int;
  v_now      timestamptz := now();
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to void a bill' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;
  -- create_order_with_deduction leaves shop_id NULL, so NULL means the real shop
  -- (anyone can onboard a shop and add a manager of their own).
  IF COALESCE(v_order.shop_id, '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid) IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'order belongs to another shop' USING ERRCODE = '42501';
  END IF;
  IF v_order.status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'ORDER_NOT_PAID' USING DETAIL = COALESCE(v_order.status, 'null'),
      HINT = 'only a paid bill can be voided';
  END IF;

  v_wait := public.pin_attempt_wait(v_scope);
  IF v_wait > 0 THEN
    RAISE EXCEPTION 'PIN_LOCKED' USING DETAIL = v_wait::text, HINT = 'retry after ' || v_wait || ' seconds';
  END IF;

  SELECT e.id, e.name INTO v_mgr_id, v_mgr_name
  FROM public.employees e
  WHERE e.shop_id = p_shop_id
    AND e.is_active = true
    AND e.role = 'manager'
    AND p_manager_pin ~ '^[0-9]{4}$'
    AND e.pin_hash = extensions.crypt(p_manager_pin, e.pin_hash)
  LIMIT 1;

  -- Own scope: only a manager PIN counts as success, so a cashier's PIN cannot reset
  -- the counter. No RAISE after this on a failed PIN: it would roll the count back.
  PERFORM public.pin_attempt_record(v_scope, v_mgr_id IS NOT NULL, 5, 60, 1800);
  IF v_mgr_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  UPDATE public.orders
  SET status = 'void',
      void_reason = v_reason,
      voided_at = v_now,
      voided_by_employee_id = v_mgr_id
  WHERE id = p_order_id;

  UPDATE public.inventory i
  SET current_qty = i.current_qty + restore.qty,
      updated_at  = v_now
  FROM (
    SELECT ri.inventory_id, SUM(oi.qty * ri.qty_normal) AS qty
    FROM public.order_items oi
    JOIN public.recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
    WHERE oi.order_id = p_order_id AND ri.inventory_id IS NOT NULL
    GROUP BY ri.inventory_id
  ) restore
  WHERE i.id = restore.inventory_id;

  IF v_order.customer_id IS NOT NULL THEN
    SELECT COALESCE(SUM(points), 0), count(*) INTO v_earn_pts, v_earn_n
    FROM public.loyalty_transactions
    WHERE order_id = p_order_id AND type = 'earn';

    UPDATE public.customers
    SET lifetime_spend_lak = GREATEST(0, COALESCE(lifetime_spend_lak, 0)
                               - COALESCE(v_order.total_lak, 0) * (1 + LEAST(v_earn_n, 1))),
        visit_count        = GREATEST(0, COALESCE(visit_count, 0) - (1 + LEAST(v_earn_n, 1))),
        loyalty_points     = GREATEST(0, COALESCE(loyalty_points, 0) - v_earn_pts)
    WHERE id = v_order.customer_id;

    IF v_earn_pts > 0 THEN
      INSERT INTO public.loyalty_transactions (shop_id, customer_id, order_id, type, points, description)
      SELECT shop_id, customer_id, order_id, 'adjust', -v_earn_pts,
             'Voided order #' || COALESCE(v_order.queue_number::text, '?')
      FROM public.loyalty_transactions
      WHERE order_id = p_order_id AND type = 'earn'
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (staff_id, action, table_name, row_id, after_data)
  VALUES (
    v_order.staff_id, 'void_order', 'orders', p_order_id,
    jsonb_build_object(
      'order_id', p_order_id, 'queue_number', v_order.queue_number,
      'total_lak', v_order.total_lak, 'reason', v_reason,
      'approved_by_employee_id', v_mgr_id, 'approved_by', v_mgr_name,
      'voided_at', v_now
    )
  );

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'voided_at', v_now, 'approved_by', v_mgr_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.void_order_with_approval(uuid, uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.void_order_with_approval(uuid, uuid, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.void_order(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_queue_number()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next
  FROM orders
  WHERE (created_at AT TIME ZONE 'Asia/Vientiane')::DATE
    = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  RETURN v_next;
END;
$$;
-- ---- end of 053 body ----

CREATE TEMP TABLE t053 (n INT, name TEXT, result TEXT);

-- Calls void_order_with_approval as anon; returns 'OK <json>' or 'ERR <sqlstate> <message>'
CREATE FUNCTION pg_temp.try_void(p_order uuid, p_shop uuid, p_pin text, p_reason text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v jsonb;
BEGIN
  BEGIN
    PERFORM set_config('role', 'anon', true);
    SELECT public.void_order_with_approval(p_order, p_shop, p_pin, p_reason) INTO v;
    RESET ROLE;
    RETURN 'OK ' || v::text;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN 'ERR ' || SQLSTATE || ' ' || SQLERRM;
  END;
END;
$$;

-- Inventory quantities of the given recipe's ingredients, as {inventory_id: qty}
CREATE FUNCTION pg_temp.stock_of(p_recipe uuid)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_object_agg(id::text, current_qty) FROM public.inventory
  WHERE id IN (SELECT inventory_id FROM public.recipe_ingredients
               WHERE recipe_id = p_recipe AND inventory_id IS NOT NULL)
$$;

CREATE FUNCTION pg_temp.void_fails()
RETURNS int LANGUAGE sql AS $$
  SELECT COALESCE((SELECT fail_count FROM public.pin_attempts
                   WHERE scope = 'void:9afdd9eb-728d-4e36-8077-492c92dbef30'), 0)
$$;

DO $$
DECLARE
  real_shop   CONSTANT uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  mgr_pin     CONSTANT text := '8642';
  cashier_pin CONSTANT text := '7531';
  other_pin   CONSTANT text := '9753';
  mgr_id      uuid;
  other_shop  uuid;
  cust_id     uuid;
  recipe      uuid;
  v_order_id  uuid;
  queue_no    int;
  r           text;
  r2          text;
  res         jsonb;
  ord         record;
  before_sale jsonb;
  after_sale  jsonb;
  cust_before record;
  cust_now    record;
  pad_rows    int;
BEGIN
  -- Isolate: no real employee can match the test PINs, no leftover counters
  UPDATE public.employees SET is_active = false WHERE shop_id = real_shop;
  DELETE FROM public.pin_attempts
  WHERE scope IN ('void:9afdd9eb-728d-4e36-8077-492c92dbef30', 'shop:9afdd9eb-728d-4e36-8077-492c92dbef30');

  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (real_shop, 'test053 manager', 'manager', extensions.crypt(mgr_pin, extensions.gen_salt('bf')), true)
  RETURNING id INTO mgr_id;
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (real_shop, 'test053 cashier', 'cashier', extensions.crypt(cashier_pin, extensions.gen_salt('bf')), true);

  -- A second shop with a manager of its own (what anyone can create by onboarding)
  INSERT INTO public.shops (slug, name) VALUES ('test053-' || substr(md5(random()::text), 1, 10), 'test053 other shop')
  RETURNING id INTO other_shop;
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (other_shop, 'test053 other manager', 'manager', extensions.crypt(other_pin, extensions.gen_salt('bf')), true);

  INSERT INTO public.customers (phone, name)
  VALUES ('test053-' || substr(md5(random()::text), 1, 10), 'test053 customer')
  RETURNING id INTO cust_id;
  SELECT COALESCE(lifetime_spend_lak, 0) AS spend, COALESCE(visit_count, 0) AS visits, COALESCE(loyalty_points, 0) AS pts
  INTO cust_before FROM public.customers WHERE id = cust_id;

  -- An active recipe that deducts at least one inventory item
  SELECT r3.id INTO recipe FROM public.recipes r3
  WHERE r3.is_active IS TRUE
    AND EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.recipe_id = r3.id AND ri.inventory_id IS NOT NULL)
  LIMIT 1;
  IF recipe IS NULL THEN
    RAISE EXCEPTION '053 TEST: no active recipe with an inventory ingredient, cannot test';
  END IF;

  -- Enough stock for the sale (rolled back), then snapshot
  UPDATE public.inventory SET current_qty = current_qty + 100000
  WHERE id IN (SELECT inventory_id FROM public.recipe_ingredients WHERE recipe_id = recipe AND inventory_id IS NOT NULL);
  before_sale := pg_temp.stock_of(recipe);

  -- T1 grants
  INSERT INTO t053 SELECT 1, 'grants: new fn anon=t auth=t, void_order anon=f auth=f',
    CASE WHEN has_function_privilege('anon', 'public.void_order_with_approval(uuid,uuid,text,text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.void_order_with_approval(uuid,uuid,text,text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.void_order(uuid,text)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.void_order(uuid,text)', 'EXECUTE')
         THEN 'PASS' ELSE 'FAIL' END;

  -- T2 a sale through the live create_order_with_deduction, as anon (2 cups, customer linked)
  PERFORM set_config('role', 'anon', true);
  SELECT public.create_order_with_deduction(
    jsonb_build_array(jsonb_build_object('recipe_id', recipe, 'qty', 2, 'unit_price_lak', 25000, 'customization', null)),
    p_customer_id := cust_id) INTO res;
  RESET ROLE;
  v_order_id := (res->>'order_id')::uuid;
  queue_no := (res->>'queue_number')::int;
  after_sale := pg_temp.stock_of(recipe);
  SELECT status, shop_id, total_lak INTO ord FROM public.orders WHERE id = v_order_id;
  INSERT INTO t053 VALUES (2, 'setup: test sale 50,000 LAK created as paid (shop_id NULL or real shop), stock deducted',
    CASE WHEN ord.status = 'paid' AND ord.total_lak = 50000 AND after_sale <> before_sale
          AND (ord.shop_id IS NULL OR ord.shop_id = real_shop) THEN 'PASS'
         ELSE 'FAIL: status=' || COALESCE(ord.status, 'NULL') || ' stock changed=' || (after_sale <> before_sale)::text END);

  -- T3 empty reason
  r := pg_temp.try_void(v_order_id, real_shop, mgr_pin, '   ');
  INSERT INTO t053 VALUES (3, 'empty reason -> refused',
    CASE WHEN r LIKE 'ERR 22023 %reason%' THEN 'PASS' ELSE 'FAIL: ' || r END);

  -- T4 another shop's real manager PIN, and a random shop id: both refused by the shop check
  r  := pg_temp.try_void(v_order_id, other_shop, other_pin, 'test');
  r2 := pg_temp.try_void(v_order_id, gen_random_uuid(), mgr_pin, 'test');
  SELECT status INTO ord FROM public.orders WHERE id = v_order_id;
  INSERT INTO t053 VALUES (4, 'other shop (with its own manager PIN) / random shop -> refused, still paid',
    CASE WHEN r LIKE 'ERR 42501 %another shop%' AND r2 LIKE 'ERR 42501 %another shop%' AND ord.status = 'paid'
         THEN 'PASS' ELSE 'FAIL: ' || r || ' | ' || r2 END);

  -- T5 wrong PIN: {ok:false}, still paid, failure counted in the void scope
  r := pg_temp.try_void(v_order_id, real_shop, '0000', 'test');
  SELECT status INTO ord FROM public.orders WHERE id = v_order_id;
  INSERT INTO t053 VALUES (5, 'wrong PIN -> ok:false invalid_pin, still paid, 1 failure counted',
    CASE WHEN r LIKE '%"error": "invalid_pin"%' AND ord.status = 'paid' AND pg_temp.void_fails() = 1
         THEN 'PASS' ELSE 'FAIL: ' || r || ' fails=' || pg_temp.void_fails() END);

  -- T6 cashier PIN: same answer as a wrong PIN, counted as a failure (does not reset)
  r := pg_temp.try_void(v_order_id, real_shop, cashier_pin, 'test');
  SELECT status INTO ord FROM public.orders WHERE id = v_order_id;
  INSERT INTO t053 VALUES (6, 'cashier PIN -> invalid_pin (no hint), still paid, counter 2 (not reset)',
    CASE WHEN r LIKE '%"error": "invalid_pin"%' AND ord.status = 'paid' AND pg_temp.void_fails() = 2
         THEN 'PASS' ELSE 'FAIL: ' || r || ' fails=' || pg_temp.void_fails() END);

  -- T7 wrong, cashier, wrong -> 5 failures -> locked, even for the manager PIN
  r := pg_temp.try_void(v_order_id, real_shop, '1111', 'test');
  r := pg_temp.try_void(v_order_id, real_shop, cashier_pin, 'test');
  r := pg_temp.try_void(v_order_id, real_shop, '2222', 'test');
  r := pg_temp.try_void(v_order_id, real_shop, mgr_pin, 'test');
  SELECT status INTO ord FROM public.orders WHERE id = v_order_id;
  INSERT INTO t053 VALUES (7, '5 failures incl. cashier PINs -> PIN_LOCKED, even for the manager',
    CASE WHEN r LIKE 'ERR % PIN_LOCKED%' AND ord.status = 'paid' THEN 'PASS' ELSE 'FAIL: ' || r || ' fails=' || pg_temp.void_fails() END);

  -- T8 the PIN pad's counter was never touched by void attempts
  SELECT count(*) INTO pad_rows FROM public.pin_attempts WHERE scope = 'shop:9afdd9eb-728d-4e36-8077-492c92dbef30';
  INSERT INTO t053 VALUES (8, 'PIN pad scope shop:<id> untouched',
    CASE WHEN pad_rows = 0 THEN 'PASS' ELSE 'FAIL: rows=' || pad_rows END);

  DELETE FROM public.pin_attempts WHERE scope = 'void:9afdd9eb-728d-4e36-8077-492c92dbef30';

  -- T9 manager PIN: voided, recorded, stock back to before the sale, counter cleared
  r := pg_temp.try_void(v_order_id, real_shop, mgr_pin, 'test053 reason');
  SELECT status, void_reason, voided_at, voided_by_employee_id INTO ord FROM public.orders WHERE id = v_order_id;
  INSERT INTO t053 VALUES (9, 'manager PIN -> void, reason/time/approver saved, stock = before sale, counter cleared',
    CASE WHEN r LIKE 'OK {"ok": true%' AND ord.status = 'void' AND ord.void_reason = 'test053 reason'
          AND ord.voided_at IS NOT NULL AND ord.voided_by_employee_id = mgr_id AND pg_temp.stock_of(recipe) = before_sale
          AND NOT EXISTS (SELECT 1 FROM public.pin_attempts WHERE scope = 'void:9afdd9eb-728d-4e36-8077-492c92dbef30')
         THEN 'PASS' ELSE 'FAIL: ' || r || ' status=' || COALESCE(ord.status, 'NULL')
              || ' stock_back=' || (pg_temp.stock_of(recipe) = before_sale)::text END);

  -- T10 customer stats back to before the sale
  SELECT COALESCE(lifetime_spend_lak, 0) AS spend, COALESCE(visit_count, 0) AS visits, COALESCE(loyalty_points, 0) AS pts
  INTO cust_now FROM public.customers WHERE id = cust_id;
  INSERT INTO t053 VALUES (10, 'customer spend/visits/points back to before the sale',
    CASE WHEN cust_now.spend = cust_before.spend AND cust_now.visits = cust_before.visits AND cust_now.pts = cust_before.pts
         THEN 'PASS' ELSE 'FAIL: spend ' || cust_before.spend || '->' || cust_now.spend
              || ' visits ' || cust_before.visits || '->' || cust_now.visits || ' pts ' || cust_before.pts || '->' || cust_now.pts END);

  -- T11 audit log
  INSERT INTO t053 SELECT 11, 'audit_logs row for the void',
    CASE WHEN EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'void_order' AND row_id = v_order_id
                      AND after_data->>'approved_by_employee_id' = mgr_id::text)
         THEN 'PASS' ELSE 'FAIL' END;

  -- T12 second void refused, stock not put back twice
  r := pg_temp.try_void(v_order_id, real_shop, mgr_pin, 'again');
  INSERT INTO t053 VALUES (12, 'void again -> ORDER_NOT_PAID, stock unchanged',
    CASE WHEN r LIKE 'ERR % ORDER_NOT_PAID%' AND pg_temp.stock_of(recipe) = before_sale THEN 'PASS' ELSE 'FAIL: ' || r END);

  -- T13 unknown order
  r := pg_temp.try_void(gen_random_uuid(), real_shop, mgr_pin, 'test');
  INSERT INTO t053 VALUES (13, 'unknown order -> not found',
    CASE WHEN r LIKE 'ERR P0002 %' THEN 'PASS' ELSE 'FAIL: ' || r END);

  -- T14 old void_order closed to anon
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM public.void_order(v_order_id, 'x');
    RESET ROLE;
    r := 'OK';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    r := 'ERR ' || SQLSTATE || ' ' || SQLERRM;
  END;
  INSERT INTO t053 VALUES (14, 'old void_order as anon -> permission denied',
    CASE WHEN r LIKE 'ERR 42501 permission denied%' THEN 'PASS' ELSE 'FAIL: ' || r END);

  -- T15 queue number not reused after voiding the latest order of the day
  INSERT INTO t053 SELECT 15, 'next queue number skips the voided one (no reuse)',
    CASE WHEN public.get_daily_queue_number() > queue_no
          AND pg_get_functiondef('public.get_daily_queue_number()'::regprocedure) NOT LIKE '%voided%'
         THEN 'PASS' ELSE 'FAIL: next=' || public.get_daily_queue_number() || ' voided=' || queue_no END;
END;
$$;

-- Report and abort: this error rolls back the whole transaction on purpose.
DO $$
DECLARE report TEXT;
BEGIN
  SELECT string_agg(format('T%s %s: %s', n, result, name), E'\n' ORDER BY n) INTO report FROM t053;
  RAISE EXCEPTION E'053 TEST RESULTS (everything rolled back, nothing changed):\n%', report;
END;
$$;

ROLLBACK;
