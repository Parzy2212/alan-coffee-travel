-- ============================================================
--  074 — a waste pressed again after a lost answer is saved once
--
--  stock_waste takes p_request_id (one per opened waste form, like stock_receive in 073). The
--  id is stored on the waste's stock_movements row (unique); a repeat returns the first waste
--  with duplicate = true and changes nothing. A POS still running pre-074 code calls without
--  the id and works as before.
--  Order on production: run 074, then push the page that sends the id (the new page calls
--  stock_waste with p_request_id, which does not exist before 074).
-- ============================================================

-- 0) stock_waste must still be the 073 version (md5 as docs/check-074-live-before.sql prints:
--    CR removed, blank lines at both ends dropped); a second run sees the 074 version and goes on
DO $chk$
DECLARE
  v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname = 'stock_waste' AND pronargs = 3;
  IF v_src IS NOT NULL
     AND md5(regexp_replace(regexp_replace(replace(v_src, E'\r', ''), '^([ ]*\n)+', ''), '(\n[ ]*)+$', '')) <> 'fa5257aa34200f93a8d80c7a0c72e27d' THEN
    RAISE EXCEPTION '074: stock_waste is not the 073 version, nothing changed';
  END IF;
  IF v_src IS NULL AND to_regprocedure('public.stock_waste(uuid, numeric, text, uuid)') IS NULL THEN
    RAISE EXCEPTION '074: stock_waste not found, nothing changed';
  END IF;
END
$chk$;

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_request_id_key ON public.stock_movements (request_id) WHERE request_id IS NOT NULL;

-- a 4th argument with a default next to the old 3-argument one would make calls ambiguous
DROP FUNCTION IF EXISTS public.stock_waste(uuid, numeric, text);
CREATE OR REPLACE FUNCTION public.stock_waste(p_inventory_id uuid, p_qty numeric, p_reason text, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_qty    numeric := round(p_qty, 3);
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_after  numeric;
  v_cost   numeric;
  v_prev_item uuid;
  v_prev_qty  numeric;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'QTY_INVALID: the amount thrown away must be more than 0' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;
  -- locked first, so a repeat sent while the first is still running waits and then sees it
  PERFORM 1 FROM public.inventory WHERE id = p_inventory_id AND COALESCE(is_active, true) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingredient not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT inventory_id, -qty_delta INTO v_prev_item, v_prev_qty FROM public.stock_movements WHERE request_id = p_request_id;
  IF FOUND THEN
    -- the same id for another item is a client bug, not a repeat: answering "already saved" would skip this waste
    IF v_prev_item IS DISTINCT FROM p_inventory_id THEN
      RAISE EXCEPTION 'REQUEST_ID_REUSED: this request id was used for another item' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('ok', true, 'qty_after', (SELECT current_qty FROM public.inventory WHERE id = p_inventory_id),
                              'duplicate', true, 'saved_qty', v_prev_qty);
  END IF;
  UPDATE public.inventory SET current_qty = current_qty - v_qty, updated_at = now()
  WHERE id = p_inventory_id
  RETURNING current_qty, cost_per_unit INTO v_after, v_cost;
  INSERT INTO public.stock_movements (inventory_id, kind, qty_delta, qty_after, unit_cost, reason, user_id, request_id)
  VALUES (p_inventory_id, 'waste', -v_qty, v_after, v_cost, v_reason, auth.uid(), p_request_id);
  RETURN jsonb_build_object('ok', true, 'qty_after', v_after);
END
$fn$;

REVOKE ALL ON FUNCTION public.stock_waste(uuid, numeric, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_waste(uuid, numeric, text, uuid) TO authenticated;
