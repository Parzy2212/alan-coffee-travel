-- Alan Cafe OS — Advanced Dashboard Stats
-- Migration: 014_dashboard_stats.sql

-- ─── 1. Recreate get_dashboard_stats with gross profit + avg items ────────────

DROP FUNCTION IF EXISTS get_dashboard_stats();

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today          DATE    := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  v_today_sales    NUMERIC := 0;
  v_today_orders   INTEGER := 0;
  v_today_items    NUMERIC := 0;
  v_today_profit   NUMERIC := 0;
  v_yest_sales     NUMERIC := 0;
BEGIN
  -- Today: sales + orders
  SELECT COALESCE(SUM(total_lak), 0), COUNT(*)
  INTO   v_today_sales, v_today_orders
  FROM   orders
  WHERE  status = 'paid'
    AND  (created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today;

  -- Today: avg items per order
  SELECT CASE WHEN v_today_orders > 0
              THEN ROUND(SUM(oi.qty)::NUMERIC / v_today_orders, 1)
              ELSE 0
         END
  INTO   v_today_items
  FROM   order_items oi
  JOIN   orders o ON o.id = oi.order_id
  WHERE  o.status = 'paid'
    AND  (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today;

  -- Today: gross profit (sales - ingredient cost)
  SELECT COALESCE(SUM(
    oi.qty * oi.unit_price_lak
    - oi.qty * COALESCE((
        SELECT SUM(ri.qty_required * COALESCE(i.cost_per_unit, 0))
        FROM   recipe_ingredients ri
        JOIN   inventory i ON i.id = ri.inventory_id
        WHERE  ri.recipe_id = oi.recipe_id
      ), 0)
  ), 0)
  INTO   v_today_profit
  FROM   order_items oi
  JOIN   orders o ON o.id = oi.order_id
  WHERE  o.status = 'paid'
    AND  (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today;

  -- Yesterday: sales
  SELECT COALESCE(SUM(total_lak), 0)
  INTO   v_yest_sales
  FROM   orders
  WHERE  status = 'paid'
    AND  (created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today - 1;

  RETURN jsonb_build_object(
    'today_sales',     v_today_sales,
    'today_orders',    v_today_orders,
    'today_items',     COALESCE(v_today_items, 0),
    'today_profit',    v_today_profit,
    'yesterday_sales', v_yest_sales
  );
END;
$$;

-- ─── 2. get_hourly_sales(DATE) — 24-hour breakdown ───────────────────────────

DROP FUNCTION IF EXISTS get_hourly_sales(DATE);

CREATE OR REPLACE FUNCTION get_hourly_sales(p_date DATE DEFAULT NULL)
RETURNS TABLE (hour INTEGER, sales NUMERIC, order_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := COALESCE(p_date, (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE);
BEGIN
  RETURN QUERY
    WITH hours AS (SELECT generate_series(0, 23) AS h)
    SELECT
      h.h::INTEGER AS hour,
      COALESCE(SUM(o.total_lak), 0)::NUMERIC AS sales,
      COUNT(o.id)::BIGINT AS order_count
    FROM hours h
    LEFT JOIN orders o
      ON  EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'Asia/Vientiane')::INTEGER = h.h
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_date
      AND o.status = 'paid'
    GROUP BY h.h
    ORDER BY h.h;
END;
$$;

-- ─── 3. get_menu_performance(days) ───────────────────────────────────────────

DROP FUNCTION IF EXISTS get_menu_performance(INTEGER);

CREATE OR REPLACE FUNCTION get_menu_performance(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  recipe_id    UUID,
  product_name TEXT,
  total_qty    BIGINT,
  total_sales  NUMERIC,
  total_cost   NUMERIC,
  gross_profit NUMERIC,
  margin_pct   NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - (p_days - 1);
BEGIN
  RETURN QUERY
    WITH recipe_costs AS (
      SELECT
        ri.recipe_id,
        COALESCE(SUM(ri.qty_required * COALESCE(i.cost_per_unit, 0)), 0) AS unit_cost
      FROM recipe_ingredients ri
      JOIN inventory i ON i.id = ri.inventory_id
      GROUP BY ri.recipe_id
    ),
    agg AS (
      SELECT
        oi.recipe_id,
        SUM(oi.qty)::BIGINT                         AS total_qty,
        SUM(oi.qty * oi.unit_price_lak)             AS total_sales,
        SUM(oi.qty * COALESCE(rc.unit_cost, 0))     AS total_cost
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN recipe_costs rc ON rc.recipe_id = oi.recipe_id
      WHERE o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE >= v_since
      GROUP BY oi.recipe_id
    )
    SELECT
      r.id,
      r.product_name,
      a.total_qty,
      a.total_sales,
      a.total_cost,
      a.total_sales - a.total_cost                                            AS gross_profit,
      CASE WHEN a.total_sales > 0
           THEN ROUND((a.total_sales - a.total_cost) / a.total_sales * 100, 1)
           ELSE 0
      END                                                                     AS margin_pct
    FROM agg a
    JOIN recipes r ON r.id = a.recipe_id
    ORDER BY a.total_qty DESC;
END;
$$;

-- ─── 4. get_customization_stats(days) ────────────────────────────────────────

DROP FUNCTION IF EXISTS get_customization_stats(INTEGER);

CREATE OR REPLACE FUNCTION get_customization_stats(p_days INTEGER DEFAULT 7)
RETURNS TABLE (category TEXT, label TEXT, cnt BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - (p_days - 1);
BEGIN
  RETURN QUERY
    SELECT 'sweetness'::TEXT,
      CASE
        WHEN oi.customization LIKE '%ไม่หวาน%'  THEN 'ไม่หวาน'
        WHEN oi.customization LIKE '%หวานน้อย%' THEN 'หวานน้อย'
        WHEN oi.customization LIKE '%หวาน%'     THEN 'หวานปกติ'
        ELSE 'ไม่ระบุ'
      END,
      COUNT(*)::BIGINT
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'paid'
      AND oi.customization IS NOT NULL AND oi.customization <> ''
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE >= v_since
    GROUP BY 2

    UNION ALL

    SELECT 'temperature'::TEXT,
      CASE
        WHEN oi.customization LIKE '%เย็น%' THEN 'เย็น'
        WHEN oi.customization LIKE '%อุ่น%' THEN 'อุ่น'
        WHEN oi.customization LIKE '%ร้อน%' THEN 'ร้อน'
        ELSE 'ไม่ระบุ'
      END,
      COUNT(*)::BIGINT
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'paid'
      AND oi.customization IS NOT NULL AND oi.customization <> ''
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE >= v_since
    GROUP BY 2

    ORDER BY 1, 3 DESC;
END;
$$;

-- ─── 5. get_queue_performance(days) ──────────────────────────────────────────

DROP FUNCTION IF EXISTS get_queue_performance(INTEGER);

CREATE OR REPLACE FUNCTION get_queue_performance(p_days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today          DATE    := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  v_since          DATE    := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - (p_days - 1);
  v_peak_hour      INTEGER := 0;
  v_orders_ph      NUMERIC := 0;
  v_today_orders   INTEGER := 0;
BEGIN
  SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Vientiane')::INTEGER
  INTO   v_peak_hour
  FROM   orders
  WHERE  status = 'paid'
    AND  (created_at AT TIME ZONE 'Asia/Vientiane')::DATE BETWEEN v_since AND v_today
  GROUP  BY 1
  ORDER  BY COUNT(*) DESC
  LIMIT  1;

  -- Avg orders per operating hour (16h/day: 06-22)
  SELECT ROUND(COUNT(*)::NUMERIC / GREATEST(p_days * 16, 1), 1)
  INTO   v_orders_ph
  FROM   orders
  WHERE  status = 'paid'
    AND  (created_at AT TIME ZONE 'Asia/Vientiane')::DATE BETWEEN v_since AND v_today;

  SELECT COUNT(*)
  INTO   v_today_orders
  FROM   orders
  WHERE  status = 'paid'
    AND  (created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today;

  RETURN jsonb_build_object(
    'peak_hour',      COALESCE(v_peak_hour,    0),
    'orders_per_hour', COALESCE(v_orders_ph,   0),
    'today_orders',   COALESCE(v_today_orders, 0)
  );
END;
$$;

-- ─── 6. get_stock_value() ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_stock_value();

CREATE OR REPLACE FUNCTION get_stock_value()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  v_total_value NUMERIC := 0;
  v_low_count   INTEGER := 0;
  v_top_used    JSONB;
BEGIN
  SELECT COALESCE(SUM(current_qty * COALESCE(cost_per_unit, 0)), 0)
  INTO   v_total_value
  FROM   inventory
  WHERE  is_active = TRUE;

  SELECT COUNT(*)
  INTO   v_low_count
  FROM   inventory
  WHERE  is_active = TRUE
    AND  reorder_point IS NOT NULL
    AND  current_qty <= reorder_point;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.used_qty DESC), '[]'::jsonb)
  INTO   v_top_used
  FROM (
    SELECT
      i.name,
      ROUND(SUM(oi.qty * ri.qty_required)::NUMERIC, 2) AS used_qty,
      i.unit
    FROM   order_items oi
    JOIN   orders o               ON o.id             = oi.order_id
    JOIN   recipe_ingredients ri  ON ri.recipe_id      = oi.recipe_id
    JOIN   inventory i            ON i.id              = ri.inventory_id
    WHERE  o.status = 'paid'
      AND  (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today
    GROUP  BY i.id, i.name, i.unit
    ORDER  BY used_qty DESC
    LIMIT  3
  ) t;

  RETURN jsonb_build_object(
    'total_value', v_total_value,
    'low_count',   v_low_count,
    'top_used',    COALESCE(v_top_used, '[]'::jsonb)
  );
END;
$$;

-- ─── 7. GRANT TO anon ─────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_dashboard_stats()            TO anon;
GRANT EXECUTE ON FUNCTION get_hourly_sales(DATE)           TO anon;
GRANT EXECUTE ON FUNCTION get_menu_performance(INTEGER)    TO anon;
GRANT EXECUTE ON FUNCTION get_customization_stats(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_queue_performance(INTEGER)   TO anon;
GRANT EXECUTE ON FUNCTION get_stock_value()                TO anon;
