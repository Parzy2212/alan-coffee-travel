-- ============================================================
--  Test for migration 073 (stock receive / waste / count, movement log, paid-out = one expense)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("073 TEST RESULTS ..."), so everything rolls back, including the test
--  ingredients, menu items, employees, drawer session and bills. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres, copy the error text back.
--  Section "body of 073" is a copy of supabase/migrations/073_set2_stock_receive_count_paid_out.sql
--  (this file is built from docs/test-073.template.sql by scripts/build-migration-test.sh).
-- ============================================================
DO $test$
DECLARE
  c_shop     constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_cash_pin constant text := '7391';
  c_mgr_pin  constant text := '8264';
  c_owner    uuid;
  report text := '';
  v_body text;
  v_cashier uuid; v_mgr uuid; v_session uuid;
  i_coffee uuid; i_milk uuid; i_cup uuid;
  v_menu uuid; v_menu_def uuid; v_iced_menu uuid; v_hot uuid; v_iced uuid;
  v_pending int;
  m0 jsonb; m1 jsonb;
  v_res jsonb; v_order uuid; v_mov uuid; v_pur uuid; v_n int; v_x numeric; v_y numeric;
BEGIN
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active ORDER BY id LIMIT 1;
  IF c_owner IS NULL THEN RAISE EXCEPTION '073 TEST: the shop has no active owner'; END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE shop_id = c_shop AND is_active
             AND (pin_hash = extensions.crypt(c_cash_pin, pin_hash) OR pin_hash = extensions.crypt(c_mgr_pin, pin_hash))) THEN
    RAISE EXCEPTION '073 TEST: a real employee uses PIN % or % -- change them at the top and run again', c_cash_pin, c_mgr_pin;
  END IF;
  ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;
  SELECT count(*) INTO v_pending FROM public.purchase_logs WHERE status = 'pending';

  -- ---- body of 073 ----
  v_body := $body$
