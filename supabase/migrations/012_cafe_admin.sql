-- Alan Cafe OS — Cafe Admin Backend
-- Migration: 012_cafe_admin.sql

-- ─── 1. site_settings table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults
INSERT INTO site_settings (key, value) VALUES
  ('shop_name',   'Alan Coffee & Travel'),
  ('ticker_text', 'ยินดีต้อนรับสู่ Alan Coffee & Travel   •   ออเดอร์ที่เสร็จแล้วกรุณารับภายใน 10 นาที   •   Wi-Fi: AlanCoffee   •   ขอบคุณที่ใช้บริการ — Thank you for visiting!   •   ')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public: read site_settings" ON site_settings FOR SELECT TO anon USING (true);

-- ─── 2. Make purchase_logs.receipt_url nullable ───────────────────────────────

ALTER TABLE purchase_logs ALTER COLUMN receipt_url DROP NOT NULL;

-- ─── 3. Anon read policies for recipes and inventory ──────────────────────────

DROP POLICY IF EXISTS "anon: read recipes" ON recipes;
CREATE POLICY "anon: read recipes" ON recipes FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon: read inventory" ON inventory;
CREATE POLICY "anon: read inventory" ON inventory FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon: read categories" ON categories;
CREATE POLICY "anon: read categories" ON categories FOR SELECT TO anon USING (is_active = TRUE);

-- ─── 4. Dashboard RPC: get_dashboard_stats() ──────────────────────────────────

DROP FUNCTION IF EXISTS get_dashboard_stats();

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_sales  NUMERIC;
  v_today_orders INTEGER;
  v_yesterday_sales NUMERIC;
BEGIN
  -- Today (Vientiane timezone)
  SELECT
    COALESCE(SUM(total_lak), 0),
    COUNT(*)
  INTO v_today_sales, v_today_orders
  FROM orders
  WHERE status = 'paid'
    AND (created_at AT TIME ZONE 'Asia/Vientiane')::DATE
          = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;

  -- Yesterday
  SELECT COALESCE(SUM(total_lak), 0)
  INTO v_yesterday_sales
  FROM orders
  WHERE status = 'paid'
    AND (created_at AT TIME ZONE 'Asia/Vientiane')::DATE
          = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - INTERVAL '1 day';

  RETURN jsonb_build_object(
    'today_sales',     v_today_sales,
    'today_orders',    v_today_orders,
    'yesterday_sales', v_yesterday_sales
  );
END;
$$;

-- ─── 5. Dashboard RPC: get_top_items(INT) ─────────────────────────────────────

DROP FUNCTION IF EXISTS get_top_items(INTEGER);

