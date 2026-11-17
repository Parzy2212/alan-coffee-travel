-- ============================================================
--  Test for migration 061 (discount above the cap needs a manager PIN)
--
--  CHANGES NOTHING. The whole file is ONE DO block that always ends in an
--  error ("061 TEST RESULTS ..."), so Postgres rolls everything back: the
--  new table and functions, two test employees (PINs 7391 cashier, 8264
--  manager), two test customers, test sales and any Telegram message queued
--  (pg_net only sends after a commit). Every line of the report should start
--  with PASS. The Telegram "large order" trigger is switched off first inside
--  the block.
--
--  Run in Supabase SQL Editor as postgres: paste the whole file, Run, copy
--  the error text back. Needs 060 already run.
--  The migration part is a generated copy of
--  supabase/migrations/061_discount_cap_manager_pin.sql -- keep in sync.
-- ============================================================

DO $test$
DECLARE
  c_shop constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_cash_pin constant text := '7391';
  c_mgr_pin  constant text := '8264';
  report text := '';
  v_cashier uuid; v_mgr uuid; v_recipe uuid; v_price numeric; v_cart jsonb;
  v_sub numeric; v_cap15 numeric; v_cap25 numeric; v_plat uuid; v_reg uuid;
  v_res jsonb; v_uuid uuid; v_n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pos_test_mode_start') THEN
    RAISE EXCEPTION '061 TEST: run 060 first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE shop_id = c_shop AND is_active
             AND (pin_hash = extensions.crypt(c_cash_pin, pin_hash) OR pin_hash = extensions.crypt(c_mgr_pin, pin_hash))) THEN
    RAISE EXCEPTION '061 TEST: a real employee uses PIN % or % -- change them at the top and run again', c_cash_pin, c_mgr_pin;
  END IF;
  SELECT id, price_lak INTO v_recipe, v_price FROM public.recipes
   WHERE COALESCE(is_active, true) AND NOT COALESCE(is_archived, false) AND price_lak > 0
   ORDER BY created_at, id LIMIT 1;
  IF v_recipe IS NULL THEN RAISE EXCEPTION '061 TEST: no active menu item to sell'; END IF;
  ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;

  -- ---- body of 061 ----

  -- 1) approvals ------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS public.pos_discount_approvals (
    client_uuid      uuid PRIMARY KEY,
    shop_id          uuid NOT NULL REFERENCES public.shops(id),
    max_discount_lak numeric NOT NULL CHECK (max_discount_lak > 0),
    approved_by      uuid NOT NULL REFERENCES public.employees(id),
    approved_at      timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.pos_discount_approvals ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.pos_discount_approvals FROM PUBLIC, anon, authenticated;
  GRANT ALL ON public.pos_discount_approvals TO service_role;

  -- 2) approve (called by the POS as anon; the manager PIN is the check) -------------
  CREATE OR REPLACE FUNCTION public.pos_discount_approve(p_shop_id uuid, p_client_uuid uuid, p_discount_lak numeric, p_manager_pin text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    v_mgr jsonb;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
      RAISE EXCEPTION 'shop not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_client_uuid IS NULL OR p_discount_lak IS NULL OR p_discount_lak <= 0 THEN
      RAISE EXCEPTION 'bill id and a discount above 0 are required' USING ERRCODE = '22023';
    END IF;
    v_mgr := public.cash_check_pin(p_shop_id, p_manager_pin, true);
    IF v_mgr ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_mgr; END IF;

    INSERT INTO public.pos_discount_approvals (client_uuid, shop_id, max_discount_lak, approved_by)
    VALUES (p_client_uuid, p_shop_id, p_discount_lak, (v_mgr->>'id')::uuid)
    ON CONFLICT (client_uuid) DO UPDATE
      SET max_discount_lak = EXCLUDED.max_discount_lak, approved_by = EXCLUDED.approved_by, approved_at = now()
      WHERE pos_discount_approvals.shop_id = EXCLUDED.shop_id;
    PERFORM public.cash_notify(format(E'<b>มีการใช้ PIN ผู้จัดการ</b>\nอนุมัติส่วนลดเกินเพดาน %s ₭ (1 บิล)\nผู้จัดการ %s · %s',
      to_char(p_discount_lak, 'FM999,999,999,990'), v_mgr->>'name', to_char(now() AT TIME ZONE 'Asia/Vientiane', 'DD/MM HH24:MI')));
    RETURN jsonb_build_object('ok', true, 'by', v_mgr->>'name');
  END
  $fn$;
  REVOKE ALL ON FUNCTION public.pos_discount_approve(uuid, uuid, numeric, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.pos_discount_approve(uuid, uuid, numeric, text) TO anon, authenticated;

  -- 3) checkout_order: same as 060 plus the discount cap ----------------------------
  CREATE OR REPLACE FUNCTION public.checkout_order(p_client_uuid uuid, p_shop_id uuid, p_employee_id uuid, p_cart jsonb, p_customer_id uuid, p_payment_method text, p_amount_received numeric, p_discount_lak numeric, p_discount_reason text, p_table_number text, p_customer_name text, p_staff_note text, p_is_test boolean, p_expected_total numeric, p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_queue_number integer DEFAULT NULL::integer, p_split_cash numeric DEFAULT NULL::numeric, p_split_transfer numeric DEFAULT NULL::numeric)
   RETURNS jsonb
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path TO 'public', 'pg_temp'
  AS $function$
  DECLARE
    v_existing  public.orders%ROWTYPE;
    -- offline replay: the sale already happened, so record it rather than reject it
    v_replay    boolean := p_created_at IS NOT NULL;
    v_created   timestamptz := LEAST(COALESCE(p_created_at, now()), now());
    v_xfer_part numeric;
    v_employee  uuid := p_employee_id;
    v_note      text := NULLIF(btrim(COALESCE(p_staff_note, '')), '');
    v_day       date;
    v_order_id  uuid;
    v_queue     int;
    v_receipt   text;
    v_subtotal  numeric := 0;
    v_discount  numeric := COALESCE(p_discount_lak, 0);
    v_cap       numeric;
    v_total     numeric;
    v_change    numeric;
    v_received  numeric;
    v_method    text := lower(btrim(COALESCE(p_payment_method, '')));
    v_test      boolean := COALESCE(p_is_test, false);
    v_split     boolean := false;
    v_scash     numeric := COALESCE(p_split_cash, 0);
    v_sxfer     numeric := COALESCE(p_split_transfer, 0);
    item        jsonb;
    v_rid       uuid;
    v_qty       int;
    v_price     numeric;
    v_name      text;
    shortage    record;
  BEGIN
    IF p_client_uuid IS NULL THEN
      RAISE EXCEPTION 'client_uuid is required' USING ERRCODE = '22023';
    END IF;

    -- same checkout sent again: return the first result, change nothing
    SELECT * INTO v_existing FROM public.orders WHERE client_uuid = p_client_uuid;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_id', v_existing.id, 'queue_number', v_existing.queue_number,
        'receipt_number', v_existing.receipt_number, 'subtotal_lak', v_existing.subtotal_lak,
        'discount_lak', v_existing.discount_amount, 'total_lak', v_existing.total_lak,
        'change_lak', v_existing.change_amount, 'status', v_existing.status, 'duplicate', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
      RAISE EXCEPTION 'shop not found' USING ERRCODE = 'P0002';
    END IF;
    -- a test bill skips stock, sales and the drawer count, so it is only accepted inside a test
    -- window a manager opened with a PIN (060); an offline bill replayed later is kept as a real sale
    IF v_test AND NOT EXISTS (
      SELECT 1 FROM public.pos_test_windows w
      WHERE w.shop_id = p_shop_id AND w.started_at <= v_created AND v_created < COALESCE(w.ended_at, w.ends_at)
    ) THEN
      IF NOT v_replay THEN
        RAISE EXCEPTION 'TEST_MODE_OFF' USING ERRCODE = '42501';
      END IF;
      v_test := false;
    END IF;
    IF v_employee IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.employees WHERE id = v_employee AND shop_id = p_shop_id AND is_active
    ) THEN
      IF NOT v_replay THEN
        RAISE EXCEPTION 'employee is not an active member of this shop' USING ERRCODE = '42501';
      END IF;
      v_employee := NULL;
    END IF;
    IF v_method NOT IN ('cash', 'qr', 'transfer', 'card', 'split') THEN
      RAISE EXCEPTION 'unknown payment method: %', p_payment_method USING ERRCODE = '22023';
    END IF;
    IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' OR jsonb_array_length(p_cart) = 0 THEN
      RAISE EXCEPTION 'cart is empty' USING ERRCODE = '22023';
    END IF;
    IF v_created < now() - interval '30 days' THEN
      RAISE EXCEPTION 'sale time out of range' USING ERRCODE = '22023';
    END IF;

    -- prices from the menu, never from the client
    FOR item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
      v_rid := NULLIF(item->>'recipe_id', '')::uuid;
      v_qty := (item->>'qty')::int;
      IF v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN
        RAISE EXCEPTION 'invalid quantity' USING ERRCODE = '22023';
      END IF;
      SELECT price_lak, product_name INTO v_price, v_name
      FROM public.recipes WHERE id = v_rid AND (v_replay OR (COALESCE(is_active, true) AND NOT COALESCE(is_archived, false)));
      IF NOT FOUND THEN
        RAISE EXCEPTION 'menu item not available: %', COALESCE(item->>'recipe_id', '?') USING ERRCODE = 'P0002';
      END IF;
      v_subtotal := v_subtotal + v_qty * v_price;
    END LOOP;

    IF v_discount < 0 OR v_discount > v_subtotal THEN
      RAISE EXCEPTION 'discount must be between 0 and the subtotal' USING ERRCODE = '22023';
    END IF;
    -- cap = 15% + the customer's VIP % (lib/loyalty.ts defaults), then the POS rounds the amount
    -- to pay down to 500 or 1,000: allow the 1,000 rounding, the larger of the two
    IF v_discount > 0 THEN
      v_cap := round(v_subtotal * (15 + COALESCE((SELECT CASE c.vip_tier WHEN 'platinum' THEN 10 WHEN 'gold' THEN 5 ELSE 0 END
                                                  FROM public.customers c WHERE c.id = p_customer_id), 0)) / 100);
      v_cap := v_subtotal - GREATEST(floor((v_subtotal - v_cap) / 1000) * 1000, 0);
      IF v_discount > v_cap AND NOT EXISTS (SELECT 1 FROM public.pos_discount_approvals a
          WHERE a.client_uuid = p_client_uuid AND a.shop_id = p_shop_id AND a.max_discount_lak >= v_discount) THEN
        RAISE EXCEPTION 'DISCOUNT_NEEDS_PIN' USING ERRCODE = '42501', DETAIL = v_cap::text;
      END IF;
    END IF;
    v_total := v_subtotal - v_discount;

    IF v_replay AND p_expected_total IS DISTINCT FROM v_total THEN
      v_note := concat_ws(' · ', v_note, 'ออฟไลน์คิดเงิน ' || COALESCE(p_expected_total::text, '?') || ' ₭ ราคาระบบ ' || v_total || ' ₭');
    ELSIF p_expected_total IS NULL OR p_expected_total <> v_total THEN
      RAISE EXCEPTION 'PRICE_CHANGED' USING DETAIL = v_total::text,
        HINT = 'menu prices changed since the POS loaded; reload and try again';
    END IF;

    IF v_method = 'cash' THEN
      v_received := COALESCE(p_amount_received, 0);
      IF v_received < v_total AND NOT v_replay THEN
        RAISE EXCEPTION 'cash received is less than the total' USING ERRCODE = '22023';
      END IF;
      v_change := GREATEST(v_received - v_total, 0);
    ELSIF v_method = 'split' AND (p_split_cash IS NOT NULL OR p_split_transfer IS NOT NULL) THEN
      v_split := true;
      IF v_scash < 0 OR v_sxfer < 0 THEN
        RAISE EXCEPTION 'split parts must be 0 or more' USING ERRCODE = '22023';
      END IF;
      IF v_sxfer > v_total AND NOT v_replay THEN
        RAISE EXCEPTION 'the transfer part is more than the total' USING ERRCODE = '22023';
      END IF;
      IF v_scash + v_sxfer < v_total AND NOT v_replay THEN
        RAISE EXCEPTION 'the split payment is less than the total' USING ERRCODE = '22023';
      END IF;
      v_received := v_scash + v_sxfer;
      v_change := GREATEST(v_scash + v_sxfer - v_total, 0);
      v_xfer_part := LEAST(v_sxfer, v_total);
    ELSE
      v_received := NULLIF(p_amount_received, 0);
      v_change := NULL;
    END IF;

    -- an offline sale already happened: record it even if stock goes below zero
    IF NOT v_test AND p_created_at IS NULL THEN
      FOR shortage IN SELECT * FROM public.check_stock_for_cart(p_cart) WHERE NOT sufficient LOOP
        RAISE EXCEPTION 'Insufficient stock: "%" requires %, only % available',
          shortage.ingredient_name, shortage.required_qty, shortage.available_qty USING ERRCODE = 'P0001';
      END LOOP;
    END IF;

    -- queue + receipt numbers are counted across all shops (as before): one checkout at a time
    v_day := (v_created AT TIME ZONE 'Asia/Vientiane')::date;
    PERFORM pg_advisory_xact_lock(hashtext('alan_checkout'));
    -- an online sale is stamped after the lock, so a drawer count (which takes
    -- the same lock) never misses a sale that was still being saved
    IF NOT v_replay THEN
      v_created := clock_timestamp();
      v_day := (v_created AT TIME ZONE 'Asia/Vientiane')::date;
    END IF;

    -- the lock holder may find this checkout already saved by a concurrent call
    SELECT * INTO v_existing FROM public.orders WHERE client_uuid = p_client_uuid;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_id', v_existing.id, 'queue_number', v_existing.queue_number,
        'receipt_number', v_existing.receipt_number, 'subtotal_lak', v_existing.subtotal_lak,
        'discount_lak', v_existing.discount_amount, 'total_lak', v_existing.total_lak,
        'change_lak', v_existing.change_amount, 'status', v_existing.status, 'duplicate', true);
    END IF;

    IF p_queue_number IS NOT NULL AND p_queue_number > 0 AND NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE queue_number = p_queue_number AND (created_at AT TIME ZONE 'Asia/Vientiane')::date = v_day
    ) THEN
      v_queue := p_queue_number;
    ELSE
      SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_queue
      FROM public.orders
      WHERE (created_at AT TIME ZONE 'Asia/Vientiane')::date = v_day
        AND queue_number < 900;
    END IF;

    SELECT to_char(v_day, 'YYYYMMDD') || '-' || lpad((count(*) + 1)::text, 4, '0') INTO v_receipt
    FROM public.orders WHERE receipt_number LIKE to_char(v_day, 'YYYYMMDD') || '-%';

    INSERT INTO public.orders (
      client_uuid, shop_id, staff_id, employee_id, customer_id,
      payment_method, payment_currency, amount_received, change_amount,
      discount_lak, discount_amount, discount_reason,
      subtotal_lak, total_lak, table_number, customer_name, staff_note,
      queue_number, queue_status, receipt_number, is_test, status, created_at
    ) VALUES (
      p_client_uuid, p_shop_id, 'ff000000-0000-0000-0000-000000000001', v_employee, p_customer_id,
      v_method, 'LAK', v_received, v_change,
      v_discount, v_discount, NULLIF(btrim(COALESCE(p_discount_reason, '')), ''),
      v_subtotal, v_total, NULLIF(btrim(COALESCE(p_table_number, '')), ''),
      NULLIF(btrim(COALESCE(p_customer_name, '')), ''), v_note,
      v_queue, 'waiting', v_receipt, v_test, CASE WHEN v_test THEN 'test' ELSE 'paid' END, v_created
    )
    RETURNING id INTO v_order_id;

    -- what the bill was paid with (net of change)
    IF v_split THEN
      IF LEAST(v_scash, v_total - v_xfer_part) > 0 THEN
        INSERT INTO public.order_payments (order_id, method, amount_lak, created_at)
        VALUES (v_order_id, 'cash', LEAST(v_scash, v_total - v_xfer_part), v_created);
      END IF;
      IF v_xfer_part > 0 THEN
        INSERT INTO public.order_payments (order_id, method, amount_lak, created_at)
        VALUES (v_order_id, 'transfer', v_xfer_part, v_created);
      END IF;
    ELSE
      INSERT INTO public.order_payments (order_id, method, amount_lak, created_at)
      VALUES (v_order_id, v_method, CASE WHEN v_method = 'cash' AND v_received < v_total THEN v_received ELSE v_total END, v_created);
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
      v_rid := (item->>'recipe_id')::uuid;
      v_qty := (item->>'qty')::int;
      SELECT price_lak INTO v_price FROM public.recipes WHERE id = v_rid;
      INSERT INTO public.order_items (order_id, recipe_id, qty, unit_price_lak, customization)
      VALUES (v_order_id, v_rid, v_qty, v_price, NULLIF(item->>'customization', ''));
    END LOOP;

    IF NOT v_test THEN
      UPDATE public.inventory i
      SET current_qty = i.current_qty - use.qty, updated_at = now()
      FROM (
        SELECT ri.inventory_id, SUM(oi.qty * ri.qty_normal) AS qty
        FROM public.order_items oi
        JOIN public.recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
        WHERE oi.order_id = v_order_id AND ri.inventory_id IS NOT NULL
        GROUP BY ri.inventory_id
      ) use
      WHERE i.id = use.inventory_id;

      IF p_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET lifetime_spend_lak = COALESCE(lifetime_spend_lak, 0) + v_total,
            visit_count        = COALESCE(visit_count, 0) + 1,
            last_visit         = now(),
            updated_at         = now()
        WHERE id = p_customer_id;
      END IF;
    END IF;

    INSERT INTO public.audit_logs (staff_id, action, table_name, row_id, after_data)
    VALUES ('ff000000-0000-0000-0000-000000000001', 'create_order', 'orders', v_order_id,
      jsonb_build_object('order_id', v_order_id, 'queue_number', v_queue, 'total_lak', v_total,
        'payment_method', v_method, 'employee_id', v_employee, 'is_test', v_test,
        'offline', v_replay));

    RETURN jsonb_build_object(
      'order_id', v_order_id, 'queue_number', v_queue, 'receipt_number', v_receipt,
      'subtotal_lak', v_subtotal, 'discount_lak', v_discount, 'total_lak', v_total,
      'change_lak', v_change, 'status', CASE WHEN v_test THEN 'test' ELSE 'paid' END, 'duplicate', false);
  END;
  $function$;

  -- ---- tests ----
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST061 cashier', 'cashier', extensions.crypt(c_cash_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_cashier;
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST061 manager', 'manager', extensions.crypt(c_mgr_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_mgr;
  INSERT INTO public.customers (name, vip_tier) VALUES ('TEST061 platinum', 'platinum') RETURNING id INTO v_plat;
  INSERT INTO public.customers (name, vip_tier) VALUES ('TEST061 regular', 'regular') RETURNING id INTO v_reg;
  v_cart := jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 7));
  v_sub := 7 * v_price;
  -- what the POS gives at most with its buttons: round the raw % to the next 1,000 down of the amount to pay
  v_cap15 := v_sub - GREATEST(floor((v_sub - round(v_sub * 15 / 100.0)) / 1000) * 1000, 0);
  v_cap25 := v_sub - GREATEST(floor((v_sub - round(v_sub * 25 / 100.0)) / 1000) * 1000, 0);

  -- T1 discount at the cap is accepted with no PIN
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_sub, v_cap15, 'T1', NULL, NULL, NULL, false, v_sub - v_cap15);
    report := report || CASE WHEN (v_res->>'discount_lak')::numeric = v_cap15 THEN E'\nPASS T1 discount at the cap accepted' ELSE E'\nFAIL T1 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'
