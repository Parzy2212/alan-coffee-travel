-- ============================================================
--  Test for migration 074 (a waste pressed again after a lost answer is saved once)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("074 TEST RESULTS ..."), so everything rolls back, including the test ingredient.
--  Every line should start with PASS. Run as postgres, copy the error text back.
--  Section "body of 074" is a copy of supabase/migrations/074_stock_waste_request_id.sql
--  (this file is built from docs/test-074.template.sql by scripts/build-migration-test.sh).
-- ============================================================
DO $test$
DECLARE
  c_shop  constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_owner uuid;
  report  text := '';
  v_body  text;
  i_milk  uuid;
  i_cup   uuid;
  v_req   uuid := gen_random_uuid();
  v_res   jsonb;
  v_n     int;
BEGIN
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active ORDER BY id LIMIT 1;
  IF c_owner IS NULL THEN RAISE EXCEPTION '074 TEST: the shop has no active owner'; END IF;

  -- ---- body of 074 ----
  v_body := $body$
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
$body$;
  EXECUTE v_body;

  CREATE FUNCTION pg_temp.t_qty(p uuid) RETURNS numeric LANGUAGE sql AS $f$ SELECT current_qty FROM public.inventory WHERE id = p $f$;
  CREATE FUNCTION pg_temp.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $f$
    SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
           set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $f$;

  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__074 milk', 'ml', 1000, 20, c_shop) RETURNING id INTO i_milk;

  -- T1 privileges: one stock_waste only (the old 3-argument one is gone), anon cannot run it
  report := report || CASE WHEN (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'stock_waste') = 1
      AND to_regprocedure('public.stock_waste(uuid, numeric, text)') IS NULL
      AND NOT has_function_privilege('anon', 'public.stock_waste(uuid, numeric, text, uuid)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.stock_waste(uuid, numeric, text, uuid)', 'EXECUTE')
    THEN E'\nPASS T1 one stock_waste (4 arguments), anon cannot run it, signed-in can'
    ELSE E'\nFAIL T1 privileges / versions' END;

  -- T2 a signed-in non-member is refused
  PERFORM pg_temp.t_as(gen_random_uuid());
  v_n := 0;
  BEGIN PERFORM public.stock_waste(i_milk, 1, 'x', gen_random_uuid()); EXCEPTION WHEN insufficient_privilege THEN v_n := 1; END;
  report := report || CASE WHEN v_n = 1 AND pg_temp.t_qty(i_milk) = 1000 THEN E'\nPASS T2 non-member refused, stock unchanged' ELSE E'\nFAIL T2 non-member' END;

  PERFORM pg_temp.t_as(c_owner);

  -- T3 waste 200 ml with an id: stock -200, one movement carrying the id
  v_res := public.stock_waste(i_milk, 200, 'บูด', v_req);
  report := report || CASE WHEN pg_temp.t_qty(i_milk) = 800 AND (v_res->>'qty_after')::numeric = 800 AND v_res->>'duplicate' IS NULL
      AND (SELECT count(*) FROM public.stock_movements WHERE request_id = v_req AND kind = 'waste' AND qty_delta = -200 AND reason = 'บูด') = 1
    THEN E'\nPASS T3 waste 200 ml: stock 800, one movement with the request id'
    ELSE E'\nFAIL T3 ' || v_res::text END;

  -- T4 the same id again (answer lost, pressed again): nothing changes, the first waste comes back
  v_res := public.stock_waste(i_milk, 200, 'บูด', v_req);
  report := report || CASE WHEN (v_res->>'duplicate')::boolean AND (v_res->>'saved_qty')::numeric = 200 AND pg_temp.t_qty(i_milk) = 800
      AND (SELECT count(*) FROM public.stock_movements WHERE inventory_id = i_milk) = 1
    THEN E'\nPASS T4 same id again: duplicate, stock still 800, still one movement'
    ELSE E'\nFAIL T4 ' || v_res::text END;

  -- T5 the same id with a changed amount: the first waste is kept and reported back
  v_res := public.stock_waste(i_milk, 350, 'หก', v_req);
  report := report || CASE WHEN (v_res->>'duplicate')::boolean AND (v_res->>'saved_qty')::numeric = 200 AND pg_temp.t_qty(i_milk) = 800
    THEN E'\nPASS T5 same id, amount changed to 350: first waste (200) kept and returned'
    ELSE E'\nFAIL T5 ' || v_res::text END;

  -- T6 a POS on pre-074 code (3 named arguments, no id): each press is a waste, as before
  PERFORM public.stock_waste(p_inventory_id => i_milk, p_qty => 50, p_reason => 'หก');
  PERFORM public.stock_waste(p_inventory_id => i_milk, p_qty => 50, p_reason => 'หก');
  report := report || CASE WHEN pg_temp.t_qty(i_milk) = 700
      AND (SELECT count(*) FROM public.stock_movements WHERE inventory_id = i_milk AND request_id IS NULL) = 2
    THEN E'\nPASS T6 old call without an id still works (2 presses = 2 wastes, stock 700)'
    ELSE E'\nFAIL T6 stock ' || pg_temp.t_qty(i_milk) END;

  -- T7 refusals unchanged: no reason / amount 0 / unknown item; a refused call does not use up the id
  v_n := 0;
  BEGIN PERFORM public.stock_waste(i_milk, 10, '  ', gen_random_uuid()); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'REASON_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_waste(i_milk, 0, 'x', gen_random_uuid()); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'QTY_INVALID%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_waste(gen_random_uuid(), 1, 'x', gen_random_uuid()); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = 'P0002' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_n = 3 AND pg_temp.t_qty(i_milk) = 700
    THEN E'\nPASS T7 no reason / amount 0 / unknown item refused, stock unchanged'
    ELSE E'\nFAIL T7 only ' || v_n || ' of 3 refused' END;

  -- T8 the id is unique in the table itself, so a second row with it cannot be written by any path
  v_n := 0;
  BEGIN
    INSERT INTO public.stock_movements (inventory_id, kind, qty_delta, qty_after, request_id) VALUES (i_milk, 'waste', -1, 699, v_req);
  EXCEPTION WHEN unique_violation THEN v_n := 1;
  END;
  report := report || CASE WHEN v_n = 1 THEN E'\nPASS T8 a second row with the same request id is refused by the table' ELSE E'\nFAIL T8 duplicate id accepted' END;

  -- T8b the same id sent for another item is refused, not answered as "already saved"
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__074 cup', 'pcs', 50, 1000, c_shop) RETURNING id INTO i_cup;
  v_n := 0;
  BEGIN PERFORM public.stock_waste(i_cup, 1, 'x', v_req); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'REQUEST_ID_REUSED%' THEN v_n := 1; END IF; END;
  report := report || CASE WHEN v_n = 1 AND pg_temp.t_qty(i_cup) = 50 AND pg_temp.t_qty(i_milk) = 700
    THEN E'\nPASS T8b same id for another item refused, both stocks unchanged' ELSE E'\nFAIL T8b reused id' END;

  -- T9 running the migration again: no error, nothing changes
  PERFORM pg_temp.t_as(NULL);
  SELECT count(*) INTO v_n FROM public.stock_movements;
  BEGIN
    EXECUTE v_body;
    report := report || CASE WHEN (SELECT count(*) FROM public.stock_movements) = v_n
        AND (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'stock_waste') = 1
      THEN E'\nPASS T9 second run changes nothing' ELSE E'\nFAIL T9 second run changed something' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T9 second run: ' || SQLERRM;
  END;

  -- T10 the gate: a 3-argument stock_waste that is not the 073 version stops the migration before any change
  DROP FUNCTION public.stock_waste(uuid, numeric, text, uuid);
  ALTER TABLE public.stock_movements DROP COLUMN request_id;
  CREATE FUNCTION public.stock_waste(p_inventory_id uuid, p_qty numeric, p_reason text) RETURNS jsonb LANGUAGE sql AS $f$ SELECT '{}'::jsonb $f$;
  v_n := 0;
  BEGIN EXECUTE v_body; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '074: stock_waste is not the 073 version%' THEN v_n := 1; END IF; END;
  report := report || CASE WHEN v_n = 1 AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'request_id')
    THEN E'\nPASS T10 a changed stock_waste stops the migration, nothing added' ELSE E'\nFAIL T10 gate did not refuse a changed function' END;

  -- T11 the gate: no stock_waste at all stops it too
  DROP FUNCTION public.stock_waste(uuid, numeric, text);
  v_n := 0;
  BEGIN EXECUTE v_body; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '074: stock_waste not found%' THEN v_n := 1; END IF; END;
  report := report || CASE WHEN v_n = 1 THEN E'\nPASS T11 missing stock_waste stops the migration' ELSE E'\nFAIL T11 gate did not refuse a missing function' END;

  RAISE EXCEPTION '074 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
