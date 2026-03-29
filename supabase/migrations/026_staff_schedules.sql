-- ─── Staff Schedules ─────────────────────────────────────────────────────────
-- Weekly shift scheduling for cafe staff
-- migration 026

CREATE TABLE IF NOT EXISTS staff_schedules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  shift      TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'evening')),
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (staff_id, date, shift)
);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_date  ON staff_schedules(date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff ON staff_schedules(staff_id);

ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_staff_schedules"
  ON staff_schedules FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_staff_schedules"
  ON staff_schedules FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_delete_staff_schedules"
  ON staff_schedules FOR DELETE TO anon USING (true);

GRANT SELECT, INSERT, DELETE ON staff_schedules TO anon;
