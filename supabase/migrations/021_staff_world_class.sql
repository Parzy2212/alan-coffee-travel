-- Alan Cafe OS — Staff World Class
-- Migration: 021_staff_world_class.sql

-- ─── 1. Add columns to staff ──────────────────────────────────────────────────

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS name_lo               TEXT,
  ADD COLUMN IF NOT EXISTS name_th               TEXT,
  ADD COLUMN IF NOT EXISTS pin_code              TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url            TEXT,
  ADD COLUMN IF NOT EXISTS address               TEXT,
  ADD COLUMN IF NOT EXISTS address_th            TEXT,
  ADD COLUMN IF NOT EXISTS address_lo            TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone       TEXT,
  ADD COLUMN IF NOT EXISTS salary                NUMERIC,
  ADD COLUMN IF NOT EXISTS salary_type           TEXT CHECK (salary_type IN ('daily','monthly','hourly')),
  ADD COLUMN IF NOT EXISTS start_date            DATE,
  ADD COLUMN IF NOT EXISTS id_card_number        TEXT,
  ADD COLUMN IF NOT EXISTS skills                TEXT[],
  ADD COLUMN IF NOT EXISTS notes                 TEXT,
  ADD COLUMN IF NOT EXISTS rating                NUMERIC DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS scheduled_start_time  TIME DEFAULT '08:00';

-- RLS: allow anon to read active staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon: read active staff" ON staff;
CREATE POLICY "anon: read active staff" ON staff FOR SELECT TO anon USING (is_active = TRUE);
-- Also allow anon to update (via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "anon: write staff" ON staff;
CREATE POLICY "anon: write staff" ON staff FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── 2. Recreate attendance table ────────────────────────────────────────────

DROP TABLE IF EXISTS attendance CASCADE;

CREATE TABLE attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE,
  clock_in        TIMESTAMPTZ,
  clock_out       TIMESTAMPTZ,
  clock_in_lat    NUMERIC,
  clock_in_lng    NUMERIC,
  clock_in_photo  TEXT,
  clock_out_photo TEXT,
  scheduled_start TIME DEFAULT '08:00',
  late_minutes    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'absent' CHECK (status IN ('present','late','absent','leave','holiday')),
  leave_type      TEXT CHECK (leave_type IN ('sick','personal','vacation')),
  note            TEXT,
  approved_by     UUID REFERENCES staff(id),
  UNIQUE (staff_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon: all attendance" ON attendance FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── 3. clock_in ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS clock_in(UUID, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION clock_in(
  p_staff_id  UUID,
  p_lat       NUMERIC DEFAULT NULL,
  p_lng       NUMERIC DEFAULT NULL,
  p_photo_url TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today    DATE        := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  v_now      TIMESTAMPTZ := NOW();
  v_sched    TIME;
  v_sched_ts TIMESTAMPTZ;
  v_late_min INTEGER     := 0;
  v_status   TEXT;
  v_existing attendance%ROWTYPE;
BEGIN
  SELECT * INTO v_existing FROM attendance
  WHERE staff_id = p_staff_id AND date = v_today;

  IF FOUND AND v_existing.clock_in IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_clocked_in', TRUE,
      'clock_in',           v_existing.clock_in,
      'late_minutes',       v_existing.late_minutes,
      'status',             v_existing.status
    );
  END IF;

  SELECT COALESCE(scheduled_start_time, '08:00'::TIME)
  INTO   v_sched FROM staff WHERE id = p_staff_id;

  v_sched_ts := (v_today::TEXT || ' ' || v_sched::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Vientiane';
  v_late_min := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_sched_ts)) / 60)::INTEGER);
  v_status   := CASE WHEN v_late_min > 0 THEN 'late' ELSE 'present' END;

  INSERT INTO attendance
    (staff_id, date, clock_in, clock_in_lat, clock_in_lng, clock_in_photo,
     scheduled_start, late_minutes, status)
  VALUES
    (p_staff_id, v_today, v_now, p_lat, p_lng, p_photo_url,
     v_sched, v_late_min, v_status)
  ON CONFLICT (staff_id, date) DO UPDATE SET
    clock_in       = v_now,
    clock_in_lat   = p_lat,
    clock_in_lng   = p_lng,
    clock_in_photo = p_photo_url,
    late_minutes   = v_late_min,
    status         = v_status;

  RETURN jsonb_build_object(
    'already_clocked_in', FALSE,
    'clock_in',           v_now,
    'late_minutes',       v_late_min,
    'status',             v_status,
    'date',               v_today
  );
