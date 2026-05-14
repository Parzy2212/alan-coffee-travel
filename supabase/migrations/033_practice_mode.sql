-- ─── Practice Mode (Test Orders) ─────────────────────────────────────────────
-- Adds is_test flag to orders so test orders can be created/filtered separately.
-- migration 033

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_is_test ON orders (is_test) WHERE is_test = true;

GRANT SELECT, UPDATE ON orders TO anon;
