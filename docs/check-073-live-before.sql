-- READ-ONLY, one SELECT. Run on production BEFORE test-073 / 073 are written in final form.
-- Part 1 compares the 3 functions 073 changes in place (checkout_order, void_order_with_approval,
-- save_recipe_cost) with the versions on the local copy (072 applied); the md5 lines give the
-- numbers 073's first check will use. CR/LF removed on both sides, blank lines at both ends
-- dropped, lines matched regardless of order, so only lines that really differ are listed.
-- Part 2 lists the facts 073 depends on (triggers, pending purchases, column types, grants).
-- Changes nothing.
WITH loc(fn, s) AS (VALUES
  ('checkout_order', $loc_checkout_order$

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
  v_vid       uuid;
  v_vactive   boolean;
  v_sweet     text;
  v_shots     int;
  v_cust      text;
  v_shot_price numeric;
  v_lines     jsonb := '[]'::jsonb;
  v_warnings  jsonb := '[]'::jsonb;
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
      'change_lak', v_existing.change_amount, 'status', v_existing.status, 'duplicate', true,
      'stock_warnings', '[]'::jsonb);
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
  -- drawer session, with 5 minutes of slack for a slow tablet clock (071); an older one
  -- waits on the POS for a manager
  IF v_replay AND (v_created < now() - interval '24 hours' OR v_created < COALESCE(
       (SELECT s.opened_at - interval '5 minutes' FROM public.cash_sessions s WHERE s.shop_id = p_shop_id AND s.status <> 'closed'),
       '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'SALE_TOO_OLD: sold %, more than 24 hours ago or before the open drawer session',
      to_char(v_created AT TIME ZONE 'Asia/Vientiane', 'YYYY-MM-DD HH24:MI') USING ERRCODE = '22023';
  END IF;

  SELECT extra_shot_price_lak INTO v_shot_price FROM public.shops WHERE id = p_shop_id;

  -- prices from the menu variants, never from the client
  FOR item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
    v_rid := NULLIF(item->>'recipe_id', '')::uuid;
    v_qty := (item->>'qty')::int;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN
      RAISE EXCEPTION 'invalid quantity' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.recipes
    WHERE id = v_rid AND (v_replay OR (COALESCE(is_active, true) AND NOT COALESCE(is_archived, false)));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'menu item not available: %', COALESCE(item->>'recipe_id', '?') USING ERRCODE = 'P0002';
    END IF;

    v_cust := COALESCE(item->>'customization', '');
    v_vid := NULLIF(item->>'variant_id', '')::uuid;
    IF v_vid IS NOT NULL THEN
      SELECT price_lak, is_active INTO v_price, v_vactive FROM public.menu_variants
      WHERE id = v_vid AND recipe_id = v_rid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'variant does not belong to this menu item' USING ERRCODE = '22023';
      END IF;
      IF NOT v_vactive AND NOT v_replay THEN
        RAISE EXCEPTION 'menu item not available: %', v_rid USING ERRCODE = 'P0002';
      END IF;
    ELSE
      -- a POS still running pre-072 code (or an offline bill saved by it) sends no variant:
      -- use the one price, else the hot/iced named in the note; drop once every POS runs 072 code
      SELECT v.id, v.price_lak INTO v_vid, v_price
      FROM public.menu_variants v
      WHERE v.recipe_id = v_rid AND (v.is_active OR v_replay)
      ORDER BY (v.kind = 'default' AND v.is_active) DESC,
               COALESCE(v.kind = CASE WHEN v_cust ~ '(เย็น|ເຢັນ|Iced)' THEN 'iced'
                                      WHEN v_cust ~ '(ร้อน|ຮ້ອນ|Hot)' THEN 'hot' END, false) DESC,
               v.is_active DESC, v.sort_order, v.price_lak
      LIMIT 1;
      IF v_vid IS NULL THEN
        RAISE EXCEPTION 'menu item not available: %', v_rid USING ERRCODE = 'P0002';
      END IF;
    END IF;

    v_sweet := lower(NULLIF(item->>'sweetness', ''));
    IF v_sweet IS NULL THEN
      v_sweet := CASE WHEN v_cust LIKE '%ไม่หวาน%' THEN 'none' WHEN v_cust LIKE '%หวานน้อย%' THEN 'less'
                      WHEN v_cust LIKE '%หวานมาก%' THEN 'more' ELSE 'normal' END;
    ELSIF v_sweet NOT IN ('none', 'less', 'normal', 'more') THEN
      RAISE EXCEPTION 'unknown sweetness: %', v_sweet USING ERRCODE = '22023';
    END IF;

    v_shots := COALESCE((item->>'extra_shots')::int, 0);
    IF v_shots < 0 OR v_shots > 9 THEN
      RAISE EXCEPTION 'extra shots must be 0 to 9' USING ERRCODE = '22023';
    END IF;
    IF v_shots > 0 AND v_shot_price IS NULL THEN
      IF NOT v_replay THEN
        RAISE EXCEPTION 'EXTRA_SHOT_NOT_SET' USING ERRCODE = '22023';
      END IF;
      v_shots := 0;
    END IF;
    v_price := v_price + v_shots * COALESCE(v_shot_price, 0);

    v_subtotal := v_subtotal + v_qty * v_price;
    v_lines := v_lines || jsonb_build_object('recipe_id', v_rid, 'variant_id', v_vid, 'qty', v_qty,
      'price', v_price, 'sweetness', v_sweet, 'extra_shots', v_shots, 'customization', NULLIF(v_cust, ''));
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
      'change_lak', v_existing.change_amount, 'status', v_existing.status, 'duplicate', true,
      'stock_warnings', '[]'::jsonb);
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

  -- unit_cost_lak = ingredient cost at the time of sale, so later price changes leave old profit alone
  INSERT INTO public.order_items (order_id, recipe_id, variant_id, qty, unit_price_lak, customization,
                                  sweetness, extra_shots, unit_cost_lak)
  SELECT v_order_id, (l->>'recipe_id')::uuid, (l->>'variant_id')::uuid, (l->>'qty')::int, (l->>'price')::numeric,
         l->>'customization', l->>'sweetness', (l->>'extra_shots')::int,
         public.variant_unit_cost((l->>'variant_id')::uuid, l->>'sweetness', (l->>'extra_shots')::int)
  FROM jsonb_array_elements(v_lines) l;

  IF NOT v_test THEN
    -- low stock never stops a sale (owner decision 2026-11-13): it is reported back instead
    SELECT COALESCE(jsonb_agg(jsonb_build_object('inventory_id', i.id, 'name', COALESCE(i.name_th, i.name),
             'unit', i.unit, 'needed', u.qty, 'had', i.current_qty) ORDER BY i.name), '[]'::jsonb)
    INTO v_warnings
    FROM public.order_stock_usage(v_order_id) u
    JOIN public.inventory i ON i.id = u.inventory_id
    WHERE u.qty > 0 AND i.current_qty < u.qty AND COALESCE(i.is_active, true);

    UPDATE public.inventory i
    SET current_qty = i.current_qty - use.qty, updated_at = now()
    FROM public.order_stock_usage(v_order_id) use
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
      'offline', v_replay, 'stock_warnings', v_warnings));

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'queue_number', v_queue, 'receipt_number', v_receipt,
    'subtotal_lak', v_subtotal, 'discount_lak', v_discount, 'total_lak', v_total,
    'change_lak', v_change, 'status', CASE WHEN v_test THEN 'test' ELSE 'paid' END, 'duplicate', false,
    'stock_warnings', v_warnings);
