-- ============================================================
--  Alan Cafe OS -- Migration 040: lock down reset_employee_pins
--
--  036 granted EXECUTE to `authenticated`, and Postgres/Supabase
--  default privileges may also have given it to PUBLIC/anon.
--  The function is SECURITY DEFINER with no caller check, so any
--  of those roles could reset every employee PIN in ANY shop by
--  calling the RPC directly, bypassing /api/pos/reset-pins.
--
--  After this, only service_role (used by /api/pos/reset-pins)
--  can execute it. The route needs no change.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--  Safe to run multiple times.
-- ============================================================

-- 1) BEFORE: see who can execute it now (save this output)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name   = 'reset_employee_pins';

-- 2) Lock it down (atomic)
BEGIN;

REVOKE EXECUTE ON FUNCTION public.reset_employee_pins(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reset_employee_pins(UUID, TEXT)
  TO service_role;

COMMIT;

-- 3) AFTER: expected result = only service_role (and the owner role, e.g. postgres)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name   = 'reset_employee_pins';

-- 4) Direct check per role -- anon and authenticated must be false
SELECT
  has_function_privilege('anon',          'public.reset_employee_pins(uuid, text)', 'EXECUTE') AS anon_can,
  has_function_privilege('authenticated', 'public.reset_employee_pins(uuid, text)', 'EXECUTE') AS authenticated_can,
  has_function_privilege('service_role',  'public.reset_employee_pins(uuid, text)', 'EXECUTE') AS service_role_can;
