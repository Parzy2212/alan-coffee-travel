-- Fix get_menu_with_stats broken by qty_required → qty_normal rename
-- Migration: 030_fix_menu_with_stats.sql
--
-- Problems fixed:
-- 1. r_costs CTE used ri.qty_required → renamed to ri.qty_normal
-- 2. r_ings CTE used ri.qty_required in jsonb_build_object → renamed
-- 3. Both CTEs JOIN inventory i ON i.id = ri.inventory_id without guarding
--    against nullable inventory_id (new XOR constraint) → added WHERE ri.inventory_id IS NOT NULL

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
        COALESCE(SUM(ri.qty_normal * COALESCE(i.cost_per_unit, 0)), 0) AS calc
      FROM recipe_ingredients ri
      JOIN inventory i ON i.id = ri.inventory_id
      WHERE ri.inventory_id IS NOT NULL
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
            'qty_required', ri.qty_normal,
            'unit',         ri.unit
          )
          ORDER BY ri.id
        ) AS ings
      FROM recipe_ingredients ri
      JOIN inventory i ON i.id = ri.inventory_id
      WHERE ri.inventory_id IS NOT NULL
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

GRANT EXECUTE ON FUNCTION get_menu_with_stats() TO anon;
