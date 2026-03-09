-- Alan Cafe OS — Staff Photo + Distance
-- Migration: 022_staff_photo.sql

-- ─── 1. Add distance_meters to attendance ─────────────────────────────────────

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS distance_meters NUMERIC;

-- ─── 2. Update clock_in RPC to accept distance_meters ─────────────────────────

DROP FUNCTION IF EXISTS clock_in(UUID, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION clock_in(
  p_staff_id        UUID,
  p_lat             NUMERIC DEFAULT NULL,
  p_lng             NUMERIC DEFAULT NULL,
  p_photo           TEXT    DEFAULT NULL,
  p_distance_meters NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today         DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  v_existing      TIMESTAMPTZ;
  v_sched         TIME;
  v_sched_ts      TIMESTAMPTZ;
  v_late_minutes  INTEGER := 0;
  v_status        TEXT    := 'present';
BEGIN
  -- Check already clocked in
  SELECT clock_in INTO v_existing
  FROM attendance
  WHERE staff_id = p_staff_id AND date = v_today;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already clocked in today');
  END IF;

  -- Compute late minutes
  SELECT scheduled_start_time INTO v_sched
  FROM staff WHERE id = p_staff_id;

  IF v_sched IS NOT NULL THEN
    v_sched_ts := (v_today::TEXT || 'T' || v_sched::TEXT)::TIMESTAMPTZ AT TIME ZONE 'Asia/Vientiane';
    v_late_minutes := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_sched_ts)) / 60)::INTEGER);
    IF v_late_minutes > 0 THEN v_status := 'late'; END IF;
  END IF;

  INSERT INTO attendance (
    staff_id, date, clock_in,
    clock_in_lat, clock_in_lng, clock_in_photo,
    scheduled_start, late_minutes, status, distance_meters
  ) VALUES (
    p_staff_id, v_today, NOW(),
    p_lat, p_lng, p_photo,
    v_sched, v_late_minutes, v_status, p_distance_meters
  )
  ON CONFLICT (staff_id, date) DO UPDATE
    SET clock_in       = NOW(),
        clock_in_lat   = p_lat,
        clock_in_lng   = p_lng,
        clock_in_photo = p_photo,
        late_minutes   = v_late_minutes,
        status         = v_status,
        distance_meters = p_distance_meters;

  RETURN jsonb_build_object(
    'success', true,
    'is_late', v_late_minutes > 0,
    'late_minutes', v_late_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION clock_in(UUID, NUMERIC, NUMERIC, TEXT, NUMERIC) TO anon;

-- ─── 3. Supabase Storage bucket: staff-photos ─────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-photos',
  'staff-photos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. RLS policies for staff-photos bucket ──────────────────────────────────

DROP POLICY IF EXISTS "anon: upload staff photos" ON storage.objects;
CREATE POLICY "anon: upload staff photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'staff-photos');

DROP POLICY IF EXISTS "anon: read staff photos" ON storage.objects;
CREATE POLICY "anon: read staff photos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'staff-photos');

DROP POLICY IF EXISTS "anon: update staff photos" ON storage.objects;
CREATE POLICY "anon: update staff photos"
  ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'staff-photos');

-- ─── 5. Add shop_lat / shop_lng to site_settings ──────────────────────────────

INSERT INTO site_settings (key, value) VALUES ('shop_lat', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('shop_lng', '') ON CONFLICT (key) DO NOTHING;