END;
$$;

-- ─── 4. clock_out ────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS clock_out(UUID, TEXT);

CREATE OR REPLACE FUNCTION clock_out(
  p_staff_id  UUID,
  p_photo_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE        := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  v_now   TIMESTAMPTZ := NOW();
  v_att   attendance%ROWTYPE;
  v_hours NUMERIC;
BEGIN
  SELECT * INTO v_att FROM attendance
  WHERE staff_id = p_staff_id AND date = v_today;

  IF NOT FOUND OR v_att.clock_in IS NULL THEN
    RETURN jsonb_build_object('error', 'not_clocked_in');
  END IF;

  IF v_att.clock_out IS NOT NULL THEN
    v_hours := ROUND(EXTRACT(EPOCH FROM (v_att.clock_out - v_att.clock_in)) / 3600.0, 2);
    RETURN jsonb_build_object('already_clocked_out', TRUE, 'clock_out', v_att.clock_out, 'hours_worked', v_hours);
  END IF;

  UPDATE attendance SET
    clock_out       = v_now,
    clock_out_photo = p_photo_url
  WHERE staff_id = p_staff_id AND date = v_today;

  v_hours := ROUND(EXTRACT(EPOCH FROM (v_now - v_att.clock_in)) / 3600.0, 2);
  RETURN jsonb_build_object('clock_out', v_now, 'hours_worked', v_hours);
END;
$$;

-- ─── 5. get_staff_today_status ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_staff_today_status();

CREATE OR REPLACE FUNCTION get_staff_today_status()
RETURNS TABLE (
  id             UUID,
  name           TEXT,
  name_th        TEXT,
  name_lo        TEXT,
  role           TEXT,
  photo_url      TEXT,
  clock_in       TIMESTAMPTZ,
  clock_out      TIMESTAMPTZ,
  today_status   TEXT,
  late_minutes   INTEGER,
  hours_worked   NUMERIC,
  clock_in_lat   NUMERIC,
  clock_in_lng   NUMERIC,
  clock_in_photo TEXT
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
      s.id,
      s.name,
      s.name_th,
      s.name_lo,
      s.role,
      COALESCE(s.avatar_url, s.photo_url)  AS photo_url,
      a.clock_in,
      a.clock_out,
      COALESCE(a.status, 'absent')::TEXT   AS today_status,
      COALESCE(a.late_minutes, 0),
      CASE
        WHEN a.clock_in IS NOT NULL AND a.clock_out IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (a.clock_out - a.clock_in)) / 3600.0, 2)
        ELSE NULL
      END                                  AS hours_worked,
      a.clock_in_lat,
      a.clock_in_lng,
      a.clock_in_photo
    FROM staff s
    LEFT JOIN attendance a ON a.staff_id = s.id AND a.date = v_today
    WHERE s.is_active = TRUE
    ORDER BY
      CASE COALESCE(a.status, 'absent')
        WHEN 'present' THEN 1
        WHEN 'late'    THEN 2
        WHEN 'leave'   THEN 3
        WHEN 'absent'  THEN 4
        ELSE 5
      END,
      s.name;
END;
$$;

