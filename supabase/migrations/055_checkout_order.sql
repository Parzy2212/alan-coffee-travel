-- ============================================================
--  055: one atomic checkout (package A+B) + TEST bills kept out of sales
--
--  Before (live definitions read 2026-11-11):
--    create_order_with_deduction marked the bill paid with total = client
--    prices and no discount; payment method / received / change / discount /
--    receipt number came later in finalize_order_payment (fire-and-forget);
--    employee_id and is_test were anon table UPDATEs that RLS silently
--    blocked, so TEST bills counted as real sales, deducted stock and posted
--    cash flow. Cash flow posted the pre-discount total on the UTC date and
--    a void never took it back. Customer spend/visits would be counted twice
--    (function + trg_award_loyalty) as soon as orders.shop_id was set.
--
--  Now:
--    checkout_order(...) does everything in one transaction:
--      - prices from recipes.price_lak (client prices ignored);
--        p_expected_total must match or nothing is saved (PRICE_CHANGED)
--      - discount 0..subtotal, total = subtotal - discount
--      - cash: received >= total, change = received - total
--      - shop_id, employee_id (must be an active employee of the shop),
--        queue number + receipt number under an advisory lock
--      - p_client_uuid: the same checkout sent twice (double tap, offline
--        replay) returns the first order instead of a second one
--      - p_is_test: status 'test' (every report and trigger filters
--        status = 'paid'), no stock, no customer stats, no cash flow
--      - offline replay (p_created_at set; last 30 days, a future time is
--        clamped to now): keeps the queue number printed offline when still
--        free; the sale already happened, so it is recorded, not rejected:
--        no stock check (stock may go below 0), archived menu items and a
--        removed employee are accepted, and a price change since is saved
--        at menu prices with a staff note showing what was charged offline
--    trg_fn_order_to_cashflow: Vientiane date, shop_id, skips total 0
--    award_loyalty_points: points/tier only (spend + visits are counted
--      once, by checkout_order)
--    void_order_with_approval: voids 'paid' and 'test' bills; for paid
--      bills also reverses cash flow (expense row 'คืนเงินยกเลิกบิล');
--      customer spend/visits reversed once
--    get_today_pos_queue: also lists TEST bills (barista panel)
--    existing orders: all are test data (the shop has never sold through
--      this POS) -> is_test = true, 'paid' -> 'test'. Kept, never deleted.
--
--  Unchanged on purpose: create_order_with_deduction / finalize_order_payment
--  stay callable until the new POS build is deployed (056 revokes them).
--  Trust model unchanged (anon may call; package F moves POS to sessions).
--
--  ONE DO block (the SQL Editor does not keep BEGIN open). p_test = true:
--  installs everything, runs the checks below, then ends in an error so
--  nothing is kept. Run once with true, read the message, then with false.
-- ============================================================

DO $migration$
DECLARE
  p_test CONSTANT boolean := true;   -- step 1: true (test)   step 2: false (real)
  p_mark_old_test CONSTANT boolean := true;   -- all bills made before 055 become TEST bills (kept)
  c_shop CONSTANT uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  v_marked int;
  -- test variables
  v_emp uuid; v_rec uuid; v_price numeric; v_inv uuid; v_qty_ing numeric; v_stock0 numeric; v_stock1 numeric;
  r jsonb; r2 jsonb; v_cf int; v_n int; v_cust uuid; v_txt text; v_ok boolean;
