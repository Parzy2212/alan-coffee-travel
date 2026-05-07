-- ============================================================
--  Alan Cafe OS -- Shop Settings Foundation
--  Migration 004: additional columns on shops for /shop/settings
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor)
--  Safe to run multiple times (IF NOT EXISTS throughout)
-- ============================================================

ALTER TABLE shops ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS timezone        TEXT DEFAULT 'Asia/Vientiane';

ALTER TABLE shops ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{
  "mon": {"open":"08:00","close":"18:00","closed":false},
  "tue": {"open":"08:00","close":"18:00","closed":false},
  "wed": {"open":"08:00","close":"18:00","closed":false},
  "thu": {"open":"08:00","close":"18:00","closed":false},
  "fri": {"open":"08:00","close":"18:00","closed":false},
  "sat": {"open":"08:00","close":"18:00","closed":false},
  "sun": {"open":"08:00","close":"18:00","closed":false}
}'::jsonb;

ALTER TABLE shops ADD COLUMN IF NOT EXISTS payment_methods JSONB
  DEFAULT '{"cash":true,"qr":false,"card":false,"transfer":false}'::jsonb;

-- ============================================================
--  DONE
--  After running: /shop/settings pages can read/write these
--  columns for shop identity, contact, hours, and payment.
-- ============================================================