FAIL T1 refused: ' || SQLERRM;
  END;

  -- T2 one kip above the cap is refused
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_sub, v_cap15 + 1, 'T2', NULL, NULL, NULL, false, v_sub - v_cap15 - 1);
    report := report || E'\nFAIL T2 discount above the cap accepted';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM = 'DISCOUNT_NEEDS_PIN' THEN E'\nPASS T2 above the cap refused' ELSE E'\nFAIL T2 wrong error: ' || SQLERRM END;
  END;

  -- T3 a Platinum customer gets 15% + 10% / T4 a regular customer does not
  BEGIN
    v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, v_plat, 'cash', v_sub, v_cap25, 'T3', NULL, NULL, NULL, false, v_sub - v_cap25);
    report := report || CASE WHEN (v_res->>'discount_lak')::numeric = v_cap25 THEN E'\nPASS T3 Platinum cap is 25%' ELSE E'\nFAIL T3 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'
FAIL T3 refused: ' || SQLERRM;
  END;
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, v_reg, 'cash', v_sub, v_cap25, 'T4', NULL, NULL, NULL, false, v_sub - v_cap25);
    report := report || CASE WHEN v_cap25 > v_cap15 THEN E'\nFAIL T4 regular customer got 25%' ELSE E'\nPASS T4 (bill too small to tell)' END;
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM = 'DISCOUNT_NEEDS_PIN' THEN E'\nPASS T4 regular customer capped at 15%' ELSE E'\nFAIL T4 wrong error: ' || SQLERRM END;
  END;

  -- T5 wrong PIN / T6 cashier PIN do not approve
  v_uuid := gen_random_uuid();
  v_res := public.pos_discount_approve(c_shop, v_uuid, v_sub, '0000');
  report := report || CASE WHEN v_res->>'ok' = 'false' AND v_res->>'error' = 'invalid_pin' THEN E'\nPASS T5 wrong PIN refused' ELSE E'\nFAIL T5 ' || v_res::text END;
  v_res := public.pos_discount_approve(c_shop, v_uuid, v_sub, c_cash_pin);
  report := report || CASE WHEN v_res->>'ok' = 'false' THEN E'\nPASS T6 cashier PIN refused' ELSE E'\nFAIL T6 cashier approved' END;
  SELECT count(*) INTO v_n FROM public.pos_discount_approvals WHERE client_uuid = v_uuid;
  report := report || CASE WHEN v_n = 0 THEN E'\nPASS T7 nothing approved after refused PINs' ELSE E'\nFAIL T7 approval row written' END;

  -- T8 manager approves half the bill; that bill goes through
  v_res := public.pos_discount_approve(c_shop, v_uuid, round(v_sub / 2), c_mgr_pin);
  report := report || CASE WHEN v_res->>'ok' = 'true' AND v_res->>'by' = 'TEST061 manager' THEN E'\nPASS T8 manager PIN approves' ELSE E'\nFAIL T8 ' || v_res::text END;
  BEGIN
    v_res := public.checkout_order(v_uuid, c_shop, v_cashier, v_cart, NULL, 'cash', v_sub, round(v_sub / 2), 'T8', NULL, NULL, NULL, false, v_sub - round(v_sub / 2));
    report := report || CASE WHEN (v_res->>'discount_lak')::numeric = round(v_sub / 2) THEN E'\nPASS T9 approved bill accepted' ELSE E'\nFAIL T9 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'
