-- Alan Cafe OS — Stock Detail
-- Migration: 017_stock_detail.sql

-- ─── 1. New columns on inventory ──────────────────────────────────────────────

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS max_quantity             NUMERIC,
  ADD COLUMN IF NOT EXISTS storage_location         TEXT,
  ADD COLUMN IF NOT EXISTS expiry_days              INTEGER,
  ADD COLUMN IF NOT EXISTS secondary_supplier       TEXT,
  ADD COLUMN IF NOT EXISTS secondary_supplier_phone TEXT,
  ADD COLUMN IF NOT EXISTS notes                    TEXT;

-- ─── 2. get_stock_detail() — full inventory with computed stats ───────────────

DROP FUNCTION IF EXISTS get_stock_detail();

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
        ROUND(SUM(oi.qty * ri.qty_required) / 30.0, 4) AS daily_avg
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
      WHERE o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE >= v_since
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

-- ─── 3. get_stock_analytics(days, inventory_id) — daily usage trend ───────────

DROP FUNCTION IF EXISTS get_stock_analytics(INTEGER, UUID);

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
        SUM(oi.qty * ri.qty_required)                       AS used_qty,
        SUM(oi.qty * oi.unit_price_lak)                     AS sales_lak
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
      WHERE o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE >= v_since
        AND (p_inventory_id IS NULL OR ri.inventory_id = p_inventory_id)
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

-- ─── 4. create_inventory_item(…) ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS create_inventory_item(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_inventory_item(
  p_name                     TEXT,
  p_name_th                  TEXT    DEFAULT NULL,
  p_name_lo                  TEXT    DEFAULT NULL,
  p_unit                     TEXT    DEFAULT 'g',
  p_current_qty              NUMERIC DEFAULT 0,
  p_reorder_point            NUMERIC DEFAULT NULL,
  p_max_quantity             NUMERIC DEFAULT NULL,
  p_cost_per_unit            NUMERIC DEFAULT NULL,
  p_storage_location         TEXT    DEFAULT NULL,
  p_expiry_days              INTEGER DEFAULT NULL,
  p_supplier                 TEXT    DEFAULT NULL,
  p_supplier_phone           TEXT    DEFAULT NULL,
  p_secondary_supplier       TEXT    DEFAULT NULL,
  p_secondary_supplier_phone TEXT    DEFAULT NULL,
  p_notes                    TEXT    DEFAULT NULL
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
  INSERT INTO inventory (
    name, name_th, name_lo, unit, current_qty, reorder_point, max_quantity,
    cost_per_unit, storage_location, expiry_days,
    supplier, supplier_phone, secondary_supplier, secondary_supplier_phone,
    notes, is_active, updated_at
  ) VALUES (
    p_name,
    NULLIF(p_name_th, ''),    NULLIF(p_name_lo, ''),
    COALESCE(NULLIF(p_unit, ''), 'g'),
    COALESCE(p_current_qty, 0),
    CASE WHEN p_reorder_point  = 0 THEN NULL ELSE p_reorder_point  END,
    CASE WHEN p_max_quantity   = 0 THEN NULL ELSE p_max_quantity   END,
    CASE WHEN p_cost_per_unit  = 0 THEN NULL ELSE p_cost_per_unit  END,
    NULLIF(p_storage_location, ''),
    CASE WHEN p_expiry_days    = 0 THEN NULL ELSE p_expiry_days    END,
    NULLIF(p_supplier, ''),   NULLIF(p_supplier_phone, ''),
    NULLIF(p_secondary_supplier, ''), NULLIF(p_secondary_supplier_phone, ''),
    NULLIF(p_notes, ''),
    TRUE, NOW()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─── 5. update_inventory_item(…) ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS update_inventory_item(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_inventory_item(
  p_id                       UUID,
  p_name                     TEXT    DEFAULT NULL,
  p_name_th                  TEXT    DEFAULT NULL,
  p_name_lo                  TEXT    DEFAULT NULL,
  p_unit                     TEXT    DEFAULT NULL,
  p_reorder_point            NUMERIC DEFAULT NULL,
  p_max_quantity             NUMERIC DEFAULT NULL,
  p_cost_per_unit            NUMERIC DEFAULT NULL,
  p_storage_location         TEXT    DEFAULT NULL,
  p_expiry_days              INTEGER DEFAULT NULL,
  p_supplier                 TEXT    DEFAULT NULL,
  p_supplier_phone           TEXT    DEFAULT NULL,
  p_secondary_supplier       TEXT    DEFAULT NULL,
  p_secondary_supplier_phone TEXT    DEFAULT NULL,
  p_notes                    TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inventory SET
    name                     = COALESCE(NULLIF(p_name, ''), name),
    name_th                  = CASE WHEN p_name_th  IS NULL THEN name_th  ELSE NULLIF(p_name_th,  '') END,
    name_lo                  = CASE WHEN p_name_lo  IS NULL THEN name_lo  ELSE NULLIF(p_name_lo,  '') END,
    unit                     = COALESCE(NULLIF(p_unit, ''), unit),
    reorder_point            = CASE WHEN p_reorder_point  IS NULL THEN reorder_point  ELSE NULLIF(p_reorder_point,  0) END,
    max_quantity             = CASE WHEN p_max_quantity   IS NULL THEN max_quantity   ELSE NULLIF(p_max_quantity,   0) END,
    cost_per_unit            = CASE WHEN p_cost_per_unit  IS NULL THEN cost_per_unit  ELSE NULLIF(p_cost_per_unit,  0) END,
    storage_location         = CASE WHEN p_storage_location IS NULL THEN storage_location ELSE NULLIF(p_storage_location, '') END,
    expiry_days              = CASE WHEN p_expiry_days    IS NULL THEN expiry_days    ELSE NULLIF(p_expiry_days,    0) END,
    supplier                 = CASE WHEN p_supplier         IS NULL THEN supplier         ELSE NULLIF(p_supplier,         '') END,
    supplier_phone           = CASE WHEN p_supplier_phone   IS NULL THEN supplier_phone   ELSE NULLIF(p_supplier_phone,   '') END,
    secondary_supplier       = CASE WHEN p_secondary_supplier       IS NULL THEN secondary_supplier       ELSE NULLIF(p_secondary_supplier,       '') END,
    secondary_supplier_phone = CASE WHEN p_secondary_supplier_phone IS NULL THEN secondary_supplier_phone ELSE NULLIF(p_secondary_supplier_phone, '') END,
    notes                    = CASE WHEN p_notes IS NULL THEN notes ELSE NULLIF(p_notes, '') END,
    updated_at               = NOW()
  WHERE id = p_id;
END;
$$;

-- ─── 6. GRANT TO anon ─────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_stock_detail()                                                                                                                      TO anon;
GRANT EXECUTE ON FUNCTION get_stock_analytics(INTEGER, UUID)                                                                                                      TO anon;
GRANT EXECUTE ON FUNCTION create_inventory_item(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT)           TO anon;
GRANT EXECUTE ON FUNCTION update_inventory_item(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT)              TO anon;
