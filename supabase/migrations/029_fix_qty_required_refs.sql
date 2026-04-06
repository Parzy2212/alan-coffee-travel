-- Fix RPCs that reference recipe_ingredients.qty_required
-- Migration: 029_fix_qty_required_refs.sql
--
-- The unified DB architecture migration renamed qty_required → qty_normal
-- and made inventory_id nullable (XOR with base_id).
-- All RPCs below were silently failing (returning null → empty lists).
--
-- Changes in each function:
--   ri.qty_required → ri.qty_normal
--   Added AND ri.inventory_id IS NOT NULL where inventory JOIN is involved

-- ─── 1. get_stock_detail() ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_stock_detail()
RETURNS TABLE (
  id                       UUID,
  name                     TEXT,
  name_th                  TEXT,
  name_lo                  TEXT,
  unit                     TEXT,
  current_qty              NUMERIC,
  reorder_point            NUMERIC,
  max_quantity             NUMERIC,
  cost_per_unit            NUMERIC,
  stock_value              NUMERIC,
  storage_location         TEXT,
  expiry_days              INTEGER,
  expiry_days_remaining    INTEGER,
  supplier                 TEXT,
  supplier_phone           TEXT,
  secondary_supplier       TEXT,
  secondary_supplier_phone TEXT,
  notes                    TEXT,
  is_active                BOOLEAN,
  daily_usage              NUMERIC,
  days_until_empty         INTEGER,
  last_price               NUMERIC,
  last_purchased_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  v_since DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - 29;
BEGIN
  RETURN QUERY
    WITH usage_30 AS (
      SELECT
        ri.inventory_id,
        ROUND(SUM(oi.qty * ri.qty_normal) / 30.0, 4) AS daily_avg
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
      WHERE o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE >= v_since
        AND ri.inventory_id IS NOT NULL
      GROUP BY ri.inventory_id
    ),
    last_purchase AS (
      SELECT DISTINCT ON (pl.inventory_id)
        pl.inventory_id,
        pl.unit_price_lak,
        pl.created_at
      FROM purchase_logs pl
      ORDER BY pl.inventory_id, pl.created_at DESC
    )
    SELECT
      i.id,
      i.name,
      i.name_th,
      i.name_lo,
      i.unit,
      i.current_qty,
      i.reorder_point,
      i.max_quantity,
      i.cost_per_unit,
      ROUND(i.current_qty * COALESCE(i.cost_per_unit, 0), 2)         AS stock_value,
      i.storage_location,
      i.expiry_days,
      CASE
        WHEN i.expiry_days IS NOT NULL AND lp.created_at IS NOT NULL
        THEN i.expiry_days - (v_today - (lp.created_at AT TIME ZONE 'Asia/Vientiane')::DATE)
        ELSE NULL
      END                                                              AS expiry_days_remaining,
      i.supplier,
      i.supplier_phone,
      i.secondary_supplier,
      i.secondary_supplier_phone,
      i.notes,
      i.is_active,
      COALESCE(u.daily_avg, 0)                                         AS daily_usage,
      CASE
        WHEN COALESCE(u.daily_avg, 0) > 0 AND i.current_qty >= 0
        THEN FLOOR(i.current_qty / u.daily_avg)::INTEGER
        ELSE NULL
      END                                                              AS days_until_empty,
      lp.unit_price_lak                                                AS last_price,
      lp.created_at                                                    AS last_purchased_at
    FROM inventory i
    LEFT JOIN usage_30      u  ON u.inventory_id  = i.id
    LEFT JOIN last_purchase lp ON lp.inventory_id = i.id
    WHERE i.is_active = TRUE
    ORDER BY i.name;
END;
$$;

-- ─── 2. get_stock_analytics(days, inventory_id) ───────────────────────────────

CREATE OR REPLACE FUNCTION get_stock_analytics(
  p_days         INTEGER DEFAULT 30,
  p_inventory_id UUID    DEFAULT NULL
)
RETURNS TABLE (
  inventory_id UUID,
  name         TEXT,
  unit         TEXT,
  day          DATE,
  used_qty     NUMERIC,
  sales_lak    NUMERIC
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
    WITH dates AS (
      SELECT generate_series(v_since, (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE, '1 day'::INTERVAL)::DATE AS d
    ),
    items AS (
      SELECT id, name, unit FROM inventory
      WHERE (p_inventory_id IS NULL OR id = p_inventory_id) AND is_active = TRUE
    ),
    combos AS (
      SELECT it.id AS inventory_id, it.name, it.unit, ds.d AS day
      FROM items it CROSS JOIN dates ds
    ),
    usage_data AS (
      SELECT
        ri.inventory_id,
        (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE AS day,
        SUM(oi.qty * ri.qty_normal)                        AS used_qty,
        SUM(oi.qty * oi.unit_price_lak)                    AS sales_lak
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
      WHERE o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE >= v_since
        AND (p_inventory_id IS NULL OR ri.inventory_id = p_inventory_id)
        AND ri.inventory_id IS NOT NULL
      GROUP BY ri.inventory_id, (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE
    )
    SELECT
      c.inventory_id,
      c.name,
      c.unit,
      c.day,
      COALESCE(ud.used_qty,  0) AS used_qty,
      COALESCE(ud.sales_lak, 0) AS sales_lak
    FROM combos c
    LEFT JOIN usage_data ud ON ud.inventory_id = c.inventory_id AND ud.day = c.day
    ORDER BY c.inventory_id, c.day;
END;
$$;

-- ─── 3. get_dashboard_stats() ─────────────────────────────────────────────────

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
        SELECT SUM(ri.qty_normal * COALESCE(i.cost_per_unit, 0))
        FROM   recipe_ingredients ri
        JOIN   inventory i ON i.id = ri.inventory_id
        WHERE  ri.recipe_id = oi.recipe_id
          AND  ri.inventory_id IS NOT NULL
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

-- ─── 4. get_menu_performance(days) ────────────────────────────────────────────

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
        COALESCE(SUM(ri.qty_normal * COALESCE(i.cost_per_unit, 0)), 0) AS unit_cost
      FROM recipe_ingredients ri
      JOIN inventory i ON i.id = ri.inventory_id
      WHERE ri.inventory_id IS NOT NULL
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

-- ─── 5. get_stock_value() ─────────────────────────────────────────────────────

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
      ROUND(SUM(oi.qty * ri.qty_normal)::NUMERIC, 2) AS used_qty,
      i.unit
    FROM   order_items oi
    JOIN   orders o               ON o.id             = oi.order_id
    JOIN   recipe_ingredients ri  ON ri.recipe_id      = oi.recipe_id
    JOIN   inventory i            ON i.id              = ri.inventory_id
    WHERE  o.status = 'paid'
      AND  (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today
      AND  ri.inventory_id IS NOT NULL
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

-- ─── 6. Re-grant (idempotent) ─────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_stock_detail()             TO anon;
GRANT EXECUTE ON FUNCTION get_stock_analytics(INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_stats()          TO anon;
GRANT EXECUTE ON FUNCTION get_menu_performance(INTEGER)  TO anon;
GRANT EXECUTE ON FUNCTION get_stock_value()              TO anon;
