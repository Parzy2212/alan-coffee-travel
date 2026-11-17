-- ============================================================
--  Test for migration 060 (test mode needs a manager PIN)
--
--  CHANGES NOTHING. The whole file is ONE DO block that always ends in an
--  error ("060 TEST RESULTS ..."), so Postgres rolls everything back: the
--  new table and functions, two test employees (PINs 7391 cashier, 8264
--  manager), test sales and any Telegram message queued (pg_net only sends
--  after a commit). Every line of the report should start with PASS.
--  The Telegram "large order" trigger is switched off first inside the block.
--
--  Run in Supabase SQL Editor as postgres: paste the whole file, Run, copy
--  the error text back. Needs 059 already run.
--  The migration part is a generated copy of
--  supabase/migrations/060_test_mode_manager_pin.sql -- keep in sync.
-- ============================================================

DO $test$
DECLARE
  c_shop constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_cash_pin constant text := '7391';
  c_mgr_pin  constant text := '8264';
  report text := '';
  v_cashier uuid; v_mgr uuid; v_recipe uuid; v_price numeric;
  v_res jsonb; v_n int; v_from timestamptz := now() - interval '1 second';
  v_orders int; v_orders_md5 text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cash_check_pin') THEN
    RAISE EXCEPTION '060 TEST: run 059 first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE shop_id = c_shop AND is_active
             AND (pin_hash = extensions.crypt(c_cash_pin, pin_hash) OR pin_hash = extensions.crypt(c_mgr_pin, pin_hash))) THEN
    RAISE EXCEPTION '060 TEST: a real employee uses PIN % or % -- change them at the top and run again', c_cash_pin, c_mgr_pin;
  END IF;
  SELECT id, price_lak INTO v_recipe, v_price FROM public.recipes
   WHERE COALESCE(is_active, true) AND NOT COALESCE(is_archived, false) AND price_lak > 0
   ORDER BY created_at, id LIMIT 1;
  IF v_recipe IS NULL THEN RAISE EXCEPTION '060 TEST: no active menu item to sell'; END IF;
  ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;
  SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t.id), '')), count(*) INTO v_orders_md5, v_orders FROM public.orders t;

  -- ---- body of 060 ----
  -- 1) test windows --------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS public.pos_test_windows (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id    uuid NOT NULL REFERENCES public.shops(id),
    started_at timestamptz NOT NULL DEFAULT now(),
    ends_at    timestamptz NOT NULL,
    ended_at   timestamptz,
    started_by uuid REFERENCES public.employees(id)
  );
  CREATE INDEX IF NOT EXISTS pos_test_windows_shop_idx ON public.pos_test_windows (shop_id, started_at DESC);
  ALTER TABLE public.pos_test_windows ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.pos_test_windows FROM PUBLIC, anon, authenticated;
  GRANT ALL ON public.pos_test_windows TO service_role;

  -- 2) start / stop / state (called by the POS as anon; the manager PIN is the check)
  CREATE OR REPLACE FUNCTION public.pos_test_mode_start(p_shop_id uuid, p_manager_pin text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    v_mgr  jsonb;
    v_ends timestamptz := now() + interval '30 minutes';
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
      RAISE EXCEPTION 'shop not found' USING ERRCODE = 'P0002';
    END IF;
    v_mgr := public.cash_check_pin(p_shop_id, p_manager_pin, true);
    IF v_mgr ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_mgr; END IF;

    UPDATE public.pos_test_windows SET ended_at = now()
    WHERE shop_id = p_shop_id AND ended_at IS NULL AND ends_at > now();
    INSERT INTO public.pos_test_windows (shop_id, ends_at, started_by)
    VALUES (p_shop_id, v_ends, (v_mgr->>'id')::uuid);
    PERFORM public.cash_notify(format(E'<b>มีการใช้ PIN ผู้จัดการ</b>\nเปิดโหมดทดสอบ 30 นาที (บิลทดสอบไม่เข้ายอดขายและลิ้นชัก)\nผู้จัดการ %s · %s',
      v_mgr->>'name', to_char(now() AT TIME ZONE 'Asia/Vientiane', 'DD/MM HH24:MI')));
    RETURN jsonb_build_object('ok', true, 'until', v_ends, 'by', v_mgr->>'name');
  END
  $fn$;

  CREATE OR REPLACE FUNCTION public.pos_test_mode_stop(p_shop_id uuid)
  RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    WITH u AS (
      UPDATE public.pos_test_windows SET ended_at = now()
      WHERE shop_id = p_shop_id AND ended_at IS NULL AND ends_at > now()
      RETURNING 1
    )
    SELECT jsonb_build_object('ok', true, 'stopped', (SELECT count(*) FROM u))
  $fn$;

  CREATE OR REPLACE FUNCTION public.pos_test_mode_state(p_shop_id uuid)
  RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    SELECT COALESCE(
      (SELECT jsonb_build_object('on', true, 'until', w.ends_at, 'by', e.name)
       FROM public.pos_test_windows w LEFT JOIN public.employees e ON e.id = w.started_by
       WHERE w.shop_id = p_shop_id AND w.ended_at IS NULL AND w.ends_at > now()
       ORDER BY w.started_at DESC LIMIT 1),
      jsonb_build_object('on', false))
  $fn$;

  REVOKE ALL ON FUNCTION public.pos_test_mode_start(uuid, text), public.pos_test_mode_stop(uuid),
    public.pos_test_mode_state(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.pos_test_mode_start(uuid, text), public.pos_test_mode_stop(uuid),
    public.pos_test_mode_state(uuid) TO anon, authenticated;

  -- 3) drawer sales: same as 059 plus test_bills / test_total ----------------------
  CREATE OR REPLACE FUNCTION public.cash_sales_between(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
  RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    WITH o AS (
      SELECT id, total_lak,
             (created_at > p_from AND created_at <= p_to
              AND (status = 'paid' OR (status = 'void' AND voided_at > p_to))) AS sold,
             (status = 'void' AND created_at <= p_from AND voided_at > p_from AND voided_at <= p_to) AS refund,
             (status = 'void' AND ((voided_at > p_from AND voided_at <= p_to)
                                   OR (voided_at IS NULL AND created_at > p_from AND created_at <= p_to))) AS voided_here
      FROM public.orders
      WHERE COALESCE(shop_id, '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid) = p_shop_id
        AND NOT COALESCE(is_test, false) AND status IN ('paid', 'void')
        AND (created_at > p_from OR voided_at > p_from)
    ), pay AS (
      SELECT p.method, count(DISTINCT p.order_id) AS bills, sum(p.amount_lak) AS amount
      FROM public.order_payments p JOIN o ON o.id = p.order_id AND o.sold
      GROUP BY p.method
    ), t AS (
      SELECT total_lak FROM public.orders
      WHERE COALESCE(shop_id, '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid) = p_shop_id
        AND (COALESCE(is_test, false) OR status = 'test')
        AND created_at > p_from AND created_at <= p_to
    ), ref AS (
      SELECT count(DISTINCT o.id) AS bills, COALESCE(sum(p.amount_lak), 0) AS cash
      FROM o LEFT JOIN public.order_payments p ON p.order_id = o.id AND p.method = 'cash'
      WHERE o.refund
    )
    SELECT jsonb_build_object(
      'by_method', COALESCE((SELECT jsonb_object_agg(method, jsonb_build_object('bills', bills, 'amount', amount)) FROM pay), '{}'::jsonb),
      'bills',     (SELECT count(*) FROM o WHERE sold),
      'total',     (SELECT COALESCE(sum(total_lak), 0) FROM o WHERE sold),
      'cash_sold', COALESCE((SELECT amount FROM pay WHERE method = 'cash'), 0),
      'refund_bills', (SELECT bills FROM ref),
      'refund_cash',  (SELECT cash FROM ref),
      'cash',      COALESCE((SELECT amount FROM pay WHERE method = 'cash'), 0) - (SELECT cash FROM ref),
      'void_bills', (SELECT count(*) FROM o WHERE voided_here),
      'void_total', (SELECT COALESCE(sum(total_lak), 0) FROM o WHERE voided_here),
      'test_bills', (SELECT count(*) FROM t),
      'test_total', (SELECT COALESCE(sum(total_lak), 0) FROM t))
  $fn$;

  -- 3b) what the POS shows while the drawer is open: same as 059 plus test bills
  CREATE OR REPLACE FUNCTION public.cash_session_state(p_shop_id uuid)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    s      public.cash_sessions%ROWTYPE;
    v_last public.cash_sessions%ROWTYPE;
    v_sales jsonb;
  BEGIN
    SELECT * INTO s FROM public.cash_sessions WHERE shop_id = p_shop_id AND status <> 'closed';
    IF NOT FOUND THEN
      SELECT * INTO v_last FROM public.cash_sessions
      WHERE shop_id = p_shop_id AND status = 'closed' ORDER BY closed_at DESC LIMIT 1;
      RETURN jsonb_build_object('session', NULL,
        'carried_over', v_last.counted_cash_lak,
        'carried_from', CASE WHEN v_last.id IS NULL THEN NULL ELSE jsonb_build_object(
          'counted_at', v_last.counted_at,
          'counted_by', (SELECT name FROM public.employees WHERE id = v_last.counted_by)) END);
    END IF;
    v_sales := public.cash_sales_between(p_shop_id, s.window_start, COALESCE(s.counted_at, now()));
    RETURN jsonb_build_object(
      'session', jsonb_build_object(
        'id', s.id, 'status', s.status, 'opened_at', s.opened_at,
        'opened_by', (SELECT name FROM public.employees WHERE id = s.opened_by),
        'opening_cash', s.opening_cash_lak, 'carried_over', s.carried_over_lak,
        'opening_reason', s.opening_reason,
        'counted_at', s.counted_at,
        'counted_by', (SELECT name FROM public.employees WHERE id = s.counted_by)),
      'movements', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'amount', m.amount_lak,
                 'category', m.category, 'note', m.note, 'at', m.created_at,
                 'by', (SELECT name FROM public.employees WHERE id = m.employee_id))
               ORDER BY m.created_at)
        FROM public.cash_movements m WHERE m.session_id = s.id AND m.voided_at IS NULL), '[]'::jsonb),
      -- before the count: bill counts for every type, amounts only for non-cash
      'sales', CASE WHEN s.status = 'open'
        THEN jsonb_build_object('bills', v_sales->'bills', 'void_bills', v_sales->'void_bills',
               'refund_bills', v_sales->'refund_bills',
               'test_bills', v_sales->'test_bills', 'test_total', v_sales->'test_total',
               'by_method', (SELECT COALESCE(jsonb_object_agg(k, CASE WHEN k = 'cash' THEN jsonb_build_object('bills', v->'bills') ELSE v END), '{}'::jsonb)
                             FROM jsonb_each(v_sales->'by_method') AS e(k, v)))
        ELSE v_sales END,
      'result', CASE WHEN s.status = 'open' THEN NULL ELSE jsonb_build_object(
        'counted', s.counted_cash_lak, 'expected', s.expected_cash_lak, 'difference', s.difference_lak,
        'cash_sales', s.cash_sales_lak, 'paid_out', s.paid_out_lak, 'paid_in', s.paid_in_lak,
        'recounts', s.recounts) END);
  END
  $fn$;

  -- 4) checkout_order: same as 059 plus the test-window check ----------------------
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
  VALUES (c_shop, 'TEST060 cashier', 'cashier', extensions.crypt(c_cash_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_cashier;
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST060 manager', 'manager', extensions.crypt(c_mgr_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_mgr;
  UPDATE public.pos_test_windows SET ended_at = now() WHERE shop_id = c_shop AND ended_at IS NULL;

  -- T1 a test bill with no test window is refused
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)),
      NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, true, v_price);
    report := report || E'\nFAIL T1 test bill accepted without a test window';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM = 'TEST_MODE_OFF' THEN E'\nPASS T1 test bill refused without a window' ELSE E'\nFAIL T1 wrong error: ' || SQLERRM END;
  END;

  -- T2 wrong PIN / T3 cashier PIN / T4 no window opened
  v_res := public.pos_test_mode_start(c_shop, '0000');
  report := report || CASE WHEN v_res->>'ok' = 'false' AND v_res->>'error' = 'invalid_pin' THEN E'\nPASS T2 wrong PIN refused' ELSE E'\nFAIL T2 ' || v_res::text END;
  v_res := public.pos_test_mode_start(c_shop, c_cash_pin);
  report := report || CASE WHEN v_res->>'ok' = 'false' THEN E'\nPASS T3 cashier PIN refused' ELSE E'\nFAIL T3 cashier opened test mode' END;
  SELECT count(*) INTO v_n FROM public.pos_test_windows WHERE shop_id = c_shop AND ended_at IS NULL AND ends_at > now();
  report := report || CASE WHEN v_n = 0 THEN E'\nPASS T4 no window after refused PINs' ELSE E'\nFAIL T4 window opened' END;

  -- T5 manager PIN opens 30 min / T6 state on
  v_res := public.pos_test_mode_start(c_shop, c_mgr_pin);
  report := report || CASE WHEN v_res->>'ok' = 'true' AND v_res->>'by' = 'TEST060 manager'
      AND (v_res->>'until')::timestamptz = now() + interval '30 minutes' THEN E'\nPASS T5 manager PIN opens test mode for 30 min' ELSE E'\nFAIL T5 ' || v_res::text END;
  v_res := public.pos_test_mode_state(c_shop);
  report := report || CASE WHEN v_res->>'on' = 'true' THEN E'\nPASS T6 state shows on' ELSE E'\nFAIL T6 ' || v_res::text END;

  -- T7 test bill inside the window / T8 a real bill still works
  v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)),
    NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, true, v_price);
  report := report || CASE WHEN v_res->>'status' = 'test' THEN E'\nPASS T7 test bill accepted inside the window' ELSE E'\nFAIL T7 ' || v_res::text END;
  v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)),
    NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, false, v_price);
  report := report || CASE WHEN v_res->>'status' = 'paid' THEN E'\nPASS T8 real bill unchanged' ELSE E'\nFAIL T8 ' || v_res::text END;

  -- T9 the drawer window counts the test bill apart from sales
  v_res := public.cash_sales_between(c_shop, v_from, clock_timestamp());
  report := report || CASE WHEN (v_res->>'test_bills')::int = 1 AND (v_res->>'test_total')::numeric = v_price
      AND (v_res->>'bills')::int = 1 THEN E'\nPASS T9 summary counts 1 test bill apart from sales' ELSE E'\nFAIL T9 ' || v_res::text END;

  -- T14 the open drawer screen gets the test bills, still without the cash amount
  IF NOT EXISTS (SELECT 1 FROM public.cash_sessions WHERE shop_id = c_shop AND status IN ('open', 'counted')) THEN
    INSERT INTO public.cash_sessions (shop_id, status, opening_cash_lak, window_start) VALUES (c_shop, 'open', 0, v_from);
  ELSE
    UPDATE public.cash_sessions SET status = 'open', counted_at = NULL, window_start = v_from WHERE shop_id = c_shop AND status IN ('open', 'counted');
  END IF;
  -- now() stands still inside this test while bills are stamped with the clock: put them at now()
  UPDATE public.orders SET created_at = now() WHERE created_at > now() AND shop_id = c_shop;
  v_res := (public.cash_session_state(c_shop))->'sales';
  report := report || CASE WHEN (v_res->>'test_bills')::int = 1 AND NOT (v_res ? 'cash') AND NOT (v_res ? 'total')
      AND NOT ((v_res->'by_method'->'cash') ? 'amount') THEN E'\nPASS T14 open drawer shows test bills, cash still hidden' ELSE E'\nFAIL T14 ' || COALESCE(v_res::text, 'null') END;

  -- T10 stop turns it off / T11 test bill refused again
  PERFORM public.pos_test_mode_stop(c_shop);
  report := report || CASE WHEN (public.pos_test_mode_state(c_shop))->>'on' = 'false' THEN E'\nPASS T10 stop turns it off' ELSE E'\nFAIL T10' END;
  BEGIN
    PERFORM public.checkout_order(gen_random_uuid(), c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)),
      NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, true, v_price);
    report := report || E'\nFAIL T11 test bill accepted after stop';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM = 'TEST_MODE_OFF' THEN E'\nPASS T11 refused after stop' ELSE E'\nFAIL T11 ' || SQLERRM END;
  END;

  -- T12 an offline test bill sold outside any window is kept as a real sale
  v_res := public.checkout_order(gen_random_uuid(), c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)),
    NULL, 'cash', v_price, 0, NULL, NULL, NULL, NULL, true, v_price, now() - interval '2 hours', 901);
  report := report || CASE WHEN v_res->>'status' = 'paid' THEN E'\nPASS T12 offline test bill outside a window saved as real' ELSE E'\nFAIL T12 ' || v_res::text END;

  -- T13 grants: the app can call the functions, nobody touches the table directly
  report := report || CASE WHEN has_function_privilege('anon', 'public.pos_test_mode_start(uuid,text)', 'EXECUTE')
      AND has_function_privilege('anon', 'public.pos_test_mode_state(uuid)', 'EXECUTE')
      AND NOT has_table_privilege('anon', 'public.pos_test_windows', 'SELECT')
      AND NOT has_table_privilege('authenticated', 'public.pos_test_windows', 'INSERT')
      AND NOT has_function_privilege('anon', 'public.cash_sales_between(uuid,timestamptz,timestamptz)', 'EXECUTE')
      THEN E'\nPASS T13 grants' ELSE E'\nFAIL T13 grants' END;

  RAISE EXCEPTION '060 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