CREATE OR REPLACE FUNCTION get_top_items(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  recipe_id    UUID,
  product_name TEXT,
  total_qty    BIGINT,
  total_sales  NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      r.id            AS recipe_id,
      r.product_name,
      SUM(oi.qty)     AS total_qty,
      SUM(oi.qty * oi.unit_price_lak) AS total_sales
    FROM order_items oi
    JOIN recipes r ON r.id = oi.recipe_id
    JOIN orders  o ON o.id = oi.order_id
    WHERE o.status = 'paid'
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE
            >= (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - INTERVAL '30 days'
    GROUP BY r.id, r.product_name
    ORDER BY total_qty DESC
    LIMIT p_limit;
END;
$$;

-- ─── 6. Dashboard RPC: get_sales_chart(INT) ───────────────────────────────────

DROP FUNCTION IF EXISTS get_sales_chart(INTEGER);

CREATE OR REPLACE FUNCTION get_sales_chart(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  day        DATE,
  sales      NUMERIC,
  order_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    WITH date_series AS (
      SELECT generate_series(
        (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - (p_days - 1) * INTERVAL '1 day',
        (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE,
        INTERVAL '1 day'
      )::DATE AS day
    )
    SELECT
      ds.day,
      COALESCE(SUM(o.total_lak), 0)   AS sales,
      COUNT(o.id)                      AS order_count
    FROM date_series ds
    LEFT JOIN orders o
      ON (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = ds.day
      AND o.status = 'paid'
    GROUP BY ds.day
    ORDER BY ds.day;
END;
$$;

-- ─── 7. Management RPCs ───────────────────────────────────────────────────────

-- Toggle recipe active/inactive
DROP FUNCTION IF EXISTS toggle_recipe_active(UUID);

CREATE OR REPLACE FUNCTION toggle_recipe_active(p_recipe_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_state BOOLEAN;
BEGIN
  UPDATE recipes
  SET is_active = NOT is_active
  WHERE id = p_recipe_id
  RETURNING is_active INTO v_new_state;

  RETURN jsonb_build_object('is_active', v_new_state);
END;
$$;

-- Update recipe price
DROP FUNCTION IF EXISTS update_recipe_price(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION update_recipe_price(p_recipe_id UUID, p_price NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_price < 0 THEN
    RAISE EXCEPTION 'Price cannot be negative';
  END IF;
  UPDATE recipes SET price_lak = p_price WHERE id = p_recipe_id;
END;
$$;

-- Create new recipe
DROP FUNCTION IF EXISTS create_recipe(TEXT, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION create_recipe(
  p_product_name TEXT,
  p_name_th      TEXT DEFAULT NULL,
  p_name_lo      TEXT DEFAULT NULL,
  p_price        NUMERIC DEFAULT 0,
  p_category_id  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO recipes (product_name, product_name_th, product_name_lo, price_lak, category_id, is_active)
  VALUES (
    p_product_name,
    NULLIF(p_name_th, ''),
    NULLIF(p_name_lo, ''),
    p_price,
    NULLIF(p_category_id, '')::UUID,
    TRUE
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Add stock (creates purchase_log entry + updates inventory)
DROP FUNCTION IF EXISTS add_stock(UUID, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION add_stock(
  p_inventory_id UUID,
  p_qty          NUMERIC,
  p_cost_lak     NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inventory
  SET current_qty = current_qty + p_qty,
      updated_at  = NOW()
  WHERE id = p_inventory_id;

  INSERT INTO purchase_logs (inventory_id, qty_purchased, unit_price_lak)
  VALUES (p_inventory_id, p_qty, CASE WHEN p_qty > 0 THEN p_cost_lak / p_qty ELSE 0 END);
END;
$$;

-- Get site settings as JSON object
DROP FUNCTION IF EXISTS get_site_settings();

CREATE OR REPLACE FUNCTION get_site_settings()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{}';
  r        RECORD;
BEGIN
  FOR r IN SELECT key, value FROM site_settings LOOP
    v_result := v_result || jsonb_build_object(r.key, r.value);
  END LOOP;
  RETURN v_result;
END;
$$;

-- Update a single site setting
DROP FUNCTION IF EXISTS update_site_setting(TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_site_setting(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO site_settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET value = p_value, updated_at = NOW();
END;
$$;

-- ─── 8. GRANT EXECUTE TO anon ─────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_dashboard_stats()                         TO anon;
GRANT EXECUTE ON FUNCTION get_top_items(INTEGER)                        TO anon;
GRANT EXECUTE ON FUNCTION get_sales_chart(INTEGER)                      TO anon;
GRANT EXECUTE ON FUNCTION toggle_recipe_active(UUID)                    TO anon;
GRANT EXECUTE ON FUNCTION update_recipe_price(UUID, NUMERIC)            TO anon;
GRANT EXECUTE ON FUNCTION create_recipe(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION add_stock(UUID, NUMERIC, NUMERIC)             TO anon;
GRANT EXECUTE ON FUNCTION get_site_settings()                           TO anon;
GRANT EXECUTE ON FUNCTION update_site_setting(TEXT, TEXT)               TO anon;
