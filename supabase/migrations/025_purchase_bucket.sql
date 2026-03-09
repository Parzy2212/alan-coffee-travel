-- Alan Cafe OS — Purchase Receipts Storage Bucket
-- Migration: 025_purchase_bucket.sql

-- ─── 1. Create bucket ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-receipts',
  'purchase-receipts',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. RLS policies ──────────────────────────────────────────────────────────

-- Allow anon to upload
CREATE POLICY "anon can upload purchase receipts"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'purchase-receipts');

-- Allow anon to read
CREATE POLICY "anon can read purchase receipts"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'purchase-receipts');

-- Allow anon to update (for upsert)
CREATE POLICY "anon can update purchase receipts"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'purchase-receipts');
