-- Alan Cafe OS — Menu Detail Fields
-- Migration: 015_menu_detail.sql

-- ─── 1. New columns on recipes ────────────────────────────────────────────────

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS description_en   TEXT,
  ADD COLUMN IF NOT EXISTS description_th   TEXT,
  ADD COLUMN IF NOT EXISTS description_lo   TEXT,
  ADD COLUMN IF NOT EXISTS preparation_time INTEGER,
  ADD COLUMN IF NOT EXISTS calories         INTEGER,
  ADD COLUMN IF NOT EXISTS allergens        TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_seasonal      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seasonal_note    TEXT,
  ADD COLUMN IF NOT EXISTS cost_per_cup_lak NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS image_url        TEXT;

-- ─── 2. get_menu_with_stats() — all recipes + sales + ingredients ─────────────

DROP FUNCTION IF EXISTS get_menu_with_stats();

CREATE OR REPLACE FUNCTION get_menu_with_stats()
RETURNS TABLE (
  id               UUID,
  product_name     TEXT,
  product_name_th  TEXT,
  product_name_lo  TEXT,
  price_lak        NUMERIC,
  is_active        BOOLEAN,
  is_seasonal      BOOLEAN,
  seasonal_note    TEXT,
  category         TEXT,
  category_id      UUID,
  description_en   TEXT,
  description_th   TEXT,
  description_lo   TEXT,
  preparation_time INTEGER,
  calories         INTEGER,
  allergens        TEXT[],
  cost_per_cup_lak NUMERIC,
  image_url        TEXT,
  total_qty_30d    BIGINT,
  total_sales_30d  NUMERIC,
  calc_cost        NUMERIC,
  margin_pct       NUMERIC,
  ingredients      JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - 29;
BEGIN
  RETURN QUERY
    WITH sales_30 AS (
      SELECT
        oi.recipe_id,
        SUM(oi.qty)::BIGINT                   AS total_qty,
        SUM(oi.qty * oi.unit_price_lak)       AS total_sales
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE >= v_since
      GROUP BY oi.recipe_id
    ),
    r_costs AS (
      SELECT
        ri.recipe_id,
        COALESCE(SUM(ri.qty_required * COALESCE(i.cost_per_unit, 0)), 0) AS calc
      FROM recipe_ingredients ri
      JOIN inventory i ON i.id = ri.inventory_id
      GROUP BY ri.recipe_id
    ),
    r_ings AS (
      SELECT
        ri.recipe_id,
        jsonb_agg(
          jsonb_build_object(
            'id',           ri.id,
            'inventory_id', ri.inventory_id,
            'name',         i.name,
            'name_th',      i.name_th,
            'qty_required', ri.qty_required,
            'unit',         ri.unit
          )
          ORDER BY ri.id
        ) AS ings
      FROM recipe_ingredients ri
      JOIN inventory i ON i.id = ri.inventory_id
      GROUP BY ri.recipe_id
    )
    SELECT
      r.id,
      r.product_name,
      r.product_name_th,
      r.product_name_lo,
      r.price_lak,
      r.is_active,
      COALESCE(r.is_seasonal, FALSE)                            AS is_seasonal,
      r.seasonal_note,
      r.category,
      r.category_id,
      r.description_en,
      r.description_th,
      r.description_lo,
      r.preparation_time,
      r.calories,
      COALESCE(r.allergens, '{}')                               AS allergens,
      r.cost_per_cup_lak,
      r.image_url,
      COALESCE(s.total_qty,   0)::BIGINT                        AS total_qty_30d,
      COALESCE(s.total_sales, 0)                                AS total_sales_30d,
      COALESCE(c.calc, 0)                                       AS calc_cost,
      CASE WHEN r.price_lak > 0
        THEN ROUND(
          (r.price_lak - COALESCE(r.cost_per_cup_lak, c.calc, 0))
          / r.price_lak * 100, 1
        )
        ELSE 0
      END                                                       AS margin_pct,
      COALESCE(ri.ings, '[]'::jsonb)                            AS ingredients
    FROM recipes r
    LEFT JOIN sales_30  s  ON s.recipe_id  = r.id
    LEFT JOIN r_costs   c  ON c.recipe_id  = r.id
    LEFT JOIN r_ings    ri ON ri.recipe_id = r.id
    ORDER BY r.product_name;
END;
$$;

-- ─── 3. get_recipe_sales_history(UUID, INTEGER) ───────────────────────────────

DROP FUNCTION IF EXISTS get_recipe_sales_history(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_recipe_sales_history(
  p_recipe_id UUID,
  p_days      INTEGER DEFAULT 7
)
RETURNS TABLE (day DATE, qty BIGINT, sales NUMERIC)
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
      SELECT generate_series(
        v_since,
        (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE,
        '1 day'::INTERVAL
      )::DATE AS d
    )
    SELECT
      ds.d                                          AS day,
      COALESCE(SUM(oi.qty), 0)::BIGINT             AS qty,
      COALESCE(SUM(oi.qty * oi.unit_price_lak), 0) AS sales
    FROM dates ds
    LEFT JOIN order_items oi
      ON oi.recipe_id = p_recipe_id
    LEFT JOIN orders o
      ON o.id = oi.order_id
      AND o.status = 'paid'
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = ds.d
    GROUP BY ds.d
    ORDER BY ds.d;
END;
$$;

-- ─── 4. update_recipe_full(…) — update all fields ────────────────────────────

DROP FUNCTION IF EXISTS update_recipe_full(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT[], TEXT, BOOLEAN, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_recipe_full(
  p_recipe_id      UUID,
  p_product_name   TEXT,
  p_name_th        TEXT    DEFAULT NULL,
  p_name_lo        TEXT    DEFAULT NULL,
  p_description_en TEXT    DEFAULT NULL,
  p_description_th TEXT    DEFAULT NULL,
  p_description_lo TEXT    DEFAULT NULL,
  p_price          NUMERIC DEFAULT NULL,
  p_cost_per_cup   NUMERIC DEFAULT NULL,
  p_prep_time      INTEGER DEFAULT NULL,
  p_calories       INTEGER DEFAULT NULL,
  p_allergens      TEXT[]  DEFAULT '{}',
  p_category_id    TEXT    DEFAULT NULL,
  p_is_seasonal    BOOLEAN DEFAULT FALSE,
  p_seasonal_note  TEXT    DEFAULT NULL,
  p_image_url      TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE recipes SET
    product_name     = COALESCE(NULLIF(p_product_name, ''), product_name),
    product_name_th  = NULLIF(p_name_th, ''),
    product_name_lo  = NULLIF(p_name_lo, ''),
    description_en   = NULLIF(p_description_en, ''),
    description_th   = NULLIF(p_description_th, ''),
    description_lo   = NULLIF(p_description_lo, ''),
    price_lak        = COALESCE(p_price, price_lak),
    cost_per_cup_lak = CASE WHEN p_cost_per_cup IS NULL OR p_cost_per_cup = 0 THEN NULL ELSE p_cost_per_cup END,
    preparation_time = CASE WHEN p_prep_time IS NULL OR p_prep_time = 0 THEN NULL ELSE p_prep_time END,
    calories         = CASE WHEN p_calories IS NULL OR p_calories = 0 THEN NULL ELSE p_calories END,
    allergens        = COALESCE(p_allergens, '{}'),
    category_id      = NULLIF(p_category_id, '')::UUID,
    is_seasonal      = COALESCE(p_is_seasonal, FALSE),
    seasonal_note    = NULLIF(p_seasonal_note, ''),
    image_url        = NULLIF(p_image_url, '')
  WHERE id = p_recipe_id;
END;
$$;

-- ─── 5. create_recipe_full(…) — create with all fields ───────────────────────

DROP FUNCTION IF EXISTS create_recipe_full(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT[], TEXT, BOOLEAN, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_recipe_full(
  p_product_name   TEXT,
  p_name_th        TEXT    DEFAULT NULL,
  p_name_lo        TEXT    DEFAULT NULL,
  p_description_en TEXT    DEFAULT NULL,
  p_description_th TEXT    DEFAULT NULL,
  p_description_lo TEXT    DEFAULT NULL,
  p_price          NUMERIC DEFAULT 0,
  p_cost_per_cup   NUMERIC DEFAULT NULL,
  p_prep_time      INTEGER DEFAULT NULL,
  p_calories       INTEGER DEFAULT NULL,
  p_allergens      TEXT[]  DEFAULT '{}',
  p_category_id    TEXT    DEFAULT NULL,
  p_is_seasonal    BOOLEAN DEFAULT FALSE,
  p_seasonal_note  TEXT    DEFAULT NULL,
  p_image_url      TEXT    DEFAULT NULL
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
  INSERT INTO recipes (
    product_name, product_name_th, product_name_lo,
    description_en, description_th, description_lo,
    price_lak, cost_per_cup_lak, preparation_time, calories,
    allergens, category_id, is_seasonal, seasonal_note, image_url,
    is_active
  ) VALUES (
    p_product_name,
    NULLIF(p_name_th, ''),         NULLIF(p_name_lo, ''),
    NULLIF(p_description_en, ''),  NULLIF(p_description_th, ''), NULLIF(p_description_lo, ''),
    COALESCE(p_price, 0),
    CASE WHEN p_cost_per_cup IS NULL OR p_cost_per_cup = 0 THEN NULL ELSE p_cost_per_cup END,
    CASE WHEN p_prep_time    IS NULL OR p_prep_time    = 0 THEN NULL ELSE p_prep_time    END,
    CASE WHEN p_calories     IS NULL OR p_calories     = 0 THEN NULL ELSE p_calories     END,
    COALESCE(p_allergens, '{}'),
    NULLIF(p_category_id, '')::UUID,
    COALESCE(p_is_seasonal, FALSE),
    NULLIF(p_seasonal_note, ''),   NULLIF(p_image_url, ''),
    TRUE
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─── 6. GRANT TO anon ─────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_menu_with_stats()                                                                                      TO anon;
GRANT EXECUTE ON FUNCTION get_recipe_sales_history(UUID, INTEGER)                                                                    TO anon;
GRANT EXECUTE ON FUNCTION update_recipe_full(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT[], TEXT, BOOLEAN, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_recipe_full(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT[], TEXT, BOOLEAN, TEXT, TEXT)       TO anon;
