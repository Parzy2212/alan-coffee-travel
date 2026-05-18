-- ============================================================
--  Alan Cafe OS -- Migration 036: PIN Recovery
--
--  Adds a service-role-callable function to reset employee PINs.
--  Used by /api/pos/reset-pins when the owner authenticates with
--  their Supabase email+password to recover access to the POS.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor)
--  Safe to run multiple times (OR REPLACE)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reset all active employee PINs for a shop to a new value.
-- SECURITY DEFINER so service_role (server API) can call it.
CREATE OR REPLACE FUNCTION reset_employee_pins(p_shop_id UUID, p_new_pin TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE employees
  SET    pin_hash   = crypt(p_new_pin, gen_salt('bf', 10)),
         updated_at = NOW()
  WHERE  shop_id  = p_shop_id
    AND  is_active = true;
$$;

GRANT EXECUTE ON FUNCTION reset_employee_pins(UUID, TEXT) TO service_role, authenticated;