-- ─── 6. get_staff_performance ────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_staff_performance(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_staff_performance(
  p_staff_id UUID,
  p_days     INTEGER DEFAULT 30
)
RETURNS TABLE (
  days_checked    INTEGER,
  days_present    INTEGER,
  days_on_time    INTEGER,
  days_late       INTEGER,
  total_hours     NUMERIC,
  punctuality_pct NUMERIC,
  avg_late_min    NUMERIC,
  total_orders    INTEGER,
  total_sales     NUMERIC,
  orders_per_hour NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - p_days + 1;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
BEGIN
  RETURN QUERY
    WITH att AS (
      SELECT
        COUNT(*)  FILTER (WHERE status IN ('present','late'))::INTEGER AS days_present,
        COUNT(*)  FILTER (WHERE status = 'present')::INTEGER           AS days_on_time,
        COUNT(*)  FILTER (WHERE status = 'late')::INTEGER              AS days_late,
        COALESCE(SUM(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0)
          FILTER (WHERE clock_out IS NOT NULL), 0)::NUMERIC            AS total_hours,
        COALESCE(AVG(late_minutes) FILTER (WHERE status = 'late'), 0)::NUMERIC AS avg_late_min
      FROM attendance
      WHERE staff_id = p_staff_id AND date BETWEEN v_since AND v_today
    ),
    sales AS (
      SELECT
        COUNT(DISTINCT o.id)::INTEGER          AS total_orders,
        COALESCE(SUM(o.total_lak), 0)::NUMERIC AS total_sales
      FROM orders o
      WHERE o.staff_id = p_staff_id AND o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE BETWEEN v_since AND v_today
    )
    SELECT
      p_days,
      att.days_present,
      att.days_on_time,
      att.days_late,
      ROUND(att.total_hours, 2),
      ROUND(CASE WHEN att.days_present > 0
                 THEN att.days_on_time::NUMERIC / att.days_present * 100 ELSE 100 END, 1),
      ROUND(att.avg_late_min, 1),
      sales.total_orders,
      ROUND(sales.total_sales, 0),
      ROUND(CASE WHEN att.total_hours > 0
                 THEN sales.total_orders::NUMERIC / att.total_hours ELSE 0 END, 2)
    FROM att, sales;
END;
$$;

-- ─── 7. get_attendance_report ─────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_attendance_report(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_attendance_report(
  p_month INTEGER DEFAULT NULL,
  p_year  INTEGER DEFAULT NULL
)
RETURNS TABLE (
  staff_id     UUID,
  name         TEXT,
  report_date  DATE,
  status       TEXT,
  clock_in     TIMESTAMPTZ,
  clock_out    TIMESTAMPTZ,
  late_minutes INTEGER,
  hours_worked NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month INTEGER := COALESCE(p_month, EXTRACT(MONTH FROM NOW() AT TIME ZONE 'Asia/Vientiane')::INTEGER);
  v_year  INTEGER := COALESCE(p_year,  EXTRACT(YEAR  FROM NOW() AT TIME ZONE 'Asia/Vientiane')::INTEGER);
  v_start DATE    := make_date(v_year, v_month, 1);
  v_end   DATE    := (make_date(v_year, v_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
  RETURN QUERY
    SELECT
      s.id                                AS staff_id,
      s.name,
      gs_date::DATE                       AS report_date,
      COALESCE(a.status, 'absent')::TEXT  AS status,
      a.clock_in,
      a.clock_out,
      COALESCE(a.late_minutes, 0)         AS late_minutes,
      CASE
        WHEN a.clock_in IS NOT NULL AND a.clock_out IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (a.clock_out - a.clock_in)) / 3600.0, 2)
        ELSE NULL
      END                                 AS hours_worked
    FROM staff s
    CROSS JOIN generate_series(v_start, v_end, '1 day'::INTERVAL) AS gs_date
    LEFT JOIN attendance a ON a.staff_id = s.id AND a.date = gs_date::DATE
    WHERE s.is_active = TRUE
    ORDER BY gs_date, s.name;
END;
$$;

-- ─── 8. get_staff_analytics ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_staff_analytics();

CREATE OR REPLACE FUNCTION get_staff_analytics()
RETURNS TABLE (
  staff_id        UUID,
  name            TEXT,
  role            TEXT,
  photo_url       TEXT,
  rating          NUMERIC,
  days_present    INTEGER,
  punctuality_pct NUMERIC,
  total_hours     NUMERIC,
  total_orders    INTEGER,
  total_sales     NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - 29;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
BEGIN
  RETURN QUERY
    WITH att AS (
      SELECT
        a.staff_id,
        COUNT(*)  FILTER (WHERE a.status IN ('present','late'))::INTEGER AS days_present,
        COUNT(*)  FILTER (WHERE a.status = 'present')::INTEGER           AS days_on_time,
        ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (a.clock_out - a.clock_in)) / 3600.0)
          FILTER (WHERE a.clock_out IS NOT NULL), 0)::NUMERIC, 2)        AS total_hours
      FROM attendance a
      WHERE a.date BETWEEN v_since AND v_today
      GROUP BY a.staff_id
    ),
    sales AS (
      SELECT
        o.staff_id,
        COUNT(DISTINCT o.id)::INTEGER              AS total_orders,
        ROUND(COALESCE(SUM(o.total_lak), 0)::NUMERIC, 0) AS total_sales
      FROM orders o
      WHERE o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'Asia/Vientiane')::DATE BETWEEN v_since AND v_today
      GROUP BY o.staff_id
    )
    SELECT
      s.id,
      s.name,
      s.role,
      COALESCE(s.avatar_url, s.photo_url)  AS photo_url,
      COALESCE(s.rating, 5.0),
      COALESCE(att.days_present, 0),
      ROUND(CASE WHEN COALESCE(att.days_present, 0) > 0
                 THEN att.days_on_time::NUMERIC / att.days_present * 100 ELSE 100 END, 1),
      COALESCE(att.total_hours, 0),
      COALESCE(sales.total_orders, 0),
      COALESCE(sales.total_sales,  0)
    FROM staff s
    LEFT JOIN att   ON att.staff_id   = s.id
    LEFT JOIN sales ON sales.staff_id = s.id
    WHERE s.is_active = TRUE
    ORDER BY COALESCE(att.days_present, 0) DESC, s.name;
