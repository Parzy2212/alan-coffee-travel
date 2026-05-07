-- ============================================================
--  Alan Cafe OS -- Phase 5: PIN-based POS Employees
--  Migration 005: employees, shifts, PIN functions
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor)
--  Safe to run multiple times (IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- pgcrypto required for crypt() / gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Employees ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID         NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL,
  photo_url    TEXT,
  pin_hash     TEXT         NOT NULL,
  role         TEXT         NOT NULL DEFAULT 'cashier'
                            CHECK (role IN ('manager', 'cashier')),
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  hourly_rate  DECIMAL(10,2),
  notes        TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (shop_id, pin_hash)
);

CREATE INDEX IF NOT EXISTS employees_shop_id_idx ON employees(shop_id);
CREATE INDEX IF NOT EXISTS employees_active_idx  ON employees(is_active);

-- ── Employee Shifts (clock-in / clock-out) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_shifts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID         NOT NULL REFERENCES shops(id)      ON DELETE CASCADE,
  employee_id  UUID         NOT NULL REFERENCES employees(id)  ON DELETE CASCADE,
  clocked_in   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  clocked_out  TIMESTAMPTZ,
  total_minutes INTEGER GENERATED ALWAYS AS (
    CASE WHEN clocked_out IS NOT NULL
    THEN EXTRACT(EPOCH FROM (clocked_out - clocked_in))::INTEGER / 60
    ELSE NULL END
  ) STORED
);

CREATE INDEX IF NOT EXISTS shifts_employee_idx      ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS shifts_shop_clockin_idx  ON employee_shifts(shop_id, clocked_in DESC);

-- ── Link orders to employees ───────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;

-- Authenticated shop members can manage their own employees
DROP POLICY IF EXISTS "employees_shop_member" ON employees;
CREATE POLICY "employees_shop_member" ON employees
  FOR ALL TO authenticated
  USING (shop_id IN (
    SELECT shop_id FROM shop_users WHERE user_id = auth.uid() AND active = true
  ))
  WITH CHECK (shop_id IN (
    SELECT shop_id FROM shop_users WHERE user_id = auth.uid() AND active = true
  ));

-- POS terminal (anon) needs SELECT to verify PINs
DROP POLICY IF EXISTS "employees_anon_read" ON employees;
CREATE POLICY "employees_anon_read" ON employees
  FOR SELECT TO anon USING (true);

-- Authenticated shop members manage their own shifts
DROP POLICY IF EXISTS "shifts_shop_member" ON employee_shifts;
CREATE POLICY "shifts_shop_member" ON employee_shifts
  FOR ALL TO authenticated
  USING (shop_id IN (
    SELECT shop_id FROM shop_users WHERE user_id = auth.uid() AND active = true
  ))
  WITH CHECK (shop_id IN (
    SELECT shop_id FROM shop_users WHERE user_id = auth.uid() AND active = true
  ));

-- POS terminal (anon) can clock in/out
DROP POLICY IF EXISTS "shifts_anon_all" ON employee_shifts;
CREATE POLICY "shifts_anon_all" ON employee_shifts
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Server-side PIN functions ──────────────────────────────────────────────

-- Called by dashboard (authenticated) when creating/updating employees
CREATE OR REPLACE FUNCTION hash_employee_pin(p_pin TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT crypt(p_pin, gen_salt('bf', 10));
$$;

-- Called by POS terminal (anon) to validate PIN at clock-in
CREATE OR REPLACE FUNCTION verify_employee_pin(p_shop_id UUID, p_pin TEXT)
RETURNS TABLE (
  id        UUID,
  name      TEXT,
  role      TEXT,
  photo_url TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.role, e.photo_url
  FROM   employees e
  WHERE  e.shop_id   = p_shop_id
    AND  e.is_active = true
    AND  e.pin_hash  = crypt(p_pin, e.pin_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_employee_pin(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION hash_employee_pin(TEXT)         TO authenticated;

-- ── Update trigger on employees ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _employees_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION _employees_set_updated_at();

-- ============================================================
--  DONE
--  Next: run /shop/team/employees to manage employees,
--  then clock in via PIN pad on the POS terminal.
-- ============================================================