BEGIN
  -- 1. idempotency key
  EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_uuid uuid';
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS orders_client_uuid_key ON public.orders (client_uuid) WHERE client_uuid IS NOT NULL';

  -- 2. checkout
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.checkout_order(
  p_client_uuid     uuid,
  p_shop_id         uuid,
  p_employee_id     uuid,
  p_cart            jsonb,
  p_customer_id     uuid,
  p_payment_method  text,
  p_amount_received numeric,
  p_discount_lak    numeric,
  p_discount_reason text,
  p_table_number    text,
  p_customer_name   text,
  p_staff_note      text,
  p_is_test         boolean,
  p_expected_total  numeric,
  p_created_at      timestamptz DEFAULT NULL,
  p_queue_number    integer     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_existing  public.orders%ROWTYPE;
  -- offline replay: the sale already happened, so record it rather than reject it
  v_replay    boolean := p_created_at IS NOT NULL;
  v_created   timestamptz := LEAST(COALESCE(p_created_at, now()), now());
  v_employee  uuid := p_employee_id;
  v_note      text := NULLIF(btrim(COALESCE(p_staff_note, '')), '');
  v_day       date;
  v_order_id  uuid;
  v_queue     int;
  v_receipt   text;
  v_subtotal  numeric := 0;
  v_discount  numeric := COALESCE(p_discount_lak, 0);
  v_total     numeric;
  v_change    numeric;
  v_received  numeric;
  v_method    text := lower(btrim(COALESCE(p_payment_method, '')));
  v_test      boolean := COALESCE(p_is_test, false);
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
$body$
$fn$;
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.checkout_order(uuid, uuid, uuid, jsonb, uuid, text, numeric, numeric, text, text, text, text, boolean, numeric, timestamptz, integer) FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.checkout_order(uuid, uuid, uuid, jsonb, uuid, text, numeric, numeric, text, text, text, text, boolean, numeric, timestamptz, integer) TO anon, authenticated';

  -- 3. cash flow: final total, Vientiane date, shop, nothing for a 0 total
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.trg_fn_order_to_cashflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $body$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
     AND COALESCE(NEW.total_lak, 0) > 0 THEN
    INSERT INTO cash_flow (type, category, amount_lak, description, reference_id, payment_method, date, shop_id)
    VALUES ('income', 'ยอดขาย', NEW.total_lak,
      'Order #' || COALESCE(NEW.queue_number::text, '?') || ' ' || COALESCE(NEW.receipt_number, NEW.id::text),
      NEW.id, COALESCE(NEW.payment_method, 'cash'),
      (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Vientiane')::date, NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$body$
$fn$;

  -- 4. loyalty trigger: points and tier only
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.award_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_settings loyalty_settings%ROWTYPE;
  v_points   integer;
  v_new_pts  integer;
BEGIN
  IF NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
     AND NEW.customer_id IS NOT NULL
     AND NEW.shop_id IS NOT NULL
  THEN
    SELECT * INTO v_settings FROM loyalty_settings WHERE shop_id = NEW.shop_id;
    IF FOUND AND v_settings.enabled THEN
      v_points := GREATEST(0, FLOOR(COALESCE(NEW.total_lak, 0) * COALESCE(v_settings.points_per_lak, 0.0001))::integer);
      IF v_points > 0 THEN
        UPDATE customers
        SET loyalty_points = COALESCE(loyalty_points, 0) + v_points, updated_at = now()
        WHERE id = NEW.customer_id
        RETURNING loyalty_points INTO v_new_pts;

        INSERT INTO loyalty_transactions (shop_id, customer_id, order_id, type, points, description)
        VALUES (NEW.shop_id, NEW.customer_id, NEW.id, 'earn', v_points,
                'Earned from order #' || COALESCE(NEW.queue_number::text, '?'));

        UPDATE customers SET vip_tier = CASE
          WHEN v_new_pts >= COALESCE(v_settings.vip_platinum_threshold, 5000) THEN 'platinum'
          WHEN v_new_pts >= COALESCE(v_settings.vip_gold_threshold, 2000) THEN 'gold'
          WHEN v_new_pts >= COALESCE(v_settings.vip_silver_threshold, 500) THEN 'silver'
          ELSE 'regular' END
        WHERE id = NEW.customer_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$body$
$fn$;

  -- 5. void: paid and test bills; paid bills also reverse cash flow; spend/visits once
  EXECUTE $fn$
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
AS $body$
DECLARE
  v_order    public.orders%ROWTYPE;
  v_reason   text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_scope    text := 'void:' || p_shop_id::text;
  v_wait     int;
  v_mgr_id   uuid;
  v_mgr_name text;
  v_earn_pts int;
  v_income   numeric;
  v_now      timestamptz := now();
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to void a bill' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;
  -- bills made before 055 have shop_id NULL: they belong to the real shop
  IF COALESCE(v_order.shop_id, '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid) IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'order belongs to another shop' USING ERRCODE = '42501';
  END IF;
  IF v_order.status IS NULL OR v_order.status NOT IN ('paid', 'test') THEN
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

  -- only a manager PIN counts as success; no RAISE after a failed PIN (it would roll the count back)
  PERFORM public.pin_attempt_record(v_scope, v_mgr_id IS NOT NULL, 5, 60, 1800);
  IF v_mgr_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  UPDATE public.orders
  SET status = 'void', void_reason = v_reason, voided_at = v_now, voided_by_employee_id = v_mgr_id
  WHERE id = p_order_id;

  IF v_order.status = 'paid' THEN
    UPDATE public.inventory i
    SET current_qty = i.current_qty + restore.qty, updated_at = v_now
    FROM (
      SELECT ri.inventory_id, SUM(oi.qty * ri.qty_normal) AS qty
      FROM public.order_items oi
      JOIN public.recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
      WHERE oi.order_id = p_order_id AND ri.inventory_id IS NOT NULL
      GROUP BY ri.inventory_id
    ) restore
    WHERE i.id = restore.inventory_id;

    IF v_order.customer_id IS NOT NULL THEN
      SELECT COALESCE(SUM(points), 0) INTO v_earn_pts
      FROM public.loyalty_transactions WHERE order_id = p_order_id AND type = 'earn';

      UPDATE public.customers
      SET lifetime_spend_lak = GREATEST(0, COALESCE(lifetime_spend_lak, 0) - COALESCE(v_order.total_lak, 0)),
          visit_count        = GREATEST(0, COALESCE(visit_count, 0) - 1),
          loyalty_points     = GREATEST(0, COALESCE(loyalty_points, 0) - v_earn_pts)
      WHERE id = v_order.customer_id;

      IF v_earn_pts > 0 THEN
        INSERT INTO public.loyalty_transactions (shop_id, customer_id, order_id, type, points, description)
        SELECT shop_id, customer_id, order_id, 'adjust', -v_earn_pts,
               'Voided order #' || COALESCE(v_order.queue_number::text, '?')
        FROM public.loyalty_transactions WHERE order_id = p_order_id AND type = 'earn' LIMIT 1;
      END IF;
    END IF;

    SELECT COALESCE(SUM(amount_lak), 0) INTO v_income
    FROM public.cash_flow WHERE reference_id = p_order_id AND type = 'income';
    IF v_income > 0 THEN
      INSERT INTO public.cash_flow (type, category, amount_lak, description, reference_id, payment_method, date, shop_id)
      VALUES ('expense', 'คืนเงินยกเลิกบิล', v_income,
        'Void order #' || COALESCE(v_order.queue_number::text, '?') || ': ' || v_reason,
        p_order_id, COALESCE(v_order.payment_method, 'cash'),
        (v_now AT TIME ZONE 'Asia/Vientiane')::date, COALESCE(v_order.shop_id, p_shop_id));
    END IF;
  END IF;

  INSERT INTO public.audit_logs (staff_id, action, table_name, row_id, after_data)
  VALUES (
    v_order.staff_id, 'void_order', 'orders', p_order_id,
    jsonb_build_object(
      'order_id', p_order_id, 'queue_number', v_order.queue_number,
      'total_lak', v_order.total_lak, 'reason', v_reason, 'was_test', v_order.status = 'test',
      'approved_by_employee_id', v_mgr_id, 'approved_by', v_mgr_name, 'voided_at', v_now
    )
  );

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'voided_at', v_now, 'approved_by', v_mgr_name);
END;
$body$
$fn$;

  -- 6. barista panel lists TEST bills too
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.get_today_pos_queue()
RETURNS TABLE(order_id uuid, queue_number integer, queue_status text, summary text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
BEGIN
  RETURN QUERY
    SELECT o.id, o.queue_number, o.queue_status,
      STRING_AGG(
        CASE WHEN oi.qty > 1 THEN r.product_name || ' x' || oi.qty ELSE r.product_name END
        || CASE WHEN oi.customization IS NOT NULL AND oi.customization <> '' THEN ' · ' || oi.customization ELSE '' END,
        ',  ' ORDER BY oi.id)
      || CASE WHEN o.status = 'test' THEN '  [TEST]' ELSE '' END
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN recipes r      ON r.id = oi.recipe_id
    WHERE o.status IN ('paid', 'test')
      AND (o.queue_status IS NULL OR o.queue_status IN ('waiting', 'making'))
      AND o.queue_number IS NOT NULL
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::date = (now() AT TIME ZONE 'Asia/Vientiane')::date
    GROUP BY o.id, o.queue_number, o.queue_status
    ORDER BY o.queue_number;
END;
$body$
$fn$;

  -- 7. every bill so far is test data: keep them, take them out of sales
  v_marked := 0;
  IF p_mark_old_test THEN
    UPDATE public.orders SET is_test = true WHERE client_uuid IS NULL AND NOT is_test;
    UPDATE public.orders SET status = 'test' WHERE client_uuid IS NULL AND status = 'paid';
    GET DIAGNOSTICS v_marked = ROW_COUNT;
  END IF;

  IF NOT p_test THEN
    RAISE NOTICE 'DONE: checkout_order installed; % old paid bills marked test.', v_marked;
    RETURN;
  END IF;

  -- ── checks (p_test only; everything below is rolled back by the final RAISE) ──
  EXECUTE 'ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram';

  SELECT id INTO v_emp FROM public.employees WHERE shop_id = c_shop AND is_active ORDER BY role = 'manager' DESC LIMIT 1;
  INSERT INTO public.inventory (name, unit, current_qty, is_active) VALUES ('__055 test', 'g', 1000, true) RETURNING id INTO v_inv;
  INSERT INTO public.recipes (product_name, price_lak, is_active) VALUES ('__055 test drink', 30000, true) RETURNING id INTO v_rec;
  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, qty_normal) VALUES (v_rec, v_inv, 18);
  INSERT INTO public.customers (name, phone) VALUES ('__055 test', '__055') RETURNING id INTO v_cust;
  v_txt := '[{"recipe_id":"' || v_rec || '","qty":2,"unit_price_lak":1,"customization":"ร้อน"}]';

  -- T1 real cash sale with discount: server price, totals, stock, cash flow, customer once
  r := public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, v_cust, 'cash', 100000, 5000, 'ทดสอบ', 'A1', 'ลูกค้า', NULL, false, 55000);
  IF (r->>'total_lak')::numeric <> 55000 OR (r->>'change_lak')::numeric <> 45000 OR r->>'status' <> 'paid' THEN
    RAISE EXCEPTION 'T1 FAIL totals %', r; END IF;
  SELECT current_qty INTO v_stock1 FROM public.inventory WHERE id = v_inv;
  IF v_stock1 <> 1000 - 36 THEN RAISE EXCEPTION 'T1 FAIL stock %', v_stock1; END IF;
  SELECT count(*) INTO v_cf FROM public.cash_flow WHERE reference_id = (r->>'order_id')::uuid AND type = 'income' AND amount_lak = 55000;
  IF v_cf <> 1 THEN RAISE EXCEPTION 'T1 FAIL cash flow rows %', v_cf; END IF;
  SELECT count(*) INTO v_n FROM public.orders WHERE id = (r->>'order_id')::uuid
    AND shop_id = c_shop AND employee_id IS NOT DISTINCT FROM v_emp AND receipt_number IS NOT NULL
    AND discount_amount = 5000 AND amount_received = 100000 AND table_number = 'A1' AND NOT is_test;
  IF v_n <> 1 THEN RAISE EXCEPTION 'T1 FAIL order fields'; END IF;
  SELECT count(*) INTO v_n FROM public.customers WHERE id = v_cust AND visit_count = 1 AND lifetime_spend_lak = 55000;
  IF v_n <> 1 THEN RAISE EXCEPTION 'T1 FAIL customer counted twice or not at all'; END IF;

  -- T2 same client_uuid again: same order, nothing doubled
  r2 := public.checkout_order('00000000-0000-0000-0000-0000000005a1', c_shop, v_emp, v_txt::jsonb, NULL, 'qr', NULL, 0, NULL, NULL, NULL, NULL, false, 60000);
  r  := public.checkout_order('00000000-0000-0000-0000-0000000005a1', c_shop, v_emp, v_txt::jsonb, NULL, 'qr', NULL, 0, NULL, NULL, NULL, NULL, false, 60000);
  IF r->>'order_id' <> r2->>'order_id' OR NOT (r->>'duplicate')::boolean THEN RAISE EXCEPTION 'T2 FAIL %', r; END IF;
  SELECT count(*) INTO v_n FROM public.orders WHERE client_uuid = '00000000-0000-0000-0000-0000000005a1';
  SELECT current_qty INTO v_stock1 FROM public.inventory WHERE id = v_inv;
  IF v_n <> 1 OR v_stock1 <> 1000 - 72 THEN RAISE EXCEPTION 'T2 FAIL rows % stock %', v_n, v_stock1; END IF;

  -- T3 TEST sale: status test, no stock, no cash flow, no customer stats
  r := public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, v_cust, 'cash', 60000, 0, NULL, NULL, NULL, NULL, true, 60000);
  SELECT current_qty INTO v_stock0 FROM public.inventory WHERE id = v_inv;
  SELECT count(*) INTO v_cf FROM public.cash_flow WHERE reference_id = (r->>'order_id')::uuid;
  SELECT count(*) INTO v_n FROM public.customers WHERE id = v_cust AND visit_count = 1;
  IF r->>'status' <> 'test' OR v_stock0 <> v_stock1 OR v_cf <> 0 OR v_n <> 1 THEN
    RAISE EXCEPTION 'T3 FAIL status % stock % cf % cust %', r->>'status', v_stock0, v_cf, v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_today_pos_queue() q WHERE q.order_id = (r->>'order_id')::uuid) THEN
    RAISE EXCEPTION 'T3 FAIL test bill missing from barista queue'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_today_orders() o WHERE o.id = (r->>'order_id')::uuid AND o.status = 'test') THEN
    RAISE EXCEPTION 'T3 FAIL test bill missing from today orders'; END IF;

  -- T4 rejected inputs: nothing saved
  SELECT count(*) INTO v_n FROM public.orders;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'cash', 100000, 0, NULL, NULL, NULL, NULL, false, 59999);
    RAISE EXCEPTION 'T4a FAIL price change accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'PRICE_CHANGED' THEN RAISE; END IF; END;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'cash', 50000, 0, NULL, NULL, NULL, NULL, false, 60000);
    RAISE EXCEPTION 'T4b FAIL short cash accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'cash', 100000, 70000, NULL, NULL, NULL, NULL, false, -10000);
    RAISE EXCEPTION 'T4c FAIL discount over subtotal accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, gen_random_uuid(), v_txt::jsonb, NULL, 'cash', 100000, 0, NULL, NULL, NULL, NULL, false, 60000);
    RAISE EXCEPTION 'T4d FAIL unknown employee accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, '[]'::jsonb, NULL, 'cash', 100000, 0, NULL, NULL, NULL, NULL, false, 0);
    RAISE EXCEPTION 'T4e FAIL empty cart accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, replace(v_txt, '"qty":2', '"qty":0')::jsonb, NULL, 'cash', 100000, 0, NULL, NULL, NULL, NULL, false, 0);
    RAISE EXCEPTION 'T4f FAIL qty 0 accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'bitcoin', 100000, 0, NULL, NULL, NULL, NULL, false, 60000);
    RAISE EXCEPTION 'T4g FAIL unknown payment method accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'cash', 100000, 0, NULL, NULL, NULL, NULL, false, 60000, now() - interval '40 days');
    RAISE EXCEPTION 'T4h FAIL old sale time accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF (SELECT count(*) FROM public.orders) <> v_n THEN RAISE EXCEPTION 'T4 FAIL a rejected checkout left a row'; END IF;

  -- T5 100% discount: total 0, no cash flow row, no error
  r := public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'cash', 0, 60000, 'ฟรี', NULL, NULL, NULL, false, 0);
  SELECT count(*) INTO v_cf FROM public.cash_flow WHERE reference_id = (r->>'order_id')::uuid;
  IF (r->>'total_lak')::numeric <> 0 OR v_cf <> 0 THEN RAISE EXCEPTION 'T5 FAIL %', r; END IF;

  -- T6 offline replay keeps the printed queue number when free
  r := public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'transfer', NULL, 0, NULL, NULL, NULL, NULL, false, 60000, now() - interval '10 minutes', 987);
  r2 := public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'transfer', NULL, 0, NULL, NULL, NULL, NULL, false, 60000, now() - interval '9 minutes', 987);
  IF (r->>'queue_number')::int <> 987 OR (r2->>'queue_number')::int = 987 OR (r2->>'queue_number')::int >= 900 THEN
    RAISE EXCEPTION 'T6 FAIL queues % %', r->>'queue_number', r2->>'queue_number'; END IF;

  -- T6b offline replay is recorded even when stock is short
  SELECT current_qty INTO v_stock0 FROM public.inventory WHERE id = v_inv;
  r := public.checkout_order(gen_random_uuid(), c_shop, v_emp, replace(v_txt, '"qty":2', '"qty":999')::jsonb, NULL, 'cash', 29970000, 0, NULL, NULL, NULL, NULL, false, 29970000, now() - interval '8 minutes');
  SELECT current_qty INTO v_stock1 FROM public.inventory WHERE id = v_inv;
  IF v_stock1 <> v_stock0 - 999 * 18 THEN RAISE EXCEPTION 'T6b FAIL stock % -> %', v_stock0, v_stock1; END IF;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, replace(v_txt, '"qty":2', '"qty":999')::jsonb, NULL, 'cash', 29970000, 0, NULL, NULL, NULL, NULL, false, 29970000);
    RAISE EXCEPTION 'T6c FAIL live sale with no stock accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Insufficient stock%' THEN RAISE; END IF; END;
  UPDATE public.inventory SET current_qty = 1000 WHERE id = v_inv;

  -- T6d offline replay after the price changed, the item was archived and the employee removed: saved, not lost
  UPDATE public.recipes SET price_lak = 32000, is_archived = true WHERE id = v_rec;
  r := public.checkout_order(gen_random_uuid(), c_shop, gen_random_uuid(), v_txt::jsonb, NULL, 'cash', 60000, 0, NULL, NULL, NULL, NULL, false, 60000, now() + interval '1 hour');
  SELECT count(*) INTO v_n FROM public.orders WHERE id = (r->>'order_id')::uuid AND employee_id IS NULL AND total_lak = 64000
    AND staff_note LIKE '%60000%64000%' AND created_at <= now() AND change_amount = 0;
  IF v_n <> 1 THEN RAISE EXCEPTION 'T6d FAIL %', r; END IF;
  BEGIN PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'cash', 100000, 0, NULL, NULL, NULL, NULL, false, 64000);
    RAISE EXCEPTION 'T6e FAIL archived item sold live'; EXCEPTION WHEN no_data_found THEN NULL; END;
  UPDATE public.recipes SET price_lak = 30000, is_archived = false WHERE id = v_rec;

  -- T7 void the T1-style sale: stock back, cash flow reversed, customer back to 0
  r := public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, v_cust, 'cash', 60000, 0, NULL, NULL, NULL, NULL, false, 60000);
  SELECT current_qty INTO v_stock0 FROM public.inventory WHERE id = v_inv;
  -- void needs a manager PIN; we cannot know it, so emulate the manager path directly
  UPDATE public.employees SET pin_hash = extensions.crypt('0550', extensions.gen_salt('bf')) WHERE id = v_emp AND role = 'manager';
  IF FOUND THEN
    DELETE FROM public.pin_attempts WHERE scope = 'void:' || c_shop::text;
    r2 := public.void_order_with_approval((r->>'order_id')::uuid, c_shop, '0550', 'ทดสอบยกเลิก');
    IF NOT (r2->>'ok')::boolean THEN RAISE EXCEPTION 'T7 FAIL void %', r2; END IF;
    SELECT current_qty INTO v_stock1 FROM public.inventory WHERE id = v_inv;
    SELECT count(*) INTO v_cf FROM public.cash_flow WHERE reference_id = (r->>'order_id')::uuid AND type = 'expense' AND amount_lak = 60000;
    SELECT count(*) INTO v_n FROM public.customers WHERE id = v_cust AND visit_count = 1 AND lifetime_spend_lak = 55000;
    IF v_stock1 <> v_stock0 + 36 OR v_cf <> 1 OR v_n <> 1 THEN
      RAISE EXCEPTION 'T7 FAIL stock % -> % cf % cust %', v_stock0, v_stock1, v_cf, v_n; END IF;
    -- T8 void a TEST bill: allowed, nothing to reverse
    r := public.checkout_order(gen_random_uuid(), c_shop, v_emp, v_txt::jsonb, NULL, 'cash', 60000, 0, NULL, NULL, NULL, NULL, true, 60000);
    DELETE FROM public.pin_attempts WHERE scope = 'void:' || c_shop::text;
    r2 := public.void_order_with_approval((r->>'order_id')::uuid, c_shop, '0550', 'ทดสอบ');
    SELECT count(*) INTO v_cf FROM public.cash_flow WHERE reference_id = (r->>'order_id')::uuid;
    IF NOT (r2->>'ok')::boolean OR v_cf <> 0 THEN RAISE EXCEPTION 'T8 FAIL %', r2; END IF;
    v_ok := true;
  ELSE
    v_ok := false;
  END IF;

  -- T9 old bills marked test, none left paid without a client_uuid
  SELECT count(*) INTO v_n FROM public.orders WHERE client_uuid IS NULL AND (status = 'paid' OR NOT is_test);
  IF p_mark_old_test AND v_n <> 0 THEN RAISE EXCEPTION 'T9 FAIL % old bills still count as sales', v_n; END IF;

  RAISE EXCEPTION 'TEST PASS: T1-T9 ok (void checks %), % old paid bills would be marked test. Nothing was kept. Set p_test := false and run again.',
    CASE WHEN v_ok THEN 'ran' ELSE 'SKIPPED: no active manager' END, v_marked;
END
$migration$;
