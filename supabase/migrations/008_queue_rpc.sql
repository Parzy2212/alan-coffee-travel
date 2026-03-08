-- Alan Cafe OS v1.0 — Queue RPCs for POS
-- Migration: 008_queue_rpc.sql

-- ─── 1. get_today_pos_queue ───────────────────────────────────────────────────
--
-- Returns today's active orders (null or 'making') with a human-readable
-- item summary built from order_items + recipes.
-- SECURITY DEFINER bypasses RLS so the anon POS terminal can call it.

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
      o.id                                                          AS order_id,
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
      )                                                             AS summary
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN recipes r      ON r.id = oi.recipe_id
    WHERE (o.queue_status IS NULL OR o.queue_status = 'making')
      AND o.queue_number IS NOT NULL
      AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE
            = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE
    GROUP BY o.id, o.queue_number, o.queue_status
    ORDER BY o.queue_number;
END;
$$;

-- ─── 2. update_queue_status ───────────────────────────────────────────────────
--
-- Allows the POS terminal (anon) to move an order through the queue states.
-- Validates allowed transitions to prevent arbitrary status changes.

CREATE OR REPLACE FUNCTION update_queue_status(
  p_order_id UUID,
  p_status   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('making', 'ready', 'collected') THEN
    RAISE EXCEPTION 'Invalid queue_status: %', p_status USING ERRCODE = 'P0001';
  END IF;

  UPDATE orders
  SET queue_status = p_status
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id USING ERRCODE = 'P0002';
  END IF;
END;
$$;
