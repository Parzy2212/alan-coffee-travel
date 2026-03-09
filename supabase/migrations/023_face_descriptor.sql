-- Alan Cafe OS — Face Descriptor
-- Migration: 023_face_descriptor.sql

-- ─── 1. Add face_descriptor column to staff ───────────────────────────────────

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

-- ─── 2. Ensure anon has SELECT + UPDATE on staff ──────────────────────────────
-- (RLS "anon: write staff" policy already covers all DML, but explicit GRANT needed)

GRANT SELECT, UPDATE ON TABLE staff TO anon;
