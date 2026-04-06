-- POS: held_orders table + fixes
-- Migration: 031_held_orders_pos.sql

-- ─── 1. held_orders table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS held_orders (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number  TEXT,
  customer_name TEXT,
  note          TEXT,
  cart_items    JSONB       NOT NULL,
  total_lak     NUMERIC     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ DEFAULT now() + INTERVAL '4 hours'
);

ALTER TABLE held_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_held_orders_all" ON held_orders;
CREATE POLICY "anon_held_orders_all" ON held_orders
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON held_orders TO anon;

-- ─── 2. default_sweetness on recipes ─────────────────────────────────────────

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS default_sweetness TEXT DEFAULT 'normal';

-- ─── 3. Fix void_order: qty_required → qty_normal + IS NOT NULL guard ────────
--    (was broken after unified DB architecture migration)

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
  UPDATE orders SET
    status      = 'void',
    void_reason = NULLIF(p_reason, '')
  WHERE id = p_order_id;

  -- Restore inventory (reverse deduction) — only for direct inventory ingredients
  UPDATE inventory i
  SET    current_qty = current_qty + restore.qty,
         updated_at  = NOW()
  FROM (
    SELECT ri.inventory_id,
           SUM(oi.qty * ri.qty_normal) AS qty
    FROM   order_items oi
    JOIN   recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
    WHERE  oi.order_id        = p_order_id
      AND  ri.inventory_id IS NOT NULL
    GROUP  BY ri.inventory_id
  ) restore
  WHERE i.id = restore.inventory_id;
END;
$$;

GRANT EXECUTE ON FUNCTION void_order(UUID, TEXT) TO anon;
