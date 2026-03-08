-- Alan Cafe OS v1.0 — Fix queue query to include waiting/null orders
-- Migration: 010_fix_queue_query.sql

-- ─── 1. Extend queue_status CHECK to include 'waiting' ────────────────────────
--
-- Previously: NULL = waiting (implicit). Adding explicit 'waiting' value so
-- create_order_with_deduction can set it and queries can filter clearly.

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_queue_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_queue_status_check
  CHECK (queue_status IN ('waiting', 'making', 'ready', 'collected'));

-- ─── 2. Recreate create_order_with_deduction to set queue_status='waiting' ────
--
-- New orders start with an explicit 'waiting' status instead of NULL,
-- so the POS queue section can filter with a simple = 'waiting' check.

DROP FUNCTION IF EXISTS create_order_with_deduction(JSONB, UUID, UUID, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION create_order_with_deduction(
  p_cart             JSONB,
  p_staff_id         UUID     DEFAULT 'ff000000-0000-0000-0000-000000000001',
  p_customer_id      UUID     DEFAULT NULL,
  p_payment_method   TEXT     DEFAULT 'cash',
  p_payment_currency TEXT     DEFAULT 'LAK',
  p_discount_lak     NUMERIC  DEFAULT 0,
  p_discount_reason  TEXT     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id    UUID;
  v_queue_num   INTEGER;
  v_subtotal    NUMERIC := 0;
  v_total       NUMERIC;
  item          JSONB;
  v_recipe_id   UUID;
  v_qty         INTEGER;
  v_price       NUMERIC;
  shortage      RECORD;
  ingredient    RECORD;
BEGIN
  -- ── 1. Stock pre-flight ────────────────────────────────────
  FOR shortage IN
    SELECT * FROM check_stock_for_cart(p_cart) WHERE NOT sufficient
  LOOP
    RAISE EXCEPTION
      'Insufficient stock: "%" requires %, only % available',
      shortage.ingredient_name,
      shortage.required_qty,
      shortage.available_qty
      USING ERRCODE = 'P0001';
  END LOOP;

  -- ── 2. Reserve queue number ────────────────────────────────
  v_queue_num := get_daily_queue_number();

  -- ── 3. Create order with explicit 'waiting' status ─────────
  INSERT INTO orders (
    staff_id,         customer_id,
    payment_method,   payment_currency,
    discount_lak,     discount_reason,
    subtotal_lak,     total_lak,
    queue_number,     queue_status,     status
  )
  VALUES (
    p_staff_id,       p_customer_id,
    p_payment_method, p_payment_currency,
    p_discount_lak,   p_discount_reason,
    0, 0,
    v_queue_num,      'waiting',         'open'
  )
  RETURNING id INTO v_order_id;

  -- ── 4. Insert order items + deduct inventory ───────────────
  FOR item IN SELECT * FROM jsonb_array_elements(p_cart)
  LOOP
    v_recipe_id := (item->>'recipe_id')::UUID;
    v_qty       := (item->>'qty')::INTEGER;
    v_price     := (item->>'unit_price_lak')::NUMERIC;

    INSERT INTO order_items (
      order_id, recipe_id, qty, unit_price_lak, customization
    )
    VALUES (
      v_order_id, v_recipe_id, v_qty, v_price,
      item->>'customization'
    );

    v_subtotal := v_subtotal + (v_qty * v_price);

    FOR ingredient IN
      SELECT inventory_id, qty_required
      FROM recipe_ingredients
      WHERE recipe_id = v_recipe_id
    LOOP
      UPDATE inventory
      SET current_qty = current_qty - (ingredient.qty_required * v_qty),
          updated_at  = NOW()
      WHERE id = ingredient.inventory_id;
    END LOOP;
  END LOOP;

  -- ── 5. Finalise order totals ───────────────────────────────
  v_total := GREATEST(0, v_subtotal - p_discount_lak);

  UPDATE orders
  SET subtotal_lak = v_subtotal,
      total_lak    = v_total,
      status       = 'paid'
  WHERE id = v_order_id;

  -- ── 6. Update customer stats ───────────────────────────────
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers
    SET lifetime_spend_lak = lifetime_spend_lak + v_total,
        visit_count        = visit_count + 1
    WHERE id = p_customer_id;
  END IF;

  -- ── 7. Audit log ───────────────────────────────────────────
  INSERT INTO audit_logs (
    staff_id, action, table_name, row_id, after_data
  )
  VALUES (
    p_staff_id,
    'create_order',
    'orders',
    v_order_id,
    jsonb_build_object(
      'order_id',         v_order_id,
      'queue_number',     v_queue_num,
      'subtotal_lak',     v_subtotal,
      'discount_lak',     p_discount_lak,
      'total_lak',        v_total,
      'payment_method',   p_payment_method,
      'payment_currency', p_payment_currency,
      'cart',             p_cart
    )
  );

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'queue_number', v_queue_num
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_order_with_deduction(JSONB, UUID, UUID, TEXT, TEXT, NUMERIC, TEXT) TO anon;

-- ─── 3. Recreate get_today_pos_queue — include waiting/null/making ─────────────
--
-- Returns orders the barista still needs to act on:
--   queue_status = 'waiting' (just placed, not yet started)
--   queue_status IS NULL     (legacy orders before migration 010)
--   queue_status = 'making'  (in progress)

DROP FUNCTION IF EXISTS get_today_pos_queue();

CREATE OR REPLACE FUNCTION get_today_pos_queue()
RETURNS TABLE (
  order_id     UUID,
  queue_number INTEGER,
  queue_status TEXT,
  summary      TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      o.id                                                          AS order_id,
      o.queue_number,
      o.queue_status,
      STRING_AGG(
        CASE WHEN oi.qty > 1
             THEN r.product_name || ' x' || oi.qty
             ELSE r.product_name
        END
        || CASE WHEN oi.customization IS NOT NULL AND oi.customization <> ''
                THEN ' · ' || oi.customization
                ELSE ''
           END,
        ',  '
        ORDER BY oi.id
      )                                                             AS summary
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN recipes r      ON r.id = oi.recipe_id
    WHERE (o.queue_status IS NULL
           OR o.queue_status IN ('waiting', 'making'))
      AND o.queue_number IS NOT NULL
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE
            = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE
    GROUP BY o.id, o.queue_number, o.queue_status
    ORDER BY o.queue_number;
END;
$$;

GRANT EXECUTE ON FUNCTION get_today_pos_queue() TO anon;

-- ─── 4. Update RLS so anon can also read 'waiting' orders (TV display skips them anyway)
--
-- The TV page filters client-side to 'making'/'ready', so expanding the policy
-- to include 'waiting' is safe and lets the POS realtime subscription work.

DROP POLICY IF EXISTS "anon: read active queue display" ON orders;

CREATE POLICY "anon: read active queue display" ON orders
  FOR SELECT TO anon
  USING (
    queue_status IN ('waiting', 'making', 'ready')
    AND created_at >= (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE::TIMESTAMPTZ - INTERVAL '1 hour'
    AND created_at <  (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE::TIMESTAMPTZ + INTERVAL '25 hours'
  );
