-- Fix inventory CRUD RPCs
-- Migration: 028_fix_inventory_crud.sql
--
-- Problems fixed:
-- 1. delete_inventory_item (from 027) did hard DELETE which fails on FK
--    constraints from purchase_logs and recipe_ingredients.
--    Replaced with soft-delete: sets is_active = FALSE.
-- 2. Re-apply update_inventory_item + grants in case 017 was not run.

-- ─── 1. Soft-delete: set is_active = FALSE ────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_inventory_item(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inventory SET is_active = FALSE, updated_at = NOW() WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_inventory_item(UUID) TO anon;

-- ─── 2. Re-apply update_inventory_item (idempotent) ──────────────────────────

CREATE OR REPLACE FUNCTION update_inventory_item(
  p_id                       UUID,
  p_name                     TEXT    DEFAULT NULL,
  p_name_th                  TEXT    DEFAULT NULL,
  p_name_lo                  TEXT    DEFAULT NULL,
  p_unit                     TEXT    DEFAULT NULL,
  p_reorder_point            NUMERIC DEFAULT NULL,
  p_max_quantity             NUMERIC DEFAULT NULL,
  p_cost_per_unit            NUMERIC DEFAULT NULL,
  p_storage_location         TEXT    DEFAULT NULL,
  p_expiry_days              INTEGER DEFAULT NULL,
  p_supplier                 TEXT    DEFAULT NULL,
  p_supplier_phone           TEXT    DEFAULT NULL,
  p_secondary_supplier       TEXT    DEFAULT NULL,
  p_secondary_supplier_phone TEXT    DEFAULT NULL,
  p_notes                    TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inventory SET
    name                     = COALESCE(NULLIF(p_name, ''), name),
    name_th                  = CASE WHEN p_name_th  IS NULL THEN name_th  ELSE NULLIF(p_name_th,  '') END,
    name_lo                  = CASE WHEN p_name_lo  IS NULL THEN name_lo  ELSE NULLIF(p_name_lo,  '') END,
    unit                     = COALESCE(NULLIF(p_unit, ''), unit),
    reorder_point            = CASE WHEN p_reorder_point  IS NULL THEN reorder_point  ELSE NULLIF(p_reorder_point,  0) END,
    max_quantity             = CASE WHEN p_max_quantity   IS NULL THEN max_quantity   ELSE NULLIF(p_max_quantity,   0) END,
    cost_per_unit            = CASE WHEN p_cost_per_unit  IS NULL THEN cost_per_unit  ELSE NULLIF(p_cost_per_unit,  0) END,
    storage_location         = CASE WHEN p_storage_location IS NULL THEN storage_location ELSE NULLIF(p_storage_location, '') END,
    expiry_days              = CASE WHEN p_expiry_days    IS NULL THEN expiry_days    ELSE NULLIF(p_expiry_days,    0) END,
    supplier                 = CASE WHEN p_supplier               IS NULL THEN supplier               ELSE NULLIF(p_supplier,               '') END,
    supplier_phone           = CASE WHEN p_supplier_phone         IS NULL THEN supplier_phone         ELSE NULLIF(p_supplier_phone,         '') END,
    secondary_supplier       = CASE WHEN p_secondary_supplier     IS NULL THEN secondary_supplier     ELSE NULLIF(p_secondary_supplier,     '') END,
    secondary_supplier_phone = CASE WHEN p_secondary_supplier_phone IS NULL THEN secondary_supplier_phone ELSE NULLIF(p_secondary_supplier_phone, '') END,
    notes                    = CASE WHEN p_notes IS NULL THEN notes ELSE NULLIF(p_notes, '') END,
    updated_at               = NOW()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_inventory_item(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
