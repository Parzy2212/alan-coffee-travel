-- ============================================================
--  Test for migration 066 (approve purchase / start stock count)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("066 TEST RESULTS ..."), so everything rolls back, including the test
--  purchases, the stock change and the stock-count rows (and the counted_qty change). Every line should
--  start with PASS. Run in Supabase SQL Editor as postgres, copy the error text back.
--  Section "body of 066" is a copy of supabase/migrations/066_purchase_approve_stock_audit_qty.sql.
-- ============================================================
DO $test$
DECLARE
  report  text := '';
  v_owner uuid;
  v_staff uuid;
  v_inv   uuid;
  v_qty0  numeric;
  v_p1    uuid;
  v_p2    uuid;
  r       text;
  v_n     int;
  v_audit uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.shop_users
  WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30' AND role = 'owner' AND active IS TRUE LIMIT 1;
  SELECT id INTO v_staff FROM public.staff ORDER BY created_at LIMIT 1;
  SELECT id, COALESCE(current_qty, 0) INTO v_inv, v_qty0 FROM public.inventory ORDER BY name LIMIT 1;
  IF v_owner IS NULL OR v_inv IS NULL THEN RAISE EXCEPTION '066 TEST: needs an active owner and one inventory item'; END IF;

  -- ---- body of 066 ----
  EXECUTE $body$
ALTER TABLE public.stock_audit ALTER COLUMN counted_qty DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.approve_purchase(p_purchase_id uuid, p_approve boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_pl public.purchase_logs;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  SELECT * INTO v_pl FROM public.purchase_logs WHERE id = p_purchase_id FOR UPDATE;
  IF v_pl.id IS NULL THEN
    RAISE EXCEPTION 'PURCHASE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_pl.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'PURCHASE_NOT_PENDING: already %', v_pl.status USING ERRCODE = '22023';
  END IF;
  UPDATE public.purchase_logs
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE id = p_purchase_id;
  IF p_approve THEN
    UPDATE public.inventory
    SET current_qty = COALESCE(current_qty, 0) + v_pl.qty_purchased, updated_at = now()
    WHERE id = v_pl.inventory_id;
  END IF;
END
$fn$;

CREATE OR REPLACE FUNCTION public.start_stock_audit(p_staff_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_results  jsonb := '[]';
  v_item     record;
  v_audit_id uuid;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  FOR v_item IN
    SELECT id, name, unit, current_qty FROM public.inventory ORDER BY random() LIMIT 3
  LOOP
    INSERT INTO public.stock_audit (inventory_id, staff_id, system_qty, audit_date)
    VALUES (v_item.id, p_staff_id, v_item.current_qty, CURRENT_DATE)
    RETURNING id INTO v_audit_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'audit_id',       v_audit_id,
      'inventory_id',   v_item.id,
      'inventory_name', v_item.name,
      'unit',           v_item.unit
    ));
  END LOOP;
  RETURN v_results;
END
$fn$;