END;

$loc_checkout_order$::text),
  ('void_order_with_approval', $loc_void_order_with_approval$

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
    FROM public.order_stock_usage(p_order_id) restore
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

$loc_void_order_with_approval$::text),
  ('save_recipe_cost', $loc_save_recipe_cost$

BEGIN
  PERFORM public.require_real_shop_role(ARRAY['owner', 'manager']);

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'a recipe needs at least one ingredient' USING ERRCODE = '22023';
  END IF;
  IF p_cost_per_cup_lak IS NULL OR p_cost_per_cup_lak < 0 THEN
    RAISE EXCEPTION 'cost must be zero or more' USING ERRCODE = '22023';
  END IF;

  UPDATE public.recipes
     SET uses_ice = COALESCE(p_uses_ice, uses_ice),
         cost_per_cup_lak = round(p_cost_per_cup_lak)
   WHERE id = p_recipe_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu item not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.recipe_ingredients WHERE recipe_id = p_recipe_id;

  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, base_id, qty_normal, qty_less, qty_more)
  SELECT p_recipe_id,
         NULLIF(i ->> 'inventory_id', '')::uuid,
         NULLIF(i ->> 'base_id', '')::uuid,
         COALESCE((i ->> 'qty_normal')::numeric, 0),
         COALESCE((i ->> 'qty_less')::numeric, 0),
         COALESCE((i ->> 'qty_more')::numeric, 0)
  FROM jsonb_array_elements(p_items) AS i;
