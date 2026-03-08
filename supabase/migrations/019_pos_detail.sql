-- Alan Cafe OS — POS Detail
-- Migration: 019_pos_detail.sql

-- ─── 1. New columns on orders ─────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method   TEXT CHECK (payment_method IN ('cash','qr','transfer','card')),
  ADD COLUMN IF NOT EXISTS amount_received  NUMERIC,
  ADD COLUMN IF NOT EXISTS change_amount    NUMERIC,
  ADD COLUMN IF NOT EXISTS table_number     TEXT,
  ADD COLUMN IF NOT EXISTS customer_name    TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason  TEXT,
  ADD COLUMN IF NOT EXISTS void_reason      TEXT,
  ADD COLUMN IF NOT EXISTS staff_note       TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number   TEXT;

-- ─── 2. generate_receipt_number() ────────────────────────────────────────────

DROP FUNCTION IF EXISTS generate_receipt_number();

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date  TEXT    := TO_CHAR((NOW() AT TIME ZONE 'Asia/Vientiane'), 'YYYYMMDD');
  v_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) + 1
  INTO   v_count
  FROM   orders
  WHERE  receipt_number LIKE v_date || '-%';

  RETURN v_date || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- ─── 3. finalize_order_payment(…) ────────────────────────────────────────────

DROP FUNCTION IF EXISTS finalize_order_payment(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION finalize_order_payment(
  p_order_id       UUID,
  p_payment_method TEXT,
  p_amount_received NUMERIC DEFAULT NULL,
  p_change_amount  NUMERIC DEFAULT NULL,
  p_table_number   TEXT    DEFAULT NULL,
  p_customer_name  TEXT    DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT 0,
  p_discount_reason TEXT   DEFAULT NULL,
  p_staff_note     TEXT    DEFAULT NULL
)
RETURNS TEXT   -- returns receipt_number
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt TEXT := generate_receipt_number();
BEGIN
  UPDATE orders SET
    payment_method  = p_payment_method,
    amount_received = p_amount_received,
    change_amount   = p_change_amount,
    table_number    = NULLIF(p_table_number,   ''),
    customer_name   = NULLIF(p_customer_name,  ''),
    discount_amount = COALESCE(p_discount_amount, 0),
    discount_reason = NULLIF(p_discount_reason, ''),
    staff_note      = NULLIF(p_staff_note,     ''),
    receipt_number  = v_receipt
  WHERE id = p_order_id;

  RETURN v_receipt;
END;
$$;

-- ─── 4. void_order(id, reason) — void + restore stock ────────────────────────

DROP FUNCTION IF EXISTS void_order(UUID, TEXT);

CREATE OR REPLACE FUNCTION void_order(
  p_order_id UUID,
  p_reason   TEXT DEFAULT 'ยกเลิก'
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark order void
  UPDATE orders SET
    status      = 'void',
    void_reason = NULLIF(p_reason, '')
  WHERE id = p_order_id;

  -- Restore inventory (reverse deduction)
  UPDATE inventory i
  SET    current_qty = current_qty + restore.qty,
         updated_at  = NOW()
  FROM (
    SELECT ri.inventory_id,
           SUM(oi.qty * ri.qty_required) AS qty
    FROM   order_items oi
    JOIN   recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
    WHERE  oi.order_id = p_order_id
    GROUP  BY ri.inventory_id
  ) restore
  WHERE i.id = restore.inventory_id;
END;
$$;

-- ─── 5. get_today_orders() — all orders today for POS view ───────────────────

DROP FUNCTION IF EXISTS get_today_orders();

CREATE OR REPLACE FUNCTION get_today_orders()
RETURNS TABLE (
  id              UUID,
  queue_number    INTEGER,
  status          TEXT,
  total_lak       NUMERIC,
  payment_method  TEXT,
  customer_name   TEXT,
  table_number    TEXT,
  receipt_number  TEXT,
  discount_amount NUMERIC,
  void_reason     TEXT,
  created_at_vt   TIMESTAMPTZ,
  items           JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
BEGIN
  RETURN QUERY
    SELECT
      o.id,
      o.queue_number,
      o.status,
      o.total_lak,
      o.payment_method,
      o.customer_name,
      o.table_number,
      o.receipt_number,
      COALESCE(o.discount_amount, 0),
      o.void_reason,
      o.created_at AT TIME ZONE 'Asia/Vientiane' AS created_at_vt,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', r.product_name,
            'qty',  oi.qty,
            'note', oi.customization
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::jsonb
      ) AS items
    FROM   orders o
    LEFT   JOIN order_items oi ON oi.order_id = o.id
    LEFT   JOIN recipes r      ON r.id = oi.recipe_id
    WHERE  (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today
    GROUP  BY o.id, o.queue_number, o.status, o.total_lak,
              o.payment_method, o.customer_name, o.table_number,
              o.receipt_number, o.discount_amount, o.void_reason, o.created_at
    ORDER  BY o.created_at DESC;
END;
$$;

-- ─── 6. GRANT TO anon ─────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION generate_receipt_number()                                                                               TO anon;
GRANT EXECUTE ON FUNCTION finalize_order_payment(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, TEXT)                  TO anon;
GRANT EXECUTE ON FUNCTION void_order(UUID, TEXT)                                                                                  TO anon;
GRANT EXECUTE ON FUNCTION get_today_orders()                                                                                      TO anon;
