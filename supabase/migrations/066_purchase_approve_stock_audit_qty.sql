-- 066: approving a purchase and the stock count work again
--
-- Before: approve_purchase and start_stock_audit used inventory.current_stock, a column the
-- live table doesn't have (it is current_qty), so "approve" on a purchase and "start count"
-- on /staff failed every time (column does not exist). The stock count had two more
-- blockers: start inserts a row before anything is counted but stock_audit.counted_qty was
-- NOT NULL, and submit_stock_audit wrote to variance, which the table computes itself
-- (counted_qty - system_qty), so saving a count failed too. stock_audit was empty on the
-- prod copy of 2026-11-12: the count never worked. approve_purchase also had no check
-- that the purchase was still pending, so a second click would have added the stock twice,
-- and an unknown id did nothing without saying so.
-- After: both use current_qty. approve_purchase locks the purchase row, only acts on a
-- pending one (PURCHASE_NOT_PENDING otherwise) and says when the id is unknown.
-- counted_qty may be empty until the item is counted; submit_stock_audit saves the count and
-- the variance %, leaves variance to the table, and says when the id is unknown.
-- Same callers, same owner/manager check, same grants.
-- Test first: docs/test-066-purchase-approve-stock-audit-qty.sql

ALTER TABLE public.stock_audit ALTER COLUMN counted_qty DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.approve_purchase(p_purchase_id uuid, p_approve boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_pl public.purchase_logs;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  SELECT * INTO v_pl FROM public.purchase_logs WHERE id = p_purchase_id FOR UPDATE;
  IF v_pl.id IS NULL THEN
    RAISE EXCEPTION 'PURCHASE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_pl.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'PURCHASE_NOT_PENDING: already %', v_pl.status USING ERRCODE = '22023';
  END IF;
  UPDATE public.purchase_logs
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE id = p_purchase_id;
  IF p_approve THEN
    UPDATE public.inventory
    SET current_qty = COALESCE(current_qty, 0) + v_pl.qty_purchased, updated_at = now()
    WHERE id = v_pl.inventory_id;
  END IF;
END
$fn$;

CREATE OR REPLACE FUNCTION public.start_stock_audit(p_staff_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_results  jsonb := '[]';
  v_item     record;
  v_audit_id uuid;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  FOR v_item IN
    SELECT id, name, unit, current_qty FROM public.inventory ORDER BY random() LIMIT 3
  LOOP
    INSERT INTO public.stock_audit (inventory_id, staff_id, system_qty, audit_date)
    VALUES (v_item.id, p_staff_id, v_item.current_qty, CURRENT_DATE)
    RETURNING id INTO v_audit_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'audit_id',       v_audit_id,
      'inventory_id',   v_item.id,
      'inventory_name', v_item.name,
      'unit',           v_item.unit
    ));
  END LOOP;
  RETURN v_results;
END
$fn$;

CREATE OR REPLACE FUNCTION public.submit_stock_audit(p_audit_id uuid, p_counted_qty numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_row public.stock_audit;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  IF p_counted_qty IS NULL OR p_counted_qty < 0 THEN
    RAISE EXCEPTION 'COUNT_INVALID: counted quantity must be 0 or more' USING ERRCODE = '22023';
  END IF;
  UPDATE public.stock_audit
  SET counted_qty  = p_counted_qty,
      variance_pct = CASE WHEN system_qty <> 0 THEN round((p_counted_qty - system_qty) / system_qty * 100, 2) END
  WHERE id = p_audit_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'AUDIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN to_jsonb(v_row);
END
$fn$;
