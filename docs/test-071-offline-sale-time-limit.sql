-- ============================================================
--  Test for migration 071 (offline bills: at most 24 hours back, not before the open drawer session)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("071 TEST RESULTS ..."), so everything rolls back, including the test
--  employee, bills and drawer sessions. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres, AFTER 070, copy the error text back.
--  Section "body of 071" is a copy of supabase/migrations/071_offline_sale_time_limit.sql.
-- ============================================================
DO $test$
DECLARE
  c_shop     constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_cash_pin constant text := '7391';
  report text := '';
  v_cashier uuid; v_recipe uuid; v_price numeric; v_cart jsonb;
  v_res jsonb; v_uuid uuid; v_body text;
BEGIN
  IF position('vip_discount_percent' IN pg_get_functiondef('public.checkout_order'::regproc)) = 0 THEN
    RAISE EXCEPTION '071 TEST: run 070 first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE shop_id = c_shop AND is_active
             AND pin_hash = extensions.crypt(c_cash_pin, pin_hash)) THEN
    RAISE EXCEPTION '071 TEST: a real employee uses PIN % -- change it at the top and run again', c_cash_pin;
  END IF;
  SELECT id, price_lak INTO v_recipe, v_price FROM public.recipes
   WHERE COALESCE(is_active, true) AND NOT COALESCE(is_archived, false) AND price_lak > 0
   ORDER BY created_at, id LIMIT 1;
  IF v_recipe IS NULL THEN RAISE EXCEPTION '071 TEST: no active menu item to sell'; END IF;
  ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;
  -- start from "no drawer session open"; a real open one comes back with the rollback
  DELETE FROM public.cash_sessions WHERE shop_id = c_shop AND status <> 'closed';

  -- ---- body of 071 ----
  v_body := $body$
DO $swap$
DECLARE
  v_fn  regprocedure;
  v_def text;
  v_old text := $o$  IF v_created < now() - interval '30 days' THEN
    RAISE EXCEPTION 'sale time out of range' USING ERRCODE = '22023';
  END IF;$o$;
  v_new text := $n$  -- an offline bill keeps its real sale time only within 24 hours and inside the open
  -- drawer session (071); an older one waits on the POS for a manager
  IF v_replay AND (v_created < now() - interval '24 hours' OR v_created < COALESCE(
       (SELECT s.opened_at - interval '5 minutes' FROM public.cash_sessions s WHERE s.shop_id = p_shop_id AND s.status <> 'closed'),
       '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'SALE_TOO_OLD: sold %, more than 24 hours ago or before the open drawer session',
      to_char(v_created AT TIME ZONE 'Asia/Vientiane', 'YYYY-MM-DD HH24:MI') USING ERRCODE = '22023';
  END IF;$n$;
BEGIN
  SELECT p.oid::regprocedure INTO STRICT v_fn FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'checkout_order';
  v_def := pg_get_functiondef(v_fn);
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION '071: checkout_order does not look like the 061 version, nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END
$swap$;
  $body$;
  EXECUTE v_body;

  -- ---- tests ----
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST071 cashier', 'cashier', extensions.crypt(c_cash_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_cashier;
  v_cart := jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1));

  -- T1 no drawer session open: an offline bill from 23 hours ago is accepted with its own time
  v_uuid := gen_random_uuid();
  BEGIN
    v_res := public.checkout_order(v_uuid, c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price, now() - interval '23 hours', 901);
    report := report || CASE WHEN (SELECT created_at FROM public.orders WHERE id = (v_res->>'order_id')::uuid) < now() - interval '22 hours'
        THEN E'\nPASS T1 23 hours back accepted, keeps its sale time' ELSE E'\nFAIL T1 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T1 refused: ' || SQLERRM;
  END;

  -- T2 25 hours back is refused
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price, now() - interval '25 hours', 902);
    report := report || E'\nFAIL T2 25 hours back went through';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE 'SALE_TOO_OLD%' AND SQLSTATE = '22023' THEN E'\nPASS T2 25 hours back refused' ELSE E'\nFAIL T2 ' || SQLERRM END;
  END;

  -- T3 the same bill sent again after it was accepted still answers "duplicate" (no refusal, no second bill)
  BEGIN
    v_res := public.checkout_order(v_uuid, c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price, now() - interval '30 hours', 901);
    report := report || CASE WHEN (v_res->>'duplicate')::boolean AND (SELECT count(*) FROM public.orders WHERE client_uuid = v_uuid) = 1
        THEN E'\nPASS T3 resend of an accepted bill = duplicate' ELSE E'\nFAIL T3 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T3 refused: ' || SQLERRM;
  END;

  -- open a drawer session 30 minutes ago
  INSERT INTO public.cash_sessions (shop_id, status, opened_at, opening_cash_lak, window_start)
  VALUES (c_shop, 'open', now() - interval '30 minutes', 0, now() - interval '30 minutes');

  -- T4 sold 1 hour ago = before the open session: refused
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price, now() - interval '1 hour', 903);
    report := report || E'\nFAIL T4 a bill from before the open session went through';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE 'SALE_TOO_OLD%' THEN E'\nPASS T4 before the open session refused' ELSE E'\nFAIL T4 ' || SQLERRM END;
  END;

  -- T4b 3 minutes before the session opened (tablet clock a little slow): accepted
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price, now() - interval '33 minutes', 907);
    report := report || CASE WHEN v_res ? 'order_id' THEN E'
PASS T4b 3 minutes of clock slack accepted' ELSE E'
FAIL T4b ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'
FAIL T4b refused: ' || SQLERRM;
  END;

  -- T5 sold 10 minutes ago, inside the open session: accepted
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price, now() - interval '10 minutes', 904);
    report := report || CASE WHEN v_res ? 'order_id' THEN E'\nPASS T5 inside the open session accepted' ELSE E'\nFAIL T5 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T5 refused: ' || SQLERRM;
  END;

  -- T6 a normal online sale (no sale time sent) is not affected
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price);
    report := report || CASE WHEN v_res ? 'order_id' THEN E'\nPASS T6 online sale accepted' ELSE E'\nFAIL T6 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T6 refused: ' || SQLERRM;
  END;

  -- T7 a sale time in the future is treated as now (accepted)
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price, now() + interval '3 hours', 905);
    report := report || CASE WHEN (SELECT created_at FROM public.orders WHERE id = (v_res->>'order_id')::uuid) <= clock_timestamp()
        THEN E'\nPASS T7 future time stored as now' ELSE E'\nFAIL T7 stored in the future' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T7 refused: ' || SQLERRM;
  END;

  -- T8 a closed session does not count: close it, then 1 hour back is fine again
  UPDATE public.cash_sessions SET status = 'closed', closed_at = now() WHERE shop_id = c_shop AND status = 'open';
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price, now() - interval '1 hour', 906);
    report := report || CASE WHEN v_res ? 'order_id' THEN E'\nPASS T8 closed session ignored' ELSE E'\nFAIL T8 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T8 refused: ' || SQLERRM;
  END;

  -- T9 still SECURITY DEFINER, and running the migration a second time stops without changing anything
  BEGIN
    EXECUTE v_body;
    report := report || E'\nFAIL T9 second run did not stop';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE '071: checkout_order does not look%'
        AND (SELECT prosecdef FROM pg_proc WHERE proname = 'checkout_order')
        THEN E'\nPASS T9 second run stops safely' ELSE E'\nFAIL T9 ' || SQLERRM END;
  END;

  RAISE EXCEPTION '071 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
