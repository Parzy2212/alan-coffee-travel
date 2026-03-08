-- Alan Cafe OS v1.0 — RPC Functions
-- Migration: 003_rpc_functions.sql
--
-- Functions:
--   1. check_stock_for_cart        — pre-flight stock check per cart item
--   2. create_order_with_deduction — atomic order creation + inventory deduction
--   3. get_shift_cash_summary      — sales vs cash reconciliation for a shift
--   4. compute_performance_score   — staff score from tardiness, voids, stock variance

-- ============================================================
-- 1. check_stock_for_cart
--
-- Input : JSONB array [{"recipe_id": "...", "qty": 2}, ...]
-- Output: one row per ingredient showing required vs available qty
--
-- Usage : SELECT * FROM check_stock_for_cart('[{"recipe_id":"...","qty":2}]');
-- ============================================================
CREATE OR REPLACE FUNCTION check_stock_for_cart(
  p_cart JSONB
)
RETURNS TABLE (
  recipe_id       UUID,
  product_name    TEXT,
  inventory_id    UUID,
  ingredient_name TEXT,
  required_qty    NUMERIC,
  available_qty   NUMERIC,
  sufficient      BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_cart)
  LOOP
    RETURN QUERY
      SELECT
        r.id                                                       AS recipe_id,
        r.product_name                                             AS product_name,
        inv.id                                                     AS inventory_id,
        inv.name                                                   AS ingredient_name,
        ri.qty_required * (item->>'qty')::NUMERIC                  AS required_qty,
        inv.current_qty                                            AS available_qty,
        inv.current_qty >= ri.qty_required * (item->>'qty')::NUMERIC AS sufficient
      FROM recipe_ingredients ri
      JOIN recipes   r   ON r.id   = ri.recipe_id
      JOIN inventory inv ON inv.id = ri.inventory_id
      WHERE ri.recipe_id = (item->>'recipe_id')::UUID
        AND inv.is_active = TRUE;
  END LOOP;
END;
$$;