END

$loc_save_recipe_cost$::text)
),
live AS (
  SELECT p.proname::text AS fn, count(*) OVER (PARTITION BY p.proname) AS versions, p.prosrc AS raw,
         row_number() OVER (PARTITION BY p.proname ORDER BY p.oid) AS pick
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN (SELECT fn FROM loc)
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
),
facts(fn, sort, what, detail) AS (
  SELECT 'z facts', 100, 'trigger ' || c.relname || '.' || t.tgname, t.tgfoid::regproc::text || ' enabled=' || t.tgenabled::text
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
    AND c.relname IN ('purchase_logs', 'inventory', 'cash_movements', 'cash_flow', 'stock_audit')
  UNION ALL
  SELECT 'z facts', 200, 'purchase_logs status ' || COALESCE(status, 'null'),
         count(*) || ' rows, total ' || COALESCE(sum(total_lak), 0)
  FROM public.purchase_logs GROUP BY status
  UNION ALL
  SELECT 'z facts', 300, 'cash_movements ' || kind || CASE WHEN voided_at IS NULL THEN '' ELSE ' (voided)' END,
         count(*) || ' rows, ' || sum(amount_lak)
  FROM public.cash_movements GROUP BY kind, voided_at IS NULL
  UNION ALL
  SELECT 'z facts', 400, 'cash_flow rows pointing at a cash movement',
         count(*)::text FROM public.cash_flow f WHERE EXISTS (SELECT 1 FROM public.cash_movements m WHERE m.id = f.reference_id)
  UNION ALL
  SELECT 'z facts', 500, 'column ' || table_name || '.' || column_name,
         data_type || COALESCE('(' || numeric_precision || ',' || numeric_scale || ')', '')
  FROM information_schema.columns
  WHERE table_schema = 'public' AND (table_name, column_name) IN (('inventory', 'cost_per_unit'), ('inventory', 'current_qty'),
        ('purchase_logs', 'unit_price_lak'), ('purchase_logs', 'total_lak'), ('purchase_logs', 'qty_purchased'))
  UNION ALL
  SELECT 'z facts', 600, 'view/rule on ' || t.relname, v.relname
  FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid JOIN pg_class v ON v.oid = r.ev_class
  JOIN pg_class t ON t.oid = d.refobjid
  WHERE t.relname IN ('inventory', 'purchase_logs') AND v.relname <> t.relname
  GROUP BY t.relname, v.relname
  UNION ALL
  SELECT 'z facts', 700, 'constraint ' || conrelid::regclass::text || '.' || conname, pg_get_constraintdef(oid)
  FROM pg_constraint WHERE conrelid IN ('public.purchase_logs'::regclass, 'public.cash_flow'::regclass, 'public.cash_movements'::regclass)
    AND contype = 'c'
  UNION ALL
  SELECT 'z facts', 800, 'execute ' || p.proname,
         'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE') || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('add_stock', 'approve_purchase', 'start_stock_audit', 'submit_stock_audit', 'submit_purchase_request',
                      'save_recipe_cost', 'update_inventory_item', 'cash_movement_add', 'cash_movement_void')
  UNION ALL
  SELECT 'z facts', 900, 'update_inventory_item turns cost 0 into NULL',
         (position('NULLIF(p_cost_per_unit' IN prosrc) > 0)::text
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'update_inventory_item'
  UNION ALL
  SELECT 'z facts', 950, 'already exists (must be none): ' || proname, '1'
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('stock_receive', 'stock_waste', 'stock_count_submit', 'stock_cut_for_order', 'stock_return_for_order')
  UNION ALL
  SELECT 'z facts', 960, 'table stock_movements exists', (to_regclass('public.stock_movements') IS NOT NULL)::text
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
UNION ALL
SELECT * FROM facts
ORDER BY 1, 2, 3;