CREATE OR REPLACE FUNCTION public.submit_stock_audit(p_audit_id uuid, p_counted_qty numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_row public.stock_audit;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  IF p_counted_qty IS NULL OR p_counted_qty < 0 THEN
    RAISE EXCEPTION 'COUNT_INVALID: counted quantity must be 0 or more' USING ERRCODE = '22023';
  END IF;
  UPDATE public.stock_audit
  SET counted_qty  = p_counted_qty,
      variance_pct = CASE WHEN system_qty <> 0 THEN round((p_counted_qty - system_qty) / system_qty * 100, 2) END
  WHERE id = p_audit_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'AUDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN to_jsonb(v_row);
END
$fn$;
  $body$;

  -- runs one SQL expression as p_role (auth.uid() = p_sub); result as text, or 'ERR <state> <message>'
  EXECUTE $h$
  CREATE FUNCTION pg_temp.t066(p_role text, p_sub uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
  DECLARE v text;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, true);
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub::text, ''), true);
    PERFORM set_config('role', p_role, true);
    BEGIN
      EXECUTE 'SELECT (' || p_sql || ')::text' INTO v;
    EXCEPTION WHEN OTHERS THEN
      v := 'ERR ' || SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    RETURN COALESCE(v, 'NULL');
  END
  $f$
  $h$;

  INSERT INTO public.purchase_logs (inventory_id, staff_id, qty_purchased, unit_price_lak, status, supplier)
  VALUES (v_inv, v_staff, 7, 1000, 'pending', 'TEST066') RETURNING id INTO v_p1;
  INSERT INTO public.purchase_logs (inventory_id, staff_id, qty_purchased, unit_price_lak, status, supplier)
  VALUES (v_inv, v_staff, 5, 1000, 'pending', 'TEST066') RETURNING id INTO v_p2;

  -- T1 owner approves: status approved, stock +7
  r := pg_temp.t066('authenticated', v_owner, format('public.approve_purchase(%L, true)', v_p1));
  report := report || CASE WHEN r IN ('', 'NULL') AND (SELECT status FROM public.purchase_logs WHERE id = v_p1) = 'approved'
      AND (SELECT current_qty FROM public.inventory WHERE id = v_inv) = v_qty0 + 7
      THEN E'\nPASS T1 approve adds the stock' ELSE E'\nFAIL T1 ' || r END;
  -- T2 second approve of the same purchase: refused, stock not added twice
  r := pg_temp.t066('authenticated', v_owner, format('public.approve_purchase(%L, true)', v_p1));
  report := report || CASE WHEN r LIKE 'ERR 22023%PURCHASE_NOT_PENDING%' AND (SELECT current_qty FROM public.inventory WHERE id = v_inv) = v_qty0 + 7
      THEN E'\nPASS T2 approving twice is refused' ELSE E'\nFAIL T2 ' || r END;
  -- T3 reject: status rejected, stock unchanged
  r := pg_temp.t066('authenticated', v_owner, format('public.approve_purchase(%L, false)', v_p2));
  report := report || CASE WHEN r IN ('', 'NULL') AND (SELECT status FROM public.purchase_logs WHERE id = v_p2) = 'rejected'
      AND (SELECT current_qty FROM public.inventory WHERE id = v_inv) = v_qty0 + 7
      THEN E'\nPASS T3 reject leaves the stock alone' ELSE E'\nFAIL T3 ' || r END;
  -- T4 unknown id says so
  r := pg_temp.t066('authenticated', v_owner, $$public.approve_purchase('00000000-0000-0000-0000-000000000066', true)$$);
  report := report || CASE WHEN r LIKE 'ERR P0002%' THEN E'\nPASS T4 unknown purchase reported' ELSE E'\nFAIL T4 ' || r END;
  -- T5 anon cannot approve
  r := pg_temp.t066('anon', NULL, format('public.approve_purchase(%L, true)', v_p2));
  report := report || CASE WHEN r LIKE 'ERR 42501%' THEN E'\nPASS T5 anon cannot approve' ELSE E'\nFAIL T5 ' || r END;
  -- T6 owner starts a stock count: up to 3 items, system qty recorded
  r := pg_temp.t066('authenticated', v_owner, format('jsonb_array_length(public.start_stock_audit(%L))', v_staff));
  SELECT count(*) INTO v_n FROM public.stock_audit a JOIN public.inventory i ON i.id = a.inventory_id
  WHERE a.staff_id = v_staff AND a.audit_date = CURRENT_DATE AND a.system_qty IS NOT DISTINCT FROM i.current_qty;
  report := report || CASE WHEN r ~ '^[1-3]$' AND v_n >= r::int
      THEN E'\nPASS T6 stock count starts with the system quantity' ELSE E'\nFAIL T6 ' || r || ' rows=' || v_n END;

  -- T7 saving a count works; variance computed by the table, variance % filled
  SELECT a.id INTO v_audit FROM public.stock_audit a JOIN public.inventory i ON i.id = a.inventory_id
  WHERE a.staff_id = v_staff AND a.audit_date = CURRENT_DATE AND COALESCE(i.current_qty, 0) <> 0 LIMIT 1;
  IF v_audit IS NULL THEN
    report := report || E'
SKIP T7 no counted item with stock above 0';
  ELSE
    r := pg_temp.t066('authenticated', v_owner, format('public.submit_stock_audit(%L, 0)', v_audit));
    report := report || CASE WHEN r LIKE '%"counted_qty": 0%' AND r LIKE '%"variance_pct": -100%'
        THEN E'
PASS T7 saving a count works' ELSE E'
FAIL T7 ' || r END;
  END IF;
  -- T8 negative count refused; T9 anon cannot save a count
  r := pg_temp.t066('authenticated', v_owner, format('public.submit_stock_audit(%L, -1)', COALESCE(v_audit, gen_random_uuid())));
  report := report || CASE WHEN r LIKE 'ERR 22023%' THEN E'
PASS T8 negative count refused' ELSE E'
FAIL T8 ' || r END;
  r := pg_temp.t066('anon', NULL, format('public.submit_stock_audit(%L, 1)', COALESCE(v_audit, gen_random_uuid())));
  report := report || CASE WHEN r LIKE 'ERR 42501%' THEN E'
PASS T9 anon cannot save a count' ELSE E'
FAIL T9 ' || r END;

  RAISE EXCEPTION '066 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