__BODY__
$body$;
  EXECUTE v_body;

  -- T17 old paths: last-price and approve->cash_flow triggers gone, pending requests cancelled (kept)
  report := report || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.purchase_logs'::regclass
                                              AND tgname IN ('trg_purchase_updates_cost', 'trg_purchase_to_cashflow'))
      AND NOT EXISTS (SELECT 1 FROM public.purchase_logs WHERE status = 'pending')
      AND (SELECT count(*) FROM public.purchase_logs WHERE flag_reason LIKE '%ยกเลิกก่อนเปิดร้าน (073)%') >= v_pending
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.inventory'::regclass AND tgname = 'trg_inventory_cost_changed')
      AND (SELECT numeric_scale FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'inventory' AND column_name = 'cost_per_unit') = 4
    THEN E'\nPASS T17 purchase triggers dropped, ' || v_pending || ' pending request(s) cancelled and kept, cost has 4 decimals, recipe-cost trigger still there'
    ELSE E'\nFAIL T17 old paths' END;

  -- helpers (pg_temp, rolled back with everything else)
  CREATE FUNCTION pg_temp.t_qty(p uuid) RETURNS numeric LANGUAGE sql AS $f$ SELECT current_qty FROM public.inventory WHERE id = p $f$;
  CREATE FUNCTION pg_temp.t_cost(p uuid) RETURNS numeric LANGUAGE sql AS $f$ SELECT cost_per_unit FROM public.inventory WHERE id = p $f$;
  CREATE FUNCTION pg_temp.t_sell(p_cart jsonb, p_total numeric, p_emp uuid, p_test boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $f$
    SELECT public.checkout_order(gen_random_uuid(), '9afdd9eb-728d-4e36-8077-492c92dbef30', p_emp, p_cart, NULL, 'cash',
                                 p_total, 0, NULL, NULL, NULL, NULL, p_test, p_total) $f$;
  -- the 3 places money is reported: business cash balance, today's expenses, what the open drawer should hold
  CREATE FUNCTION pg_temp.t_money() RETURNS jsonb LANGUAGE sql AS $f$
    SELECT jsonb_build_object(
      'balance', public.get_current_cash_balance(),
      'expense', (SELECT total_expense FROM public.get_cash_flow_summary((now() AT TIME ZONE 'Asia/Vientiane')::date, (now() AT TIME ZONE 'Asia/Vientiane')::date)),
      'drawer', (SELECT (public.cash_session_compute(s.id, 0, clock_timestamp())->>'expected')::numeric
                 FROM public.cash_sessions s WHERE s.shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30' AND s.status = 'open')) $f$;
  -- change of each figure between two snapshots (expense up = positive)
  CREATE FUNCTION pg_temp.t_delta(a jsonb, b jsonb) RETURNS text LANGUAGE sql AS $f$
    SELECT 'balance ' || ((b->>'balance')::numeric - (a->>'balance')::numeric)
        || ' expense ' || ((b->>'expense')::numeric - (a->>'expense')::numeric)
        || ' drawer ' || COALESCE(((b->>'drawer')::numeric - (a->>'drawer')::numeric)::text, 'no session') $f$;
  CREATE FUNCTION pg_temp.t_moved(a jsonb, b jsonb, p_balance numeric, p_expense numeric, p_drawer numeric) RETURNS boolean LANGUAGE sql AS $f$
    SELECT (b->>'balance')::numeric - (a->>'balance')::numeric = p_balance
       AND (b->>'expense')::numeric - (a->>'expense')::numeric = p_expense
       AND ((b->>'drawer')::numeric - (a->>'drawer')::numeric) IS NOT DISTINCT FROM p_drawer $f$;
  CREATE FUNCTION pg_temp.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $f$
    SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
           set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $f$;

  -- test data
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST073 cashier', 'cashier', extensions.crypt(c_cash_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_cashier;
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST073 manager', 'manager', extensions.crypt(c_mgr_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_mgr;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__073 coffee', 'g', 1000, 100, c_shop) RETURNING id INTO i_coffee;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__073 milk', 'ml', 1000, 20, c_shop) RETURNING id INTO i_milk;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__073 cup', 'pcs', 50, 2000, c_shop) RETURNING id INTO i_cup;
  INSERT INTO public.recipes (product_name, price_lak, shop_id) VALUES ('__073 Coffee', 30000, c_shop) RETURNING id INTO v_menu;
  SELECT id INTO v_menu_def FROM public.menu_variants WHERE recipe_id = v_menu AND kind = 'default';
  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, qty_normal, unit) VALUES (v_menu, i_coffee, 18, 'g'), (v_menu, i_cup, 1, 'pcs');

  -- no drawer open while the receive tests start: the real session (if any) is set aside, rolled back at the end
  UPDATE public.cash_sessions SET status = 'closed' WHERE shop_id = c_shop AND status <> 'closed';

  -- T15 privileges (anon / signed-in non-member)
  report := report || CASE WHEN NOT has_function_privilege('anon', 'public.stock_receive(uuid, numeric, numeric, boolean, text, text, text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.stock_waste(uuid, numeric, text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.stock_count_submit(jsonb, boolean, text)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.add_stock(uuid, numeric, numeric, text, timestamptz)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.approve_purchase(uuid, boolean)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.start_stock_audit(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.submit_stock_audit(uuid, numeric)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.submit_purchase_request(uuid, uuid, numeric, numeric, text, text, text)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.stock_cut_for_order(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.stock_return_for_order(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.trg_fn_paid_out_to_cashflow()', 'EXECUTE')
      AND NOT has_table_privilege('anon', 'public.stock_movements', 'SELECT')
      AND NOT has_table_privilege('authenticated', 'public.stock_movements', 'INSERT')
    THEN E'\nPASS T15 anon cannot receive / waste / count, old stock functions and internals closed'
    ELSE E'\nFAIL T15 privileges' END;
  PERFORM pg_temp.t_as(gen_random_uuid());
  v_n := 0;
  BEGIN PERFORM public.stock_receive(i_milk, 1, 1, false, 'owner'); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  BEGIN PERFORM public.stock_waste(i_milk, 1, 'x'); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_milk, 'counted_qty', 1))); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  report := report || CASE WHEN v_n = 3 THEN E'\nPASS T15b a signed-in non-member is refused all 3' ELSE E'\nFAIL T15b only ' || v_n || ' of 3 refused' END;

  PERFORM pg_temp.t_as(c_owner);

  -- T1 receive milk 1,000 ml for 30,000 (owner's money) when 1,000 ml cost 20 each -> average 25;
  --    one expense of 30,000, no drawer involved
  m0 := pg_temp.t_money();
  v_res := public.stock_receive(i_milk, 1000, 30000, false, 'owner', 'Market', 'test');
  v_pur := (v_res->>'purchase_id')::uuid;
  m1 := pg_temp.t_money();
  report := report || CASE WHEN pg_temp.t_cost(i_milk) = 25 AND pg_temp.t_qty(i_milk) = 2000
      AND (SELECT count(*) FROM public.cash_flow WHERE reference_id = v_pur AND type = 'expense' AND amount_lak = 30000 AND category = 'วัตถุดิบ') = 1
      AND (SELECT count(*) FROM public.cash_flow WHERE reference_id = v_pur) = 1
      AND pg_temp.t_moved(m0, m1, -30000, 30000, NULL)
      AND (SELECT status = 'received' AND paid_from = 'owner' AND qty_purchased = 1000 FROM public.purchase_logs WHERE id = v_pur)
      AND (SELECT count(*) FROM public.stock_movements WHERE purchase_id = v_pur AND kind = 'receive' AND qty_delta = 1000 AND qty_after = 2000 AND unit_cost = 30) = 1
    THEN E'\nPASS T1 receive 1,000 ml for 30,000: average cost 20 -> 25, one expense 30,000, one movement'
    ELSE E'\nFAIL T1 cost ' || pg_temp.t_cost(i_milk) || ' qty ' || pg_temp.t_qty(i_milk) || ' ' || pg_temp.t_delta(m0, m1) END;

  -- T2 refused: no price and not free / amount 0 / amount below 0 / no "paid from" / unknown "paid from"
  v_n := 0;
  BEGIN PERFORM public.stock_receive(i_milk, 100, NULL, false, 'owner'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'PRICE_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_receive(i_milk, 0, 1000, false, 'owner'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'QTY_INVALID%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_receive(i_milk, -5, 1000, false, 'owner'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'QTY_INVALID%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_receive(i_milk, 100, 1000, false, NULL); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'PAID_FROM_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_receive(i_milk, 100, 1000, false, 'friend'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'PAID_FROM_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_n = 5 AND pg_temp.t_qty(i_milk) = 2000
    THEN E'\nPASS T2 no price / amount 0 / below 0 / no or unknown "paid from" all refused, stock unchanged'
    ELSE E'\nFAIL T2 only ' || v_n || ' of 5 refused' END;

  -- T3 stock below 0 (sold past the count): the new cost is this price, not divided by a negative amount
  UPDATE public.inventory SET current_qty = -5 WHERE id = i_coffee;
  v_res := public.stock_receive(i_coffee, 10, 2000, false, 'transfer');
  report := report || CASE WHEN pg_temp.t_cost(i_coffee) = 200 AND pg_temp.t_qty(i_coffee) = 5
      AND (SELECT payment_method FROM public.cash_flow WHERE reference_id = (v_res->>'purchase_id')::uuid) = 'transfer'
    THEN E'\nPASS T3 receive at -5: cost = this price (200), stock 5, paid by transfer'
    ELSE E'\nFAIL T3 cost ' || pg_temp.t_cost(i_coffee) || ' qty ' || pg_temp.t_qty(i_coffee) END;

  -- T4 free goods: no expense, the average goes down (2,000 x 25 + 1,000 x 0) / 3,000 = 16.6667 (4 decimals kept)
  m0 := pg_temp.t_money();
  v_res := public.stock_receive(i_milk, 1000, NULL, true, 'drawer');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN pg_temp.t_cost(i_milk) = 16.6667 AND pg_temp.t_qty(i_milk) = 3000
      AND NOT EXISTS (SELECT 1 FROM public.cash_flow WHERE reference_id = (v_res->>'purchase_id')::uuid)
      AND (SELECT paid_from IS NULL FROM public.purchase_logs WHERE id = (v_res->>'purchase_id')::uuid)
      AND pg_temp.t_moved(m0, m1, 0, 0, NULL)
    THEN E'\nPASS T4 free goods: no expense (even with "drawer" ticked), cost 16.6667'
    ELSE E'\nFAIL T4 cost ' || pg_temp.t_cost(i_milk) || ' ' || pg_temp.t_delta(m0, m1) END;
  UPDATE public.inventory SET current_qty = 1000, cost_per_unit = 20 WHERE id = i_milk;

  -- T5 paid from the drawer while no drawer is open: refused, nothing changes
  BEGIN
    PERFORM public.stock_receive(i_milk, 500, 10000, false, 'drawer');
    report := report || E'\nFAIL T5 received from a closed drawer';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE 'NO_OPEN_SESSION%' AND pg_temp.t_qty(i_milk) = 1000
      THEN E'\nPASS T5 "paid from drawer" with no open drawer refused, stock unchanged' ELSE E'\nFAIL T5 ' || SQLERRM END;
  END;

  INSERT INTO public.cash_sessions (shop_id, status, opened_at, opening_cash_lak, window_start)
  VALUES (c_shop, 'open', clock_timestamp(), 500000, clock_timestamp()) RETURNING id INTO v_session;

  -- T6 receive 1,000 ml for 30,000 from the drawer: one paid-out in the drawer, one expense;
  --    each money figure moves by 30,000 exactly once
  m0 := pg_temp.t_money();
  v_res := public.stock_receive(i_milk, 1000, 30000, false, 'drawer');
  m1 := pg_temp.t_money();
  SELECT id INTO v_mov FROM public.cash_movements WHERE session_id = v_session AND kind = 'paid_out' AND note LIKE 'รับของ: __073 milk 1000 ml';
  report := report || CASE WHEN v_mov IS NOT NULL
      AND (SELECT count(*) FROM public.cash_movements WHERE session_id = v_session) = 1
      AND (SELECT count(*) FROM public.cash_flow WHERE reference_id = v_mov AND type = 'expense' AND amount_lak = 30000) = 1
      AND NOT EXISTS (SELECT 1 FROM public.cash_flow WHERE reference_id = (v_res->>'purchase_id')::uuid)
      AND pg_temp.t_moved(m0, m1, -30000, 30000, -30000)
      AND pg_temp.t_cost(i_milk) = 25
    THEN E'\nPASS T6 receive paid from drawer: 1 paid-out, 1 expense; balance -30,000, expenses +30,000, drawer -30,000 (once each)'
    ELSE E'\nFAIL T6 ' || pg_temp.t_delta(m0, m1) END;

  -- T7 a paid-out from the drawer screen (ice 20,000, cashier PIN): one expense too
  m0 := pg_temp.t_money();
  v_res := public.cash_movement_add(c_shop, c_cash_pin, 'paid_out', 20000, 'ซื้อน้ำแข็ง', 'ร้านข้างๆ');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN (v_res->>'ok')::boolean
      AND (SELECT count(*) FROM public.cash_flow WHERE reference_id = (v_res->>'id')::uuid AND type = 'expense' AND amount_lak = 20000 AND category = 'วัตถุดิบ') = 1
      AND pg_temp.t_moved(m0, m1, -20000, 20000, -20000)
    THEN E'\nPASS T7 drawer paid-out (ice 20,000): 1 expense; balance, expenses and drawer each move 20,000 once'
    ELSE E'\nFAIL T7 ' || v_res::text || ' ' || pg_temp.t_delta(m0, m1) END;

  -- T8 money put into the drawer is not income: only the drawer changes
  m0 := pg_temp.t_money();
  v_res := public.cash_movement_add(c_shop, c_cash_pin, 'paid_in', 100000, 'เติมเงินทอน');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN NOT EXISTS (SELECT 1 FROM public.cash_flow WHERE reference_id = (v_res->>'id')::uuid)
      AND pg_temp.t_moved(m0, m1, 0, 0, 100000)
    THEN E'\nPASS T8 money put into the drawer: drawer +100,000, no cash_flow row'
    ELSE E'\nFAIL T8 ' || pg_temp.t_delta(m0, m1) END;

  -- T9 voiding the ice paid-out (manager PIN) takes its expense away once; voiding the receive's paid-out too
  SELECT id INTO v_mov FROM public.cash_movements WHERE session_id = v_session AND category = 'ซื้อน้ำแข็ง';
  m0 := pg_temp.t_money();
  v_res := public.cash_movement_void(c_shop, v_mov, c_mgr_pin, 'test');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN (v_res->>'ok')::boolean AND NOT EXISTS (SELECT 1 FROM public.cash_flow WHERE reference_id = v_mov)
      AND pg_temp.t_moved(m0, m1, 20000, -20000, 20000)
    THEN E'\nPASS T9 void ice paid-out: its expense removed; balance, expenses and drawer each back by 20,000 once'
    ELSE E'\nFAIL T9 ' || v_res::text || ' ' || pg_temp.t_delta(m0, m1) END;
  SELECT id INTO v_mov FROM public.cash_movements WHERE session_id = v_session AND note LIKE 'รับของ:%';
  m0 := pg_temp.t_money();
  PERFORM public.cash_movement_void(c_shop, v_mov, c_mgr_pin, 'test');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN pg_temp.t_moved(m0, m1, 30000, -30000, 30000)
      -- every paid-out of this drawer: exactly 1 expense row while it stands, none once voided
      AND NOT EXISTS (SELECT 1 FROM public.cash_movements m WHERE m.session_id = v_session AND m.kind = 'paid_out'
                      AND (SELECT count(*) FROM public.cash_flow f WHERE f.reference_id = m.id) <> CASE WHEN m.voided_at IS NULL THEN 1 ELSE 0 END)
    THEN E'\nPASS T9b void the receive''s paid-out: back by 30,000 once; every paid-out has 1 expense row, voided ones none'
    ELSE E'\nFAIL T9b ' || pg_temp.t_delta(m0, m1) END;

  -- T10 waste 200 ml with a reason: stock -200, logged, money untouched; without a reason refused
  m0 := pg_temp.t_money();
  v_x := pg_temp.t_qty(i_milk);
  PERFORM public.stock_waste(i_milk, 200, 'บูด');
  m1 := pg_temp.t_money();
  v_n := 0;
  BEGIN PERFORM public.stock_waste(i_milk, 200, '  '); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'REASON_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_waste(i_milk, 0, 'x'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'QTY_INVALID%' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_x - pg_temp.t_qty(i_milk) = 200 AND v_n = 2
      AND (SELECT count(*) FROM public.stock_movements WHERE inventory_id = i_milk AND kind = 'waste' AND qty_delta = -200 AND reason = 'บูด' AND unit_cost = 25) = 1
      AND pg_temp.t_moved(m0, m1, 0, 0, 0)
    THEN E'\nPASS T10 waste 200 ml "บูด": stock -200, logged at cost 25, money untouched; no reason / amount 0 refused'
    ELSE E'\nFAIL T10 qty change ' || (v_x - pg_temp.t_qty(i_milk)) || ' refused ' || v_n END;

  -- T11 count 3 items: stock becomes what was counted, each difference logged (a match logged as 0)
  v_x := pg_temp.t_qty(i_coffee);
  v_res := public.stock_count_submit(jsonb_build_array(
    jsonb_build_object('inventory_id', i_coffee, 'counted_qty', 3),
    jsonb_build_object('inventory_id', i_milk, 'counted_qty', 1500.5),
    jsonb_build_object('inventory_id', i_cup, 'counted_qty', 50)), false, 'คืนนี้');
  report := report || CASE WHEN pg_temp.t_qty(i_coffee) = 3 AND pg_temp.t_qty(i_milk) = 1500.5 AND pg_temp.t_qty(i_cup) = 50
      AND (v_res->>'items')::int = 3 AND (v_res->>'changed')::int = 2
      AND (SELECT qty_delta FROM public.stock_movements WHERE inventory_id = i_coffee AND kind = 'count') = 3 - v_x
      AND (SELECT qty_delta FROM public.stock_movements WHERE inventory_id = i_cup AND kind = 'count') = 0
      AND pg_temp.t_cost(i_milk) = 25
    THEN E'\nPASS T11 count of 3: stock set to the count, 2 changed, differences logged, costs unchanged'
    ELSE E'\nFAIL T11 ' || v_res::text END;
  v_n := 0;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 1), jsonb_build_object('inventory_id', i_cup, 'counted_qty', 2))); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'COUNT_DUPLICATE%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', -1))); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'COUNT_INVALID%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', gen_random_uuid(), 'counted_qty', 1))); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = 'P0002' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_count_submit('[]'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'COUNT_EMPTY%' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_n = 4 AND pg_temp.t_qty(i_cup) = 50
    THEN E'\nPASS T11b duplicate item / below 0 / unknown item / empty list refused' ELSE E'\nFAIL T11b only ' || v_n || ' of 4 refused' END;

  -- T12 opening count: a cost per unit is required and becomes the cost; a manager may count but not open
  v_n := 0;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 40)), true); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'COST_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 40, 'unit_cost', 1500),
                                                      jsonb_build_object('inventory_id', i_coffee, 'counted_qty', 1000, 'unit_cost', 0)), true);
  UPDATE public.shop_users SET role = 'manager' WHERE shop_id = c_shop AND user_id = c_owner;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 41, 'unit_cost', 1)), true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 39)));
  PERFORM public.stock_receive(i_cup, 1, 1500, false, 'owner');
  UPDATE public.shop_users SET role = 'owner' WHERE shop_id = c_shop AND user_id = c_owner;
  report := report || CASE WHEN v_n = 2 AND pg_temp.t_cost(i_cup) = 1500 AND pg_temp.t_qty(i_cup) = 40 AND pg_temp.t_cost(i_coffee) = 0
      AND (SELECT count(*) FROM public.stock_movements WHERE inventory_id = i_cup AND kind = 'opening' AND unit_cost = 1500 AND qty_delta = -10) = 1
    THEN E'\nPASS T12 opening count needs a cost (cost 0 accepted), sets it; a manager can count and receive but not open'
    ELSE E'\nFAIL T12 refused ' || v_n || ' cost ' || pg_temp.t_cost(i_cup) || ' qty ' || pg_temp.t_qty(i_cup) END;
  UPDATE public.inventory SET current_qty = 1000, cost_per_unit = 100 WHERE id = i_coffee;
  PERFORM pg_temp.t_as(NULL);

  -- T13 a sale logs what it cut; changing the recipe before the void still gives back what was cut
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_menu, 'variant_id', v_menu_def, 'qty', 2)), 60000, v_cashier);
  v_order := (v_res->>'order_id')::uuid;
  report := report || CASE WHEN pg_temp.t_qty(i_coffee) = 964 AND pg_temp.t_qty(i_cup) = 38
      AND (SELECT count(*) FROM public.stock_movements WHERE order_id = v_order AND kind = 'sale') = 2
      AND (SELECT qty_delta FROM public.stock_movements WHERE order_id = v_order AND inventory_id = i_coffee) = -36
      AND (SELECT qty_after FROM public.stock_movements WHERE order_id = v_order AND inventory_id = i_coffee) = 964
    THEN E'\nPASS T13 sale of 2: coffee -36, cup -2, both logged with the amount after'
    ELSE E'\nFAIL T13 coffee ' || pg_temp.t_qty(i_coffee) || ' cup ' || pg_temp.t_qty(i_cup) END;
  UPDATE public.recipe_ingredients SET qty_normal = 30 WHERE recipe_id = v_menu AND inventory_id = i_coffee;
  v_res := public.void_order_with_approval(v_order, c_shop, c_mgr_pin, 'test');
  report := report || CASE WHEN (v_res->>'ok')::boolean AND pg_temp.t_qty(i_coffee) = 1000 AND pg_temp.t_qty(i_cup) = 40
      AND (SELECT sum(qty_delta) FROM public.stock_movements WHERE order_id = v_order) = 0
      AND pg_temp.t_cost(i_coffee) = 100
    THEN E'\nPASS T13b recipe changed 18 -> 30 g, then void: coffee back exactly 36 (not 60), cup 2, cost unchanged'
    ELSE E'\nFAIL T13b ' || v_res::text || ' coffee ' || pg_temp.t_qty(i_coffee) END;

  -- T14 a bill sold before 073 (no log) is voided with what the recipe says (as 072 did)
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_menu, 'variant_id', v_menu_def, 'qty', 1)), 30000, v_cashier);
  v_order := (v_res->>'order_id')::uuid;
  DELETE FROM public.stock_movements WHERE order_id = v_order;
  UPDATE public.orders SET created_at = public.stock_log_start() - interval '1 hour' WHERE id = v_order;
  v_x := pg_temp.t_qty(i_coffee);
  PERFORM public.void_order_with_approval(v_order, c_shop, c_mgr_pin, 'test');
  -- a bill sold after 073 that cut nothing gets nothing back
  INSERT INTO public.recipes (product_name, price_lak, shop_id) VALUES ('__073 Water', 5000, c_shop) RETURNING id INTO v_iced_menu;
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_iced_menu, 'qty', 1)), 5000, v_cashier);
  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, qty_normal, unit) VALUES (v_iced_menu, i_cup, 1, 'pcs');
  v_y := pg_temp.t_qty(i_cup);
  PERFORM public.void_order_with_approval((v_res->>'order_id')::uuid, c_shop, c_mgr_pin, 'test');
  report := report || CASE WHEN pg_temp.t_qty(i_coffee) - v_x = 30 AND pg_temp.t_qty(i_cup) = v_y
    THEN E'\nPASS T14 bill from before 073: void gives back the recipe (30 g); bill after 073 that cut nothing: nothing given back'
    ELSE E'\nFAIL T14 coffee back ' || (pg_temp.t_qty(i_coffee) - v_x) || ' cup change ' || (pg_temp.t_qty(i_cup) - v_y) END;

  -- T16 a test bill cuts nothing and logs nothing
  INSERT INTO public.pos_test_windows (shop_id, started_at, ends_at) VALUES (c_shop, now() - interval '1 minute', now() + interval '1 hour');
  v_x := pg_temp.t_qty(i_coffee);
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_menu, 'variant_id', v_menu_def, 'qty', 1)), 30000, v_cashier, true);
  report := report || CASE WHEN v_res->>'status' = 'test' AND pg_temp.t_qty(i_coffee) = v_x
      AND NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE order_id = (v_res->>'order_id')::uuid)
    THEN E'\nPASS T16 test bill: no stock cut, nothing logged' ELSE E'\nFAIL T16 ' || v_res::text END;

  -- T18 saving a recipe from the old recipe screen keeps hot/iced-only lines
  PERFORM pg_temp.t_as(c_owner);
  PERFORM public.save_menu_variants(v_menu, '[{"kind":"hot","price_lak":30000},{"kind":"iced","price_lak":35000}]');
  SELECT id INTO v_iced FROM public.menu_variants WHERE recipe_id = v_menu AND kind = 'iced';
  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, variant_id, qty_normal, unit) VALUES (v_menu, i_milk, v_iced, 120, 'ml');
  PERFORM public.save_recipe_cost(v_menu, true, 5000, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 20, 'qty_less', 20, 'qty_more', 20)));
  PERFORM pg_temp.t_as(NULL);
  report := report || CASE WHEN (SELECT count(*) FROM public.recipe_ingredients WHERE recipe_id = v_menu) = 2
      AND EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE recipe_id = v_menu AND variant_id = v_iced AND inventory_id = i_milk)
      AND EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE recipe_id = v_menu AND variant_id IS NULL AND inventory_id = i_coffee AND qty_normal = 20)
    THEN E'\nPASS T18 old recipe screen replaces shared lines, keeps the iced-only milk'
    ELSE E'\nFAIL T18 recipe lines' END;

  -- T19 running the migration again: no error, nothing logged or cancelled twice
  SELECT count(*) INTO v_n FROM public.stock_movements;
  v_x := (SELECT count(*) FROM public.cash_flow);
  BEGIN
    EXECUTE v_body;
    report := report || CASE WHEN (SELECT count(*) FROM public.stock_movements) = v_n AND (SELECT count(*) FROM public.cash_flow) = v_x
        AND (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_paid_out_to_cashflow') = 1
      THEN E'\nPASS T19 second run changes nothing' ELSE E'\nFAIL T19 second run changed data' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T19 second run: ' || SQLERRM;
  END;

  RAISE EXCEPTION '073 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