FAIL T9 refused: ' || SQLERRM;
  END;

  -- T10 the approval covers only that bill / T11 and only up to the approved amount
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, v_cart, NULL, 'cash', v_sub, round(v_sub / 2), 'T10', NULL, NULL, NULL, false, v_sub - round(v_sub / 2));
    report := report || E'\nFAIL T10 approval reused on another bill';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM = 'DISCOUNT_NEEDS_PIN' THEN E'\nPASS T10 approval not reused on another bill' ELSE E'\nFAIL T10 ' || SQLERRM END;
  END;
  v_uuid := gen_random_uuid();
  PERFORM public.pos_discount_approve(c_shop, v_uuid, v_cap15 + 1000, c_mgr_pin);
  BEGIN
    PERFORM public.checkout_order(v_uuid, c_shop, v_cashier, v_cart, NULL, 'cash', v_sub, v_cap15 + 2000, 'T11', NULL, NULL, NULL, false, v_sub - v_cap15 - 2000);
    report := report || E'\nFAIL T11 discount above the approved amount accepted';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM = 'DISCOUNT_NEEDS_PIN' THEN E'\nPASS T11 limited to the approved amount' ELSE E'\nFAIL T11 ' || SQLERRM END;
  END;

  -- T12 an offline replay of an approved bill goes through
  v_uuid := gen_random_uuid();
  PERFORM public.pos_discount_approve(c_shop, v_uuid, v_sub, c_mgr_pin);
  BEGIN
    v_res := public.checkout_order(v_uuid, c_shop, v_cashier, v_cart, NULL, 'cash', v_sub, v_sub, 'T12', NULL, NULL, NULL, false, 0, now() - interval '1 hour', 902);
    report := report || CASE WHEN (v_res->>'total_lak')::numeric = 0 THEN E'\nPASS T12 approved offline replay accepted' ELSE E'\nFAIL T12 ' || v_res::text END;
  EXCEPTION WHEN OTHERS THEN report := report || E'
FAIL T12 refused: ' || SQLERRM;
  END;

  -- T13 grants: the app can call approve, nobody touches the table directly
  report := report || CASE WHEN has_function_privilege('anon', 'public.pos_discount_approve(uuid,uuid,numeric,text)', 'EXECUTE')
      AND NOT has_table_privilege('anon', 'public.pos_discount_approvals', 'SELECT')
      AND NOT has_table_privilege('anon', 'public.pos_discount_approvals', 'INSERT')
      AND NOT has_table_privilege('authenticated', 'public.pos_discount_approvals', 'INSERT')
      THEN E'\nPASS T13 grants' ELSE E'\nFAIL T13 grants' END;

  RAISE EXCEPTION '061 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