END;
$$;

-- ─── 9. get_all_staff ────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_all_staff();

CREATE OR REPLACE FUNCTION get_all_staff()
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  name_th           TEXT,
  name_lo           TEXT,
  role              TEXT,
  phone             TEXT,
  photo_url         TEXT,
  is_active         BOOLEAN,
  salary            NUMERIC,
  salary_type       TEXT,
  hourly_rate_lak   NUMERIC,
  start_date        DATE,
  skills            TEXT[],
  notes             TEXT,
  rating            NUMERIC,
  emergency_contact TEXT,
  emergency_phone   TEXT,
  address           TEXT,
  id_card_number    TEXT,
  created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      s.id, s.name, s.name_th, s.name_lo, s.role, s.phone,
      COALESCE(s.avatar_url, s.photo_url), s.is_active,
      s.salary, s.salary_type, s.hourly_rate_lak,
      s.start_date, s.skills, s.notes, COALESCE(s.rating, 5.0),
      s.emergency_contact, s.emergency_phone, s.address,
      s.id_card_number, s.created_at
    FROM staff s
    ORDER BY s.is_active DESC, s.name;
END;
$$;

-- ─── 10. create_staff ────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS create_staff(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT[], TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_staff(
  p_name              TEXT,
  p_name_th           TEXT    DEFAULT NULL,
  p_name_lo           TEXT    DEFAULT NULL,
  p_role              TEXT    DEFAULT NULL,
  p_phone             TEXT    DEFAULT NULL,
  p_pin_code          TEXT    DEFAULT NULL,
  p_photo_url         TEXT    DEFAULT NULL,
  p_salary            NUMERIC DEFAULT NULL,
  p_salary_type       TEXT    DEFAULT 'monthly',
  p_start_date        DATE    DEFAULT NULL,
  p_skills            TEXT[]  DEFAULT NULL,
  p_notes             TEXT    DEFAULT NULL,
  p_emergency_contact TEXT    DEFAULT NULL,
  p_emergency_phone   TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO staff (
    name, name_th, name_lo, role, phone, pin_code, photo_url,
    salary, salary_type, start_date, skills, notes,
    emergency_contact, emergency_phone, is_active, rating
  ) VALUES (
    p_name,
    NULLIF(p_name_th, ''),           NULLIF(p_name_lo, ''),
    NULLIF(p_role, ''),              NULLIF(p_phone, ''),
    NULLIF(p_pin_code, ''),          NULLIF(p_photo_url, ''),
    p_salary,
    COALESCE(NULLIF(p_salary_type, ''), 'monthly'),
    p_start_date,
    CASE WHEN p_skills = '{}' OR p_skills IS NULL THEN NULL ELSE p_skills END,
    NULLIF(p_notes, ''),
    NULLIF(p_emergency_contact, ''), NULLIF(p_emergency_phone, ''),
    TRUE, 5.0
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─── 11. update_staff ────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS update_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT[], TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION update_staff(
  p_id                UUID,
  p_name              TEXT    DEFAULT NULL,
  p_name_th           TEXT    DEFAULT NULL,
  p_name_lo           TEXT    DEFAULT NULL,
  p_role              TEXT    DEFAULT NULL,
  p_phone             TEXT    DEFAULT NULL,
  p_pin_code          TEXT    DEFAULT NULL,
  p_photo_url         TEXT    DEFAULT NULL,
  p_salary            NUMERIC DEFAULT NULL,
  p_salary_type       TEXT    DEFAULT NULL,
  p_start_date        DATE    DEFAULT NULL,
  p_skills            TEXT[]  DEFAULT NULL,
  p_notes             TEXT    DEFAULT NULL,
  p_emergency_contact TEXT    DEFAULT NULL,
  p_emergency_phone   TEXT    DEFAULT NULL,
  p_rating            NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE staff SET
    name              = COALESCE(NULLIF(p_name, ''), name),
    name_th           = CASE WHEN p_name_th           IS NULL THEN name_th           ELSE NULLIF(p_name_th,           '') END,
    name_lo           = CASE WHEN p_name_lo           IS NULL THEN name_lo           ELSE NULLIF(p_name_lo,           '') END,
    role              = CASE WHEN p_role              IS NULL THEN role              ELSE NULLIF(p_role,              '') END,
    phone             = CASE WHEN p_phone             IS NULL THEN phone             ELSE NULLIF(p_phone,             '') END,
    pin_code          = CASE WHEN p_pin_code          IS NULL THEN pin_code          ELSE NULLIF(p_pin_code,          '') END,
    photo_url         = CASE WHEN p_photo_url         IS NULL THEN photo_url         ELSE NULLIF(p_photo_url,         '') END,
    salary            = COALESCE(p_salary,      salary),
    salary_type       = CASE WHEN p_salary_type       IS NULL THEN salary_type       ELSE NULLIF(p_salary_type,       '') END,
    start_date        = COALESCE(p_start_date,  start_date),
    skills            = CASE WHEN p_skills            IS NULL THEN skills            ELSE p_skills END,
    notes             = CASE WHEN p_notes             IS NULL THEN notes             ELSE NULLIF(p_notes,             '') END,
    emergency_contact = CASE WHEN p_emergency_contact IS NULL THEN emergency_contact ELSE NULLIF(p_emergency_contact, '') END,
    emergency_phone   = CASE WHEN p_emergency_phone   IS NULL THEN emergency_phone   ELSE NULLIF(p_emergency_phone,   '') END,
    rating            = COALESCE(p_rating, rating)
  WHERE id = p_id;
END;
$$;

-- ─── 12. toggle_staff_active ─────────────────────────────────────────────────

DROP FUNCTION IF EXISTS toggle_staff_active(UUID);

CREATE OR REPLACE FUNCTION toggle_staff_active(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new BOOLEAN;
BEGIN
  UPDATE staff SET is_active = NOT is_active WHERE id = p_id RETURNING is_active INTO v_new;
  RETURN v_new;
END;
$$;

-- ─── 13. verify_staff_pin ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS verify_staff_pin(UUID, TEXT);

CREATE OR REPLACE FUNCTION verify_staff_pin(p_staff_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff
    WHERE id = p_staff_id AND pin_code = p_pin AND is_active = TRUE
  );
END;
$$;

-- ─── 14. GRANT TO anon ───────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION clock_in(UUID, NUMERIC, NUMERIC, TEXT)                                                                                         TO anon;
GRANT EXECUTE ON FUNCTION clock_out(UUID, TEXT)                                                                                                           TO anon;
GRANT EXECUTE ON FUNCTION get_staff_today_status()                                                                                                        TO anon;
GRANT EXECUTE ON FUNCTION get_staff_performance(UUID, INTEGER)                                                                                            TO anon;
GRANT EXECUTE ON FUNCTION get_attendance_report(INTEGER, INTEGER)                                                                                         TO anon;
GRANT EXECUTE ON FUNCTION get_staff_analytics()                                                                                                           TO anon;
GRANT EXECUTE ON FUNCTION get_all_staff()                                                                                                                 TO anon;
GRANT EXECUTE ON FUNCTION create_staff(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT[], TEXT, TEXT, TEXT)                           TO anon;
GRANT EXECUTE ON FUNCTION update_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT[], TEXT, TEXT, TEXT, NUMERIC)            TO anon;
GRANT EXECUTE ON FUNCTION toggle_staff_active(UUID)                                                                                                       TO anon;
GRANT EXECUTE ON FUNCTION verify_staff_pin(UUID, TEXT)                                                                                                    TO anon;
