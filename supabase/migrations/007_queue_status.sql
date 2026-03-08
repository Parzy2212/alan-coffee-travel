-- Alan Cafe OS v1.0 — Queue Status for TV Display
-- Migration: 007_queue_status.sql

-- ─── 1. Add queue_status column to orders ─────────────────────────────────────
--
-- Values:
--   NULL       → order placed, waiting
--   'making'   → barista picked up the order
--   'ready'    → order ready for pickup
--   'collected'→ customer has taken the order (archived from display)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS queue_status TEXT
  CHECK (queue_status IN ('making', 'ready', 'collected'));

-- ─── 2. Allow anon to read today's active queue (TV display has no auth) ───────

CREATE POLICY "anon: read active queue display" ON orders
  FOR SELECT TO anon
  USING (
    queue_status IN ('making', 'ready')
    AND (created_at AT TIME ZONE 'Asia/Vientiane')::DATE
          = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE
  );

-- ─── 3. Enable Realtime on orders (if not already in publication) ─────────────

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
