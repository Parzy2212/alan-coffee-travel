-- ============================================================
--  Alan Cafe OS -- Migration 041: lock down get_customers
--
--  get_customers(TEXT) (024, redefined in 032) is SECURITY DEFINER,
--  has no caller or shop check, and returns EVERY row of `customers`
--  across all shops (phone, email, birthday, notes, ...). 024 granted
--  EXECUTE to anon, and CREATE OR REPLACE in 032 kept that grant, so
--  anyone holding the public anon key can dump all customer PII with
--  one RPC call.
--
--  No app code calls get_customers (checked 2026-10-06: no .rpc() /
--  fetch reference in app/, components/, lib/), so restricting it to
--  service_role breaks nothing.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--  Safe to run multiple times.
-- ============================================================

-- 1) BEFORE: see who can execute it now (save this output)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name   = 'get_customers';

-- 2) Lock it down (atomic)
BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_customers(TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_customers(TEXT)
  TO service_role;

COMMIT;

-- 3) AFTER: expected result = only service_role (and the owner role, e.g. postgres)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name   = 'get_customers';

-- 4) Direct check per role -- anon and authenticated must be false
SELECT
  has_function_privilege('anon',          'public.get_customers(text)', 'EXECUTE') AS anon_can,
  has_function_privilege('authenticated', 'public.get_customers(text)', 'EXECUTE') AS authenticated_can,
  has_function_privilege('service_role',  'public.get_customers(text)', 'EXECUTE') AS service_role_can;