-- ============================================================
-- 2. create_order_with_deduction
--
-- Executes atomically in a single transaction:
--   a) Validates stock (raises exception on shortage)
--   b) Creates the order row
--   c) Inserts order_items
--   d) Deducts inventory for each ingredient × qty
--   e) Updates customer lifetime_spend + visit_count
--   f) Writes an audit_log entry
--
-- Input  : staff_id, JSONB cart, optional customer/payment fields
-- Output : UUID of the created order
--
-- Cart item schema: {"recipe_id":"...", "qty":2, "unit_price_lak":25000, "customization":"extra shot"}
-- ============================================================
CREATE OR REPLACE FUNCTION create_order_with_deduction(
  p_staff_id         UUID,
  p_cart             JSONB,
  p_customer_id      UUID     DEFAULT NULL,
  p_payment_method   TEXT     DEFAULT 'cash',
  p_payment_currency TEXT     DEFAULT 'LAK',
  p_discount_lak     NUMERIC  DEFAULT 0,
  p_discount_reason  TEXT     DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id   UUID;
  v_subtotal   NUMERIC := 0;
  v_total      NUMERIC;
  item         JSONB;
  v_recipe_id  UUID;
  v_qty        INTEGER;
  v_price      NUMERIC;
  shortage     RECORD;
  ingredient   RECORD;
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

  -- ── 2. Create order (subtotal/total updated below) ─────────
  INSERT INTO orders (
    staff_id,         customer_id,
    payment_method,   payment_currency,
    discount_lak,     discount_reason,
    subtotal_lak,     total_lak,
    status
  )
  VALUES (
    p_staff_id,       p_customer_id,
    p_payment_method, p_payment_currency,
    p_discount_lak,   p_discount_reason,
    0, 0, 'open'
  )
  RETURNING id INTO v_order_id;

  -- ── 3. Insert order items + deduct inventory ───────────────
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

    -- Deduct each ingredient proportional to qty ordered
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

  -- ── 4. Finalise order totals ───────────────────────────────
  v_total := GREATEST(0, v_subtotal - p_discount_lak);

  UPDATE orders
  SET subtotal_lak = v_subtotal,
      total_lak    = v_total,
      status       = 'paid'
  WHERE id = v_order_id;

  -- ── 5. Update customer stats ───────────────────────────────
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers
    SET lifetime_spend_lak = lifetime_spend_lak + v_total,
        visit_count        = visit_count + 1
    WHERE id = p_customer_id;
  END IF;

  -- ── 6. Audit log ───────────────────────────────────────────
  INSERT INTO audit_logs (
    staff_id, action, table_name, row_id, after_data
  )
  VALUES (
    p_staff_id,
    'create_order',
    'orders',
    v_order_id,
    jsonb_build_object(
      'order_id',        v_order_id,
      'subtotal_lak',    v_subtotal,
      'discount_lak',    p_discount_lak,
      'total_lak',       v_total,
      'payment_method',  p_payment_method,
      'payment_currency',p_payment_currency,
      'cart',            p_cart
    )
  );

  RETURN v_order_id;
END;
$$;

-- ============================================================
-- 3. get_shift_cash_summary
--
-- Compares POS system_sales against the cashflow_logs entry
-- for the requested shift, returning the variance.
--
-- Shift windows (Asia/Vientiane = UTC+7):
--   morning   → 06:00 – 13:59
--   afternoon → 14:00 – 21:59
--   evening   → 22:00 – 05:59 (next day)
--   (any other value defaults to full-day 00:00 – 23:59)
--
-- Usage: SELECT * FROM get_shift_cash_summary('morning', '2026-03-05');
-- ============================================================
CREATE OR REPLACE FUNCTION get_shift_cash_summary(
  p_shift TEXT,
  p_date  DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  log_date         DATE,
  shift            TEXT,
  order_count      BIGINT,
  system_sales_lak NUMERIC,
  opening_cash_lak NUMERIC,
  actual_cash_lak  NUMERIC,
  variance_lak     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH shift_window AS (
    SELECT
      (p_date + CASE p_shift
                  WHEN 'morning'   THEN TIME '06:00:00'
                  WHEN 'afternoon' THEN TIME '14:00:00'
                  WHEN 'evening'   THEN TIME '22:00:00'
                  ELSE                  TIME '00:00:00'
                END) AT TIME ZONE 'Asia/Vientiane' AS ts_start,
      (p_date + CASE p_shift
                  WHEN 'morning'   THEN TIME '13:59:59'
                  WHEN 'afternoon' THEN TIME '21:59:59'
                  WHEN 'evening'   THEN TIME '23:59:59'
                  ELSE                  TIME '23:59:59'
                END) AT TIME ZONE 'Asia/Vientiane' AS ts_end
  ),
  sales AS (
    SELECT
      COUNT(*)                    AS order_count,
      COALESCE(SUM(o.total_lak), 0) AS system_sales_lak
    FROM orders o, shift_window sw
    WHERE o.status     = 'paid'
      AND o.created_at BETWEEN sw.ts_start AND sw.ts_end
  ),
  cash_log AS (
    SELECT
      COALESCE(opening_cash, 0) AS opening_cash_lak,
      COALESCE(actual_cash,  0) AS actual_cash_lak
    FROM cashflow_logs
    WHERE log_date = p_date
      AND shift    = p_shift
    ORDER BY created_at DESC
    LIMIT 1
  )
  SELECT
    p_date,
    p_shift,
    s.order_count,
    s.system_sales_lak,
    COALESCE(c.opening_cash_lak, 0),
    COALESCE(c.actual_cash_lak,  0),
    COALESCE(c.actual_cash_lak,  0)
      - (COALESCE(c.opening_cash_lak, 0) + s.system_sales_lak) AS variance_lak
  FROM sales s
  LEFT JOIN cash_log c ON true;
$$;

-- ============================================================
-- 4. compute_performance_score
--
-- Scoring formula (base 100, per category cap):
--
--   Tardiness   : -0.5 per late minute     (max deduction: -40)
--   Voids       : -5.0 per order voided    (max deduction: -35)
--   Stock delta : -5.0 per audit with      (max deduction: -25)
--                 |variance_pct| > 5 %
--
--   Final score = CLAMP(sum, 0, 100), rounded to 2 dp
--
-- When p_save = TRUE the result is also written to staff.performance_score.
--
-- Usage:
--   SELECT compute_performance_score('staff-uuid');
--   SELECT compute_performance_score('staff-uuid', '2026-02-01', '2026-03-05', TRUE);
-- ============================================================
CREATE OR REPLACE FUNCTION compute_performance_score(
  p_staff_id UUID,
  p_from     DATE    DEFAULT (CURRENT_DATE - 30),
  p_to       DATE    DEFAULT CURRENT_DATE,
  p_save     BOOLEAN DEFAULT FALSE
)
RETURNS NUMERIC
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_late_minutes  INTEGER;
  v_void_count    INTEGER;
  v_anomaly_count INTEGER;
  v_score         NUMERIC;
BEGIN
  -- ── Tardiness: total late minutes in the period ────────────
  SELECT COALESCE(SUM(late_minutes), 0)
  INTO   v_late_minutes
  FROM   attendance
  WHERE  staff_id           = p_staff_id
    AND  action             = 'clock_in'
    AND  is_late            = TRUE
    AND  created_at::DATE BETWEEN p_from AND p_to;

  -- ── Voids: orders voided by this staff member ──────────────
  SELECT COUNT(*)
  INTO   v_void_count
  FROM   orders
  WHERE  voided_by          = p_staff_id
    AND  status             = 'voided'
    AND  created_at::DATE BETWEEN p_from AND p_to;

  -- ── Stock anomalies: |variance_pct| > 5 % ─────────────────
  SELECT COUNT(*)
  INTO   v_anomaly_count
  FROM   stock_audit
  WHERE  staff_id           = p_staff_id
    AND  ABS(variance_pct)  > 5
    AND  created_at::DATE BETWEEN p_from AND p_to;

  -- ── Composite score ────────────────────────────────────────
  v_score :=
    100
    - LEAST(40, v_late_minutes  * 0.5)
    - LEAST(35, v_void_count    * 5.0)
    - LEAST(25, v_anomaly_count * 5.0);

  v_score := GREATEST(0, LEAST(100, ROUND(v_score, 2)));

  -- ── Persist (optional) ────────────────────────────────────
  IF p_save THEN
    UPDATE staff
    SET    performance_score = v_score
    WHERE  id = p_staff_id;

    INSERT INTO audit_logs (staff_id, action, table_name, row_id, after_data)
    VALUES (
      p_staff_id,
      'compute_performance_score',
      'staff',
      p_staff_id,
      jsonb_build_object(
        'period_from',   p_from,
        'period_to',     p_to,
        'late_minutes',  v_late_minutes,
        'void_count',    v_void_count,
        'anomaly_count', v_anomaly_count,
        'score',         v_score
      )
    );
  END IF;

  RETURN v_score;
END;
$$;
