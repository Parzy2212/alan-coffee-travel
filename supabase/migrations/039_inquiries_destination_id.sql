-- ============================================================
--  AlanGuide -- Migration 039: inquiries.destination_id
--
--  The new destination-page inquiry modal (DestinationDetailClient)
--  needs to record which destination an inquiry was sent from,
--  alongside the existing guide_id/experience_id columns.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor)
--  Safe to run multiple times.
-- ============================================================

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS destination_id uuid REFERENCES destinations(id);

COMMENT ON COLUMN inquiries.destination_id IS
  'Set when a traveler contacts a guide directly from a destination page.';
