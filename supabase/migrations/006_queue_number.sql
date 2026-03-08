-- Alan Cafe OS v1.0 — Queue Number + Order RPC Update
-- Migration: 006_queue_number.sql

-- ─── 1. Add queue_number column to orders ─────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS queue_number INTEGER;

-- ─── 2. Fix performance_score precision (NUMERIC(4,2) overflows at 100.00) ─────

ALTER TABLE staff
  ALTER COLUMN performance_score TYPE NUMERIC(5,2);

-- ─── 3. POS Terminal staff (placeholder until staff auth is implemented) ───────

INSERT INTO staff (id, name, role, is_active)
VALUES ('ff000000-0000-0000-0000-000000000001', 'POS Terminal', 'pos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. get_daily_queue_number ────────────────────────────────────────────────
--
-- Returns the next available queue number for today (Asia/Vientiane).
-- Called internally by create_order_with_deduction.
-- Can also be exposed as a standalone RPC if needed for display purposes.

CREATE OR REPLACE FUNCTION get_daily_queue_number()
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0) + 1
  INTO   v_next
  FROM   orders
  WHERE  (created_at AT TIME ZONE 'Asia/Vientiane')::DATE
           = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE
    AND  status != 'voided';

  RETURN v_next;
END;
$$;

-- ─── 4. Recreate create_order_with_deduction ──────────────────────────────────
--
-- Changes from v1:
--   • p_staff_id now has a default (POS Terminal UUID)
--   • auto-assigns queue_number via get_daily_queue_number()
--   • returns JSONB  {"order_id": "...", "queue_number": 7}
--     instead of bare UUID

-- Must DROP first because the return type is changing
DROP FUNCTION IF EXISTS create_order_with_deduction(UUID, JSONB, UUID, TEXT, TEXT, NUMERIC, TEXT);

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

  -- ── 3. Create order ────────────────────────────────────────
  INSERT INTO orders (
    staff_id,         customer_id,
    payment_method,   payment_currency,
    discount_lak,     discount_reason,
    subtotal_lak,     total_lak,
    queue_number,     status
  )
  VALUES (
    p_staff_id,       p_customer_id,
    p_payment_method, p_payment_currency,
    p_discount_lak,   p_discount_reason,
    0, 0,
    v_queue_num,      'open'
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
