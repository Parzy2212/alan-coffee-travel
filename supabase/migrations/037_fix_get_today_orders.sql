-- ============================================================
--  Alan Cafe OS -- Migration 037: Fix get_today_orders()
--
--  A previous manual edit added employee_name to the RETURNS TABLE
--  but left the function body in an inconsistent state, causing
--  PostgreSQL error "structure of query does not match function
--  result type" (HTTP 400 from PostgREST).
--
--  This migration drops the broken function and recreates it with
--  the exact columns that the TypeScript code expects:
--    TodayOrder    (POSClient)
--    FeedItem      (OwnerClient)
--    RawOrder      (lib/today-stats.ts)
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor)
--  Safe to run multiple times.
-- ============================================================

-- Drop all signatures (covers both the original and the broken
-- version that may have added extra return columns).
DROP FUNCTION IF EXISTS get_today_orders();

CREATE OR REPLACE FUNCTION get_today_orders()
RETURNS TABLE (
  id              UUID,
  queue_number    INTEGER,
  status          TEXT,
  total_lak       NUMERIC,
  payment_method  TEXT,
  customer_name   TEXT,
  table_number    TEXT,
  receipt_number  TEXT,
  discount_amount NUMERIC,
  void_reason     TEXT,
  created_at_vt   TIMESTAMPTZ,
  items           JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
BEGIN
  RETURN QUERY
    SELECT
      o.id,
      o.queue_number,
      o.status,
      o.total_lak,
      o.payment_method,
      o.customer_name,
      o.table_number,
      o.receipt_number,
      COALESCE(o.discount_amount, 0),
      o.void_reason,
      o.created_at AT TIME ZONE 'Asia/Vientiane' AS created_at_vt,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', r.product_name,
            'qty',  oi.qty,
            'note', oi.customization
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::jsonb
      ) AS items
    FROM   orders o
    LEFT   JOIN order_items oi ON oi.order_id = o.id
    LEFT   JOIN recipes r      ON r.id = oi.recipe_id
    WHERE  (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE = v_today
    GROUP  BY o.id, o.queue_number, o.status, o.total_lak,
              o.payment_method, o.customer_name, o.table_number,
              o.receipt_number, o.discount_amount, o.void_reason, o.created_at
    ORDER  BY o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_today_orders() TO anon;
