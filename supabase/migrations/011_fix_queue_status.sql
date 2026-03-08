-- Alan Cafe OS v1.0 — Fix queue to filter by status = 'paid'
-- Migration: 011_fix_queue_status.sql
--
-- Root cause: create_order_with_deduction sets status = 'paid' when the order
-- is complete. Previous get_today_pos_queue() had no filter on status, which
-- worked, but the RLS policy blocked anon from reading those rows because the
-- policy did not include status = 'paid' in its USING clause.

-- ─── 1. Recreate get_today_pos_queue ─────────────────────────────────────────

DROP FUNCTION IF EXISTS get_today_pos_queue();

CREATE OR REPLACE FUNCTION get_today_pos_queue()
RETURNS TABLE (
  order_id     UUID,
  queue_number INTEGER,
  queue_status TEXT,
  summary      TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      o.id          AS order_id,
      o.queue_number,
      o.queue_status,
      STRING_AGG(
        CASE WHEN oi.qty > 1
             THEN r.product_name || ' x' || oi.qty
             ELSE r.product_name
        END
        || CASE WHEN oi.customization IS NOT NULL AND oi.customization <> ''
                THEN ' · ' || oi.customization
                ELSE ''
           END,
        ',  '
        ORDER BY oi.id
      ) AS summary
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN recipes r      ON r.id        = oi.recipe_id
    WHERE o.status = 'paid'
      AND (o.queue_status IS NULL
           OR o.queue_status IN ('waiting', 'making'))
      AND o.queue_number IS NOT NULL
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE
            = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE
    GROUP BY o.id, o.queue_number, o.queue_status
    ORDER BY o.queue_number;
END;
$$;

-- ─── 2. Fix RLS policy for anon on orders ────────────────────────────────────
--
-- Previous policy filtered only on queue_status, missing status = 'paid'.
-- Expand to cover all paid orders with an active queue_status.

DROP POLICY IF EXISTS "anon: read active queue display" ON orders;

CREATE POLICY "anon: read active queue display" ON orders
  FOR SELECT TO anon
  USING (
    status = 'paid'
    AND queue_status IN ('waiting', 'making', 'ready')
    AND created_at >= (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE::TIMESTAMPTZ - INTERVAL '1 hour'
    AND created_at <  (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE::TIMESTAMPTZ + INTERVAL '25 hours'
  );

-- ─── 3. Re-GRANT EXECUTE TO anon on all RPC functions ────────────────────────

GRANT EXECUTE ON FUNCTION get_today_pos_queue()                                                    TO anon;
GRANT EXECUTE ON FUNCTION update_queue_status(UUID, TEXT)                                          TO anon;
GRANT EXECUTE ON FUNCTION create_order_with_deduction(JSONB, UUID, UUID, TEXT, TEXT, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_daily_queue_number()                                                 TO anon;
GRANT EXECUTE ON FUNCTION check_stock_for_cart(JSONB)                                              TO anon;
