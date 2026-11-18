-- READ-ONLY, one SELECT. Why test-072 stopped at "checkout_order is not the 071 version":
-- compares production checkout_order / void_order_with_approval with the versions 072 was written
-- against (embedded below). CR and LF are removed on both sides (the SQL Editor or git may add CR
-- to the embedded copy), blank lines at the start and end are dropped, and lines are matched
-- without caring about order, so only lines that really differ are listed. Changes nothing.
WITH loc(fn, s) AS (VALUES
  ('checkout_order', $loc_co$
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
  -- an offline bill keeps its real sale time only within 24 hours and inside the open
  -- drawer session (071); an older one waits on the POS for a manager
  IF v_replay AND (v_created < now() - interval '24 hours' OR v_created < COALESCE(
       (SELECT s.opened_at FROM public.cash_sessions s WHERE s.shop_id = p_shop_id AND s.status <> 'closed'),
       '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'SALE_TOO_OLD: sold %, more than 24 hours ago or before the open drawer session',
      to_char(v_created AT TIME ZONE 'Asia/Vientiane', 'YYYY-MM-DD HH24:MI') USING ERRCODE = '22023';
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
  -- cap = 15% + the customer's VIP % (loyalty_settings, 070), then the POS rounds the amount
  -- to pay down to 500 or 1,000: allow the 1,000 rounding, the larger of the two
  IF v_discount > 0 THEN
    v_cap := round(v_subtotal * (15 + COALESCE((SELECT public.vip_discount_percent(p_shop_id, c.vip_tier)
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
$loc_co$::text),
  ('void_order_with_approval', $loc_void$
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
      VALUES ('income', 'ยกเลิกบิล', -v_income,
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
$loc_void$::text)
),
live AS (
  SELECT p.proname::text AS fn, count(*) OVER (PARTITION BY p.proname) AS versions, p.prosrc AS raw,
         row_number() OVER (PARTITION BY p.proname ORDER BY p.oid) AS pick
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('checkout_order', 'void_order_with_approval')
),
src AS (
  SELECT 'PRODUCTION' AS side, fn, raw AS s FROM live WHERE pick = 1
  UNION ALL SELECT 'LOCAL', fn, s FROM loc
),
lines AS (
  SELECT side, fn, n, replace(replace(l, E'\r', ''), E'\n', '') AS l
  FROM src, unnest(string_to_array(replace(src.s, E'\r', ''), E'\n')) WITH ORDINALITY AS u(l, n)
),
bounds AS (
  SELECT side, fn, min(n) FILTER (WHERE btrim(l) <> '') AS lo, max(n) FILTER (WHERE btrim(l) <> '') AS hi
  FROM lines GROUP BY side, fn
),
body AS (
  SELECT x.side, x.fn, x.n - b.lo + 1 AS n, x.l,
         row_number() OVER (PARTITION BY x.side, x.fn, x.l ORDER BY x.n) AS k
  FROM lines x JOIN bounds b USING (side, fn) WHERE x.n BETWEEN b.lo AND b.hi
),
clean AS (
  SELECT side, fn, string_agg(l, E'\n' ORDER BY n) AS s, count(*) AS line_count FROM body GROUP BY side, fn
),
only_one AS (
  SELECT a.side, a.fn, a.n, a.l
  FROM body a
  WHERE NOT EXISTS (SELECT 1 FROM body b WHERE b.fn = a.fn AND b.side <> a.side AND b.l = a.l AND b.k = a.k)
),
ranked AS (
  SELECT *, row_number() OVER (PARTITION BY side, fn ORDER BY n) AS r FROM only_one
)
SELECT fn, 0 AS sort, 'versions on production' AS what, COALESCE(max(versions)::text, '0 (missing)') AS detail
FROM (SELECT fn FROM loc) f LEFT JOIN live USING (fn) GROUP BY fn
UNION ALL
SELECT p.fn, 1, 'md5 production / local (no CR, trimmed)', md5(p.s) || ' / ' || md5(l.s)
FROM clean p JOIN clean l ON l.fn = p.fn AND l.side = 'LOCAL' WHERE p.side = 'PRODUCTION'
UNION ALL
SELECT p.fn, 2, 'length production / local (no CR, trimmed)', length(p.s) || ' / ' || length(l.s)
FROM clean p JOIN clean l ON l.fn = p.fn AND l.side = 'LOCAL' WHERE p.side = 'PRODUCTION'
UNION ALL
SELECT p.fn, 3, 'lines production / local', p.line_count || ' / ' || l.line_count
FROM clean p JOIN clean l ON l.fn = p.fn AND l.side = 'LOCAL' WHERE p.side = 'PRODUCTION'
UNION ALL
SELECT fn, (CASE side WHEN 'PRODUCTION' THEN 10000 ELSE 20000 END + n)::int, 'only ' || side || ', line ' || n, left(l, 220)
FROM ranked WHERE r <= 40
ORDER BY 1, 2;
