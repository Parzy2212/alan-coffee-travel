-- Alan Cafe OS — Cafe Detail Fields
-- Migration: 013_cafe_detail.sql

-- ─── 1. Add supplier info to inventory ───────────────────────────────────────

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS supplier       TEXT,
  ADD COLUMN IF NOT EXISTS supplier_phone TEXT;

-- ─── 2. Add multilingual shop name to site_settings ──────────────────────────

INSERT INTO site_settings (key, value) VALUES
  ('shop_name_th', 'อลัน คอฟฟี่ แอนด์ ทราเวิล'),
  ('shop_name_lo', 'ອາລານ ກາເຟ ແລະ ທ່ອງທ່ຽວ')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. update_recipe — update all text/price/category fields ────────────────

DROP FUNCTION IF EXISTS update_recipe(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION update_recipe(
  p_recipe_id    UUID,
  p_product_name TEXT    DEFAULT NULL,
  p_name_th      TEXT    DEFAULT NULL,
  p_name_lo      TEXT    DEFAULT NULL,
  p_price        NUMERIC DEFAULT NULL,
  p_category_id  TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE recipes
  SET
    product_name    = COALESCE(NULLIF(p_product_name, ''), product_name),
    product_name_th = CASE
                        WHEN p_name_th IS NULL THEN product_name_th
                        ELSE NULLIF(p_name_th, '')
                      END,
    product_name_lo = CASE
                        WHEN p_name_lo IS NULL THEN product_name_lo
                        ELSE NULLIF(p_name_lo, '')
                      END,
    price_lak       = COALESCE(p_price, price_lak),
    category_id     = CASE
                        WHEN p_category_id IS NULL THEN category_id
                        ELSE NULLIF(p_category_id, '')::UUID
                      END
  WHERE id = p_recipe_id;
END;
$$;

-- ─── 4. Recreate add_stock with supplier + purchase date ─────────────────────

DROP FUNCTION IF EXISTS add_stock(UUID, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION add_stock(
  p_inventory_id UUID,
  p_qty          NUMERIC,
  p_cost_lak     NUMERIC     DEFAULT 0,
  p_supplier     TEXT        DEFAULT NULL,
  p_purchased_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_price NUMERIC;
BEGIN
  v_unit_price := CASE WHEN p_qty > 0 THEN p_cost_lak / p_qty ELSE 0 END;

  UPDATE inventory
  SET current_qty = current_qty + p_qty,
      updated_at  = NOW()
  WHERE id = p_inventory_id;

  INSERT INTO purchase_logs (inventory_id, qty_purchased, unit_price_lak, supplier, created_at)
  VALUES (p_inventory_id, p_qty, v_unit_price, p_supplier, p_purchased_at);
END;
$$;

-- ─── 5. get_purchase_history — last N purchase logs for an inventory item ─────

DROP FUNCTION IF EXISTS get_purchase_history(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_purchase_history(
  p_inventory_id UUID,
  p_limit        INTEGER DEFAULT 5
)
RETURNS TABLE (
  id             UUID,
  qty_purchased  NUMERIC,
  unit_price_lak NUMERIC,
  total_lak      NUMERIC,
  supplier       TEXT,
  created_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      pl.id,
      pl.qty_purchased,
      pl.unit_price_lak,
      pl.total_lak,
      pl.supplier,
      pl.created_at
    FROM purchase_logs pl
    WHERE pl.inventory_id = p_inventory_id
    ORDER BY pl.created_at DESC
    LIMIT p_limit;
END;
$$;

-- ─── 6. GRANT TO anon ─────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION update_recipe(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT)             TO anon;
GRANT EXECUTE ON FUNCTION add_stock(UUID, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ)             TO anon;
GRANT EXECUTE ON FUNCTION get_purchase_history(UUID, INTEGER)                              TO anon;
