-- Alan Cafe OS v1.0 — Fix RPC grants for anon role
-- Migration: 009_fix_grants.sql
--
-- By default Supabase does NOT grant EXECUTE on new functions to anon/authenticated.
-- The POS and queue display both use the anon key, so every RPC needs an explicit grant.

-- ─── Queue RPCs (migration 008) ───────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_today_pos_queue()              TO anon;
GRANT EXECUTE ON FUNCTION update_queue_status(UUID, TEXT)    TO anon;

-- ─── Order RPC (migration 006) ────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION create_order_with_deduction(JSONB, UUID, UUID, TEXT, TEXT, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_daily_queue_number()           TO anon;

-- ─── Helper RPCs (migration 003) ─────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION check_stock_for_cart(JSONB)        TO anon;

-- ─── Verify the orders RLS policy covers both pages ──────────────────────────
-- QueueClient queries orders directly (not via RPC), so anon needs SELECT access.
-- Migration 007 already created "anon: read active queue display" covering
-- queue_status IN ('making','ready') for today.
-- Add a separate policy so the TV page can read without the date filter failing
-- on timezone edge cases (belt-and-suspenders: the RPC already handles this).

-- Drop and recreate with a slightly wider window (±1 day) to avoid TZ edge cases
DROP POLICY IF EXISTS "anon: read active queue display" ON orders;

CREATE POLICY "anon: read active queue display" ON orders
  FOR SELECT TO anon
  USING (
    queue_status IN ('making', 'ready')
    AND created_at >= (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE::TIMESTAMPTZ - INTERVAL '1 hour'
    AND created_at <  (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE::TIMESTAMPTZ + INTERVAL '25 hours'
  );
