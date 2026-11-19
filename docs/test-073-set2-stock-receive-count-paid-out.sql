-- ============================================================
--  Test for migration 073 (stock receive / waste / count, movement log, paid-out = one expense)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("073 TEST RESULTS ..."), so everything rolls back, including the test
--  ingredients, menu items, employees, drawer session and bills. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres, copy the error text back.
--  Section "body of 073" is a copy of supabase/migrations/073_set2_stock_receive_count_paid_out.sql
--  (this file is built from docs/test-073.template.sql by scripts/build-migration-test.sh).
-- ============================================================
DO $test$
DECLARE
  c_shop     constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_cash_pin constant text := '7391';
  c_mgr_pin  constant text := '8264';
  c_owner    uuid;
  report text := '';
  v_body text;
  v_cashier uuid; v_mgr uuid; v_session uuid;
  i_coffee uuid; i_milk uuid; i_cup uuid;
  v_menu uuid; v_menu_def uuid; v_iced_menu uuid; v_hot uuid; v_iced uuid;
  v_pending int;
  m0 jsonb; m1 jsonb;
  v_res jsonb; v_order uuid; v_mov uuid; v_pur uuid; v_n int; v_x numeric; v_y numeric;
BEGIN
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active ORDER BY id LIMIT 1;
  IF c_owner IS NULL THEN RAISE EXCEPTION '073 TEST: the shop has no active owner'; END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE shop_id = c_shop AND is_active
             AND (pin_hash = extensions.crypt(c_cash_pin, pin_hash) OR pin_hash = extensions.crypt(c_mgr_pin, pin_hash))) THEN
    RAISE EXCEPTION '073 TEST: a real employee uses PIN % or % -- change them at the top and run again', c_cash_pin, c_mgr_pin;
  END IF;
  ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;
  SELECT count(*) INTO v_pending FROM public.purchase_logs WHERE status = 'pending';

  -- ---- body of 073 ----
  v_body := $body$
-- ============================================================
--  073 — set 2 step 2: stock in / waste / count with a movement log, and drawer paid-outs
--  counted as an expense exactly once
--
--  * stock_movements: every change of an ingredient's stock (sale, void return, receive, waste,
--    count, opening count) with the amount after it. Owner reads it.
--  * checkout_order logs what it cut ('sale'); void_order_with_approval gives back exactly
--    that, so a recipe changed between the sale and the void no longer gives back the wrong
--    amount. Bills sold before 073 have no log: they get back what order_stock_usage says.
--  * stock_receive: amount + price (or "free") + paid from drawer / owner's money / transfer;
--    weighted average cost; the expense is written once (drawer: through the paid-out below).
--  * stock_waste, stock_count_submit (also the opening count with a cost per unit).
--  * cash_movements paid_out -> one cash_flow expense row (reference_id = the movement);
--    voiding the paid-out removes that row. The drawer count already reads cash_movements,
--    the money reports read cash_flow, so each paid-out is counted once in each.
--  * old paths closed: last-price trigger and approve->cash_flow trigger on purchase_logs,
--    add_stock / approve_purchase / start_stock_audit / submit_stock_audit /
--    submit_purchase_request; the 2 pending purchase requests are cancelled (kept, not
--    deleted); save_recipe_cost keeps hot/iced-only recipe lines.
--  * inventory.cost_per_unit numeric(14,4): an average cost must not be rounded to 2 places
--    on every receive.
-- ============================================================

-- 0) the 3 functions changed in place must still be the versions this file was written
--    against (072 / 072 / 066); a second run sees the 073 versions and goes on. Hashes are
--    the ones docs/check-073-live-before.sql prints (CR removed, blank lines at both ends
--    dropped). A mismatch stops here before anything changes.
DO $chk$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT f.fn, f.done, f.hash, p.prosrc
    FROM (VALUES ('checkout_order', 'stock_cut_for_order', '827c8fc921594460cda18ea04416f960'),
                 ('void_order_with_approval', 'stock_return_for_order', '9795e2cc68185e19c0a305cfc5754dde'),
                 ('save_recipe_cost', 'variant_id IS NULL', 'ebf1b69268854aa4f25747df0915c4cf')) f(fn, done, hash)
    LEFT JOIN pg_proc p ON p.proname = f.fn AND p.pronamespace = 'public'::regnamespace
  LOOP
    IF r.prosrc IS NULL THEN
      RAISE EXCEPTION '073: % not found, nothing changed', r.fn;
    END IF;
    IF position(r.done IN r.prosrc) = 0
       AND md5(regexp_replace(regexp_replace(replace(r.prosrc, E'\r', ''), '^([ ]*\n)+', ''), '(\n[ ]*)+$', '')) <> r.hash THEN
      RAISE EXCEPTION '073: % is not the version this file expects, nothing changed', r.fn;
    END IF;
  END LOOP;
END
$chk$;

-- 1) movement log -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES public.inventory(id),
  kind         text NOT NULL CHECK (kind IN ('sale', 'void_return', 'receive', 'waste', 'count', 'opening')),
  qty_delta    numeric NOT NULL,
  qty_after    numeric NOT NULL,
  -- receive: price per unit paid; others: the average cost at that moment
  unit_cost    numeric(14,4),
  reason       text,
  order_id     uuid REFERENCES public.orders(id),
  purchase_id  uuid REFERENCES public.purchase_logs(id),
  user_id      uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_order_idx ON public.stock_movements (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON public.stock_movements (inventory_id, created_at DESC);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stock_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
DROP POLICY IF EXISTS stock_movements_owner_read ON public.stock_movements;
CREATE POLICY stock_movements_owner_read ON public.stock_movements
  FOR SELECT TO authenticated USING (public.real_shop_role_in(ARRAY['owner']));

-- the recipe-cost trigger names this column, so it is re-created around the type change
DO $type$
DECLARE
  v_trg text;
BEGIN
  IF (SELECT numeric_scale FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'cost_per_unit') <> 4 THEN
    SELECT pg_get_triggerdef(oid) INTO v_trg FROM pg_trigger
    WHERE tgrelid = 'public.inventory'::regclass AND tgname = 'trg_inventory_cost_changed';
    DROP TRIGGER IF EXISTS trg_inventory_cost_changed ON public.inventory;
    ALTER TABLE public.inventory ALTER COLUMN cost_per_unit TYPE numeric(14,4);
    IF v_trg IS NOT NULL THEN
      EXECUTE v_trg;
    END IF;
  END IF;
END
$type$;
-- purchase_logs.total_lak is generated (qty x unit price, 2 places): it can differ from what was
-- paid by a few kip; the expense in cash_flow is the exact amount
ALTER TABLE public.purchase_logs
  ADD COLUMN IF NOT EXISTS paid_from   text CHECK (paid_from IN ('drawer', 'owner', 'transfer')),
  ADD COLUMN IF NOT EXISTS received_by uuid,
  ADD COLUMN IF NOT EXISTS note        text;

-- bills sold before this time were cut without a log; a void of one of them falls back to
-- order_stock_usage. Created once, so a second run keeps the first install time.
DO $start$
BEGIN
  IF to_regprocedure('public.stock_log_start()') IS NULL THEN
    EXECUTE format('CREATE FUNCTION public.stock_log_start() RETURNS timestamptz LANGUAGE sql IMMUTABLE AS %L',
                   format('SELECT %L::timestamptz', now()));
    REVOKE ALL ON FUNCTION public.stock_log_start() FROM PUBLIC, anon, authenticated;
  END IF;
END
$start$;

-- 2) sale / void ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_cut_for_order(p_order_id uuid)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $fn$
  WITH use AS (
    SELECT u.inventory_id, u.qty FROM public.order_stock_usage(p_order_id) u
  ), cut AS (
    UPDATE public.inventory i SET current_qty = i.current_qty - use.qty, updated_at = now()
    FROM use WHERE i.id = use.inventory_id
    RETURNING i.id, use.qty, i.current_qty, i.cost_per_unit
  )
  INSERT INTO public.stock_movements (inventory_id, kind, qty_delta, qty_after, unit_cost, order_id)
  SELECT cut.id, 'sale', -cut.qty, cut.current_qty, cut.cost_per_unit, p_order_id FROM cut
$fn$;

CREATE OR REPLACE FUNCTION public.stock_return_for_order(p_order_id uuid)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $fn$
  WITH logged AS (
    SELECT m.inventory_id, -sum(m.qty_delta) AS qty
    FROM public.stock_movements m WHERE m.order_id = p_order_id AND m.kind = 'sale'
    GROUP BY m.inventory_id
  ), use AS (
    SELECT inventory_id, qty FROM logged
    UNION ALL
    SELECT u.inventory_id, u.qty
    FROM public.order_stock_usage(p_order_id) u
    WHERE NOT EXISTS (SELECT 1 FROM logged)
      AND (SELECT o.created_at FROM public.orders o WHERE o.id = p_order_id) < public.stock_log_start()
  ), back AS (
    UPDATE public.inventory i SET current_qty = i.current_qty + use.qty, updated_at = now()
    FROM use WHERE i.id = use.inventory_id AND use.qty <> 0
    RETURNING i.id, use.qty, i.current_qty, i.cost_per_unit
  )
  INSERT INTO public.stock_movements (inventory_id, kind, qty_delta, qty_after, unit_cost, order_id)
  SELECT back.id, 'void_return', back.qty, back.current_qty, back.cost_per_unit, p_order_id FROM back
$fn$;

REVOKE ALL ON FUNCTION public.stock_cut_for_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stock_return_for_order(uuid) FROM PUBLIC, anon, authenticated;

-- 3) receive / waste / count (owner or manager of the real shop, signed in) -------------
CREATE OR REPLACE FUNCTION public.stock_receive(p_inventory_id uuid, p_qty numeric, p_total_cost_lak numeric,
  p_free boolean, p_paid_from text, p_supplier text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  c_shop     constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  inv        public.inventory%ROWTYPE;
  v_qty      numeric := round(p_qty, 3);
  v_free     boolean := COALESCE(p_free, false);
  v_paid     text := NULLIF(lower(btrim(COALESCE(p_paid_from, ''))), '');
  v_note     text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_total    numeric;
  v_unit     numeric;
  v_cost     numeric;
  v_after    numeric;
  v_session  uuid;
  v_purchase uuid;
  v_label    text;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'QTY_INVALID: the amount received must be more than 0' USING ERRCODE = '22023';
  END IF;
  IF v_free THEN
    v_total := 0;
    v_paid := NULL;
  ELSE
    IF p_total_cost_lak IS NULL OR p_total_cost_lak <= 0 THEN
      RAISE EXCEPTION 'PRICE_REQUIRED: enter what was paid, or mark it as free' USING ERRCODE = '22023';
    END IF;
    IF v_paid IS NULL OR v_paid NOT IN ('drawer', 'owner', 'transfer') THEN
      RAISE EXCEPTION 'PAID_FROM_REQUIRED: choose drawer, owner''s money or transfer' USING ERRCODE = '22023';
    END IF;
    v_total := round(p_total_cost_lak, 2);
  END IF;

  -- locked so two receives at once cannot both average against the same old stock
  SELECT * INTO inv FROM public.inventory WHERE id = p_inventory_id AND COALESCE(is_active, true) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingredient not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_paid = 'drawer' THEN
    SELECT id INTO v_session FROM public.cash_sessions WHERE shop_id = c_shop AND status = 'open' FOR UPDATE;
    IF v_session IS NULL THEN
      RAISE EXCEPTION 'NO_OPEN_SESSION: open the cash drawer first, or choose owner''s money' USING ERRCODE = '55000';
    END IF;
  END IF;

  v_unit := v_total / v_qty;
  -- stock at or below 0 (sold past the count) or no cost yet: this price is the only one known
  v_cost := CASE WHEN inv.current_qty <= 0 OR inv.cost_per_unit IS NULL THEN v_unit
                 ELSE (inv.current_qty * inv.cost_per_unit + v_total) / (inv.current_qty + v_qty) END;
  v_label := COALESCE(inv.name_th, inv.name) || ' ' || trim_scale(v_qty) || ' ' || inv.unit;

  INSERT INTO public.purchase_logs (inventory_id, qty_purchased, unit_price_lak, supplier, status,
                                    paid_from, received_by, note)
  VALUES (inv.id, v_qty, v_unit, NULLIF(btrim(COALESCE(p_supplier, '')), ''), 'received',
          v_paid, auth.uid(), v_note)
  RETURNING id INTO v_purchase;

  UPDATE public.inventory SET current_qty = current_qty + v_qty, cost_per_unit = v_cost, updated_at = now()
  WHERE id = inv.id RETURNING current_qty INTO v_after;
  INSERT INTO public.stock_movements (inventory_id, kind, qty_delta, qty_after, unit_cost, reason, purchase_id, user_id)
  VALUES (inv.id, 'receive', v_qty, v_after, v_unit, v_note, v_purchase, auth.uid());

  IF v_paid = 'drawer' THEN
    -- the paid-out trigger writes the expense; writing it here too would count it twice
    INSERT INTO public.cash_movements (session_id, shop_id, kind, amount_lak, category, note)
    VALUES (v_session, c_shop, 'paid_out', v_total, 'ซื้อนม/วัตถุดิบ', 'รับของ: ' || v_label);
  ELSIF v_paid IS NOT NULL THEN
    INSERT INTO public.cash_flow (type, category, amount_lak, description, reference_id, payment_method, date, shop_id)
    VALUES ('expense', 'วัตถุดิบ', v_total,
            'รับของ: ' || v_label || CASE v_paid WHEN 'owner' THEN ' (เงินเจ้าของ)' ELSE ' (โอน)' END,
            v_purchase, CASE v_paid WHEN 'transfer' THEN 'transfer' ELSE 'cash' END,
            (now() AT TIME ZONE 'Asia/Vientiane')::date, c_shop);
  END IF;

  RETURN jsonb_build_object('ok', true, 'purchase_id', v_purchase, 'qty_after', v_after,
    'cost_before', inv.cost_per_unit, 'cost_after', round(v_cost, 4));
END
$fn$;

CREATE OR REPLACE FUNCTION public.stock_waste(p_inventory_id uuid, p_qty numeric, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_qty    numeric := round(p_qty, 3);
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_after  numeric;
  v_cost   numeric;
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'QTY_INVALID: the amount thrown away must be more than 0' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;
  UPDATE public.inventory SET current_qty = current_qty - v_qty, updated_at = now()
  WHERE id = p_inventory_id AND COALESCE(is_active, true)
  RETURNING current_qty, cost_per_unit INTO v_after, v_cost;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingredient not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.stock_movements (inventory_id, kind, qty_delta, qty_after, unit_cost, reason, user_id)
  VALUES (p_inventory_id, 'waste', -v_qty, v_after, v_cost, v_reason, auth.uid());
  RETURN jsonb_build_object('ok', true, 'qty_after', v_after);
END
$fn$;

-- p_counts: [{"inventory_id": "...", "counted_qty": 850, "unit_cost": 25}] (unit_cost only for
-- the opening count, where it is required and becomes the item's cost). Stock becomes what was
-- counted; the difference is logged, a match too (so "last counted" is known).
CREATE OR REPLACE FUNCTION public.stock_count_submit(p_counts jsonb, p_is_opening boolean DEFAULT false, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_open    boolean := COALESCE(p_is_opening, false);
  v_note    text := NULLIF(btrim(COALESCE(p_note, '')), '');
  r         record;
  inv       public.inventory%ROWTYPE;
  v_n       int := 0;
  v_changed int := 0;
  v_value   numeric := 0;
  v_cost    numeric;
BEGIN
  -- the opening count sets every item's cost, so it is the owner's
  PERFORM public.require_real_shop_role(CASE WHEN v_open THEN '{owner}' ELSE '{owner,manager}' END::text[]);
  IF p_counts IS NULL OR jsonb_typeof(p_counts) <> 'array' OR jsonb_array_length(p_counts) = 0 THEN
    RAISE EXCEPTION 'COUNT_EMPTY: nothing was counted' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_counts) e
             GROUP BY e->>'inventory_id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'COUNT_DUPLICATE: an item is in the list twice' USING ERRCODE = '22023';
  END IF;

  -- locked in id order so two counts at once cannot deadlock
  FOR r IN
    SELECT NULLIF(e->>'inventory_id', '')::uuid AS id,
           round((e->>'counted_qty')::numeric, 3) AS counted,
           (e->>'unit_cost')::numeric AS unit_cost
    FROM jsonb_array_elements(p_counts) e
    ORDER BY 1
  LOOP
    IF r.counted IS NULL OR r.counted < 0 THEN
      RAISE EXCEPTION 'COUNT_INVALID: counted amounts must be 0 or more' USING ERRCODE = '22023';
    END IF;
    IF v_open AND (r.unit_cost IS NULL OR r.unit_cost < 0) THEN
      RAISE EXCEPTION 'COST_REQUIRED: the opening count needs a cost per unit for every item' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO inv FROM public.inventory WHERE id = r.id AND COALESCE(is_active, true) FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ingredient not found: %', COALESCE(r.id::text, 'null') USING ERRCODE = 'P0002';
    END IF;
    v_cost := CASE WHEN v_open THEN r.unit_cost ELSE inv.cost_per_unit END;
    UPDATE public.inventory SET current_qty = r.counted, cost_per_unit = v_cost, updated_at = now() WHERE id = inv.id;
    INSERT INTO public.stock_movements (inventory_id, kind, qty_delta, qty_after, unit_cost, reason, user_id)
    VALUES (inv.id, CASE WHEN v_open THEN 'opening' ELSE 'count' END, r.counted - inv.current_qty, r.counted, v_cost, v_note, auth.uid());
    v_n := v_n + 1;
    IF r.counted <> inv.current_qty THEN
      v_changed := v_changed + 1;
      v_value := v_value + (r.counted - inv.current_qty) * COALESCE(v_cost, 0);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'items', v_n, 'changed', v_changed, 'value_change', round(v_value, 2));
END
$fn$;

REVOKE ALL ON FUNCTION public.stock_receive(uuid, numeric, numeric, boolean, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stock_waste(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stock_count_submit(jsonb, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_receive(uuid, numeric, numeric, boolean, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_waste(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_count_submit(jsonb, boolean, text) TO authenticated;

-- 4) drawer paid-out = one expense in cash_flow ------------------------------------------
-- a voided paid-out never happened, so its row is removed (cash_flow allows no negative
-- expense, and a minus row would leave the category totals wrong)
CREATE OR REPLACE FUNCTION public.trg_fn_paid_out_to_cashflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind = 'paid_out' AND NEW.voided_at IS NULL THEN
      INSERT INTO public.cash_flow (type, category, amount_lak, description, reference_id, payment_method, date, shop_id)
      VALUES ('expense',
              CASE WHEN NEW.category IN ('ซื้อน้ำแข็ง', 'ซื้อนม/วัตถุดิบ') THEN 'วัตถุดิบ' ELSE 'อื่นๆ' END,
              NEW.amount_lak, 'จ่ายออกจากลิ้นชัก: ' || NEW.category || COALESCE(' · ' || NEW.note, ''),
              NEW.id, 'cash', (NEW.created_at AT TIME ZONE 'Asia/Vientiane')::date, NEW.shop_id);
    END IF;
  ELSIF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL THEN
    DELETE FROM public.cash_flow WHERE reference_id = NEW.id AND type = 'expense';
  END IF;
  RETURN NULL;
END
$fn$;
REVOKE ALL ON FUNCTION public.trg_fn_paid_out_to_cashflow() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_paid_out_to_cashflow ON public.cash_movements;
CREATE TRIGGER trg_paid_out_to_cashflow AFTER INSERT OR UPDATE OF voided_at ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_paid_out_to_cashflow();

-- 5) old paths ----------------------------------------------------------------------------
-- stock_receive keeps the average cost and writes the expense itself
DROP TRIGGER IF EXISTS trg_purchase_updates_cost ON public.purchase_logs;
DROP TRIGGER IF EXISTS trg_purchase_to_cashflow ON public.purchase_logs;
-- kept (not deleted, as in 043): nothing on screen calls them any more
REVOKE ALL ON FUNCTION public.add_stock(uuid, numeric, numeric, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_purchase(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_stock_audit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_stock_audit(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_purchase_request(uuid, uuid, numeric, numeric, text, text, text) FROM PUBLIC, anon, authenticated;

-- owner decision 2026-11-18: the staff purchase request path is closed before opening day
UPDATE public.purchase_logs
SET status = 'cancelled', flag_reason = concat_ws(' · ', NULLIF(flag_reason, ''), 'ยกเลิกก่อนเปิดร้าน (073)')
WHERE status = 'pending';

-- 6) in-place changes: checkout logs its cut, void gives back the log, recipe save keeps
--    hot/iced-only lines. Each replaced text must be there exactly once.
DO $patch$
DECLARE
  r record;
  v_def text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('checkout_order', E'    UPDATE public.inventory i\n    SET current_qty = i.current_qty - use.qty, updated_at = now()\n    FROM public.order_stock_usage(v_order_id) use\n    WHERE i.id = use.inventory_id;',
                       '    PERFORM public.stock_cut_for_order(v_order_id);'),
    ('void_order_with_approval', E'    UPDATE public.inventory i\n    SET current_qty = i.current_qty + restore.qty, updated_at = v_now\n    FROM public.order_stock_usage(p_order_id) restore\n    WHERE i.id = restore.inventory_id;',
                       '    PERFORM public.stock_return_for_order(p_order_id);'),
    ('save_recipe_cost', '  DELETE FROM public.recipe_ingredients WHERE recipe_id = p_recipe_id;',
                       '  DELETE FROM public.recipe_ingredients WHERE recipe_id = p_recipe_id AND variant_id IS NULL;')
  ) t(fn, old_text, new_text)
  LOOP
    SELECT replace(pg_get_functiondef(p.oid), E'\r', '') INTO v_def FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = r.fn;
    CONTINUE WHEN position(r.new_text IN v_def) > 0;
    IF (length(v_def) - length(replace(v_def, r.old_text, ''))) / length(r.old_text) <> 1 THEN
      RAISE EXCEPTION '073: % does not contain the text to replace exactly once', r.fn;
    END IF;
    EXECUTE replace(v_def, r.old_text, r.new_text);
  END LOOP;
END
$patch$;
$body$;
  EXECUTE v_body;

  -- T17 old paths: last-price and approve->cash_flow triggers gone, pending requests cancelled (kept)
  report := report || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.purchase_logs'::regclass
                                              AND tgname IN ('trg_purchase_updates_cost', 'trg_purchase_to_cashflow'))
      AND NOT EXISTS (SELECT 1 FROM public.purchase_logs WHERE status = 'pending')
      AND (SELECT count(*) FROM public.purchase_logs WHERE flag_reason LIKE '%ยกเลิกก่อนเปิดร้าน (073)%') >= v_pending
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.inventory'::regclass AND tgname = 'trg_inventory_cost_changed')
      AND (SELECT numeric_scale FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'inventory' AND column_name = 'cost_per_unit') = 4
    THEN E'\nPASS T17 purchase triggers dropped, ' || v_pending || ' pending request(s) cancelled and kept, cost has 4 decimals, recipe-cost trigger still there'
    ELSE E'\nFAIL T17 old paths' END;

  -- helpers (pg_temp, rolled back with everything else)
  CREATE FUNCTION pg_temp.t_qty(p uuid) RETURNS numeric LANGUAGE sql AS $f$ SELECT current_qty FROM public.inventory WHERE id = p $f$;
  CREATE FUNCTION pg_temp.t_cost(p uuid) RETURNS numeric LANGUAGE sql AS $f$ SELECT cost_per_unit FROM public.inventory WHERE id = p $f$;
  CREATE FUNCTION pg_temp.t_sell(p_cart jsonb, p_total numeric, p_emp uuid, p_test boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $f$
    SELECT public.checkout_order(gen_random_uuid(), '9afdd9eb-728d-4e36-8077-492c92dbef30', p_emp, p_cart, NULL, 'cash',
                                 p_total, 0, NULL, NULL, NULL, NULL, p_test, p_total) $f$;
  -- the 3 places money is reported: business cash balance, today's expenses, what the open drawer should hold
  CREATE FUNCTION pg_temp.t_money() RETURNS jsonb LANGUAGE sql AS $f$
    SELECT jsonb_build_object(
      'balance', public.get_current_cash_balance(),
      'expense', (SELECT total_expense FROM public.get_cash_flow_summary((now() AT TIME ZONE 'Asia/Vientiane')::date, (now() AT TIME ZONE 'Asia/Vientiane')::date)),
      'drawer', (SELECT (public.cash_session_compute(s.id, 0, clock_timestamp())->>'expected')::numeric
                 FROM public.cash_sessions s WHERE s.shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30' AND s.status = 'open')) $f$;
  -- change of each figure between two snapshots (expense up = positive)
  CREATE FUNCTION pg_temp.t_delta(a jsonb, b jsonb) RETURNS text LANGUAGE sql AS $f$
    SELECT 'balance ' || ((b->>'balance')::numeric - (a->>'balance')::numeric)
        || ' expense ' || ((b->>'expense')::numeric - (a->>'expense')::numeric)
        || ' drawer ' || COALESCE(((b->>'drawer')::numeric - (a->>'drawer')::numeric)::text, 'no session') $f$;
  CREATE FUNCTION pg_temp.t_moved(a jsonb, b jsonb, p_balance numeric, p_expense numeric, p_drawer numeric) RETURNS boolean LANGUAGE sql AS $f$
    SELECT (b->>'balance')::numeric - (a->>'balance')::numeric = p_balance
       AND (b->>'expense')::numeric - (a->>'expense')::numeric = p_expense
       AND ((b->>'drawer')::numeric - (a->>'drawer')::numeric) IS NOT DISTINCT FROM p_drawer $f$;
  CREATE FUNCTION pg_temp.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $f$
    SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
           set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $f$;

  -- test data
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST073 cashier', 'cashier', extensions.crypt(c_cash_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_cashier;
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'TEST073 manager', 'manager', extensions.crypt(c_mgr_pin, extensions.gen_salt('bf')), true) RETURNING id INTO v_mgr;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__073 coffee', 'g', 1000, 100, c_shop) RETURNING id INTO i_coffee;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__073 milk', 'ml', 1000, 20, c_shop) RETURNING id INTO i_milk;
  INSERT INTO public.inventory (name, unit, current_qty, cost_per_unit, shop_id) VALUES ('__073 cup', 'pcs', 50, 2000, c_shop) RETURNING id INTO i_cup;
  INSERT INTO public.recipes (product_name, price_lak, shop_id) VALUES ('__073 Coffee', 30000, c_shop) RETURNING id INTO v_menu;
  SELECT id INTO v_menu_def FROM public.menu_variants WHERE recipe_id = v_menu AND kind = 'default';
  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, qty_normal, unit) VALUES (v_menu, i_coffee, 18, 'g'), (v_menu, i_cup, 1, 'pcs');

  -- no drawer open while the receive tests start: the real session (if any) is set aside, rolled back at the end
  UPDATE public.cash_sessions SET status = 'closed' WHERE shop_id = c_shop AND status <> 'closed';

  -- T15 privileges (anon / signed-in non-member)
  report := report || CASE WHEN NOT has_function_privilege('anon', 'public.stock_receive(uuid, numeric, numeric, boolean, text, text, text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.stock_waste(uuid, numeric, text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.stock_count_submit(jsonb, boolean, text)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.add_stock(uuid, numeric, numeric, text, timestamptz)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.approve_purchase(uuid, boolean)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.start_stock_audit(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.submit_stock_audit(uuid, numeric)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.submit_purchase_request(uuid, uuid, numeric, numeric, text, text, text)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.stock_cut_for_order(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.stock_return_for_order(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.trg_fn_paid_out_to_cashflow()', 'EXECUTE')
      AND NOT has_table_privilege('anon', 'public.stock_movements', 'SELECT')
      AND NOT has_table_privilege('authenticated', 'public.stock_movements', 'INSERT')
    THEN E'\nPASS T15 anon cannot receive / waste / count, old stock functions and internals closed'
    ELSE E'\nFAIL T15 privileges' END;
  PERFORM pg_temp.t_as(gen_random_uuid());
  v_n := 0;
  BEGIN PERFORM public.stock_receive(i_milk, 1, 1, false, 'owner'); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  BEGIN PERFORM public.stock_waste(i_milk, 1, 'x'); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_milk, 'counted_qty', 1))); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  report := report || CASE WHEN v_n = 3 THEN E'\nPASS T15b a signed-in non-member is refused all 3' ELSE E'\nFAIL T15b only ' || v_n || ' of 3 refused' END;

  PERFORM pg_temp.t_as(c_owner);

  -- T1 receive milk 1,000 ml for 30,000 (owner's money) when 1,000 ml cost 20 each -> average 25;
  --    one expense of 30,000, no drawer involved
  m0 := pg_temp.t_money();
  v_res := public.stock_receive(i_milk, 1000, 30000, false, 'owner', 'Market', 'test');
  v_pur := (v_res->>'purchase_id')::uuid;
  m1 := pg_temp.t_money();
  report := report || CASE WHEN pg_temp.t_cost(i_milk) = 25 AND pg_temp.t_qty(i_milk) = 2000
      AND (SELECT count(*) FROM public.cash_flow WHERE reference_id = v_pur AND type = 'expense' AND amount_lak = 30000 AND category = 'วัตถุดิบ') = 1
      AND (SELECT count(*) FROM public.cash_flow WHERE reference_id = v_pur) = 1
      AND pg_temp.t_moved(m0, m1, -30000, 30000, NULL)
      AND (SELECT status = 'received' AND paid_from = 'owner' AND qty_purchased = 1000 FROM public.purchase_logs WHERE id = v_pur)
      AND (SELECT count(*) FROM public.stock_movements WHERE purchase_id = v_pur AND kind = 'receive' AND qty_delta = 1000 AND qty_after = 2000 AND unit_cost = 30) = 1
    THEN E'\nPASS T1 receive 1,000 ml for 30,000: average cost 20 -> 25, one expense 30,000, one movement'
    ELSE E'\nFAIL T1 cost ' || pg_temp.t_cost(i_milk) || ' qty ' || pg_temp.t_qty(i_milk) || ' ' || pg_temp.t_delta(m0, m1) END;

  -- T2 refused: no price and not free / amount 0 / amount below 0 / no "paid from" / unknown "paid from"
  v_n := 0;
  BEGIN PERFORM public.stock_receive(i_milk, 100, NULL, false, 'owner'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'PRICE_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_receive(i_milk, 0, 1000, false, 'owner'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'QTY_INVALID%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_receive(i_milk, -5, 1000, false, 'owner'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'QTY_INVALID%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_receive(i_milk, 100, 1000, false, NULL); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'PAID_FROM_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_receive(i_milk, 100, 1000, false, 'friend'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'PAID_FROM_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_n = 5 AND pg_temp.t_qty(i_milk) = 2000
    THEN E'\nPASS T2 no price / amount 0 / below 0 / no or unknown "paid from" all refused, stock unchanged'
    ELSE E'\nFAIL T2 only ' || v_n || ' of 5 refused' END;

  -- T3 stock below 0 (sold past the count): the new cost is this price, not divided by a negative amount
  UPDATE public.inventory SET current_qty = -5 WHERE id = i_coffee;
  v_res := public.stock_receive(i_coffee, 10, 2000, false, 'transfer');
  report := report || CASE WHEN pg_temp.t_cost(i_coffee) = 200 AND pg_temp.t_qty(i_coffee) = 5
      AND (SELECT payment_method FROM public.cash_flow WHERE reference_id = (v_res->>'purchase_id')::uuid) = 'transfer'
    THEN E'\nPASS T3 receive at -5: cost = this price (200), stock 5, paid by transfer'
    ELSE E'\nFAIL T3 cost ' || pg_temp.t_cost(i_coffee) || ' qty ' || pg_temp.t_qty(i_coffee) END;

  -- T4 free goods: no expense, the average goes down (2,000 x 25 + 1,000 x 0) / 3,000 = 16.6667 (4 decimals kept)
  m0 := pg_temp.t_money();
  v_res := public.stock_receive(i_milk, 1000, NULL, true, 'drawer');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN pg_temp.t_cost(i_milk) = 16.6667 AND pg_temp.t_qty(i_milk) = 3000
      AND NOT EXISTS (SELECT 1 FROM public.cash_flow WHERE reference_id = (v_res->>'purchase_id')::uuid)
      AND (SELECT paid_from IS NULL FROM public.purchase_logs WHERE id = (v_res->>'purchase_id')::uuid)
      AND pg_temp.t_moved(m0, m1, 0, 0, NULL)
    THEN E'\nPASS T4 free goods: no expense (even with "drawer" ticked), cost 16.6667'
    ELSE E'\nFAIL T4 cost ' || pg_temp.t_cost(i_milk) || ' ' || pg_temp.t_delta(m0, m1) END;
  UPDATE public.inventory SET current_qty = 1000, cost_per_unit = 20 WHERE id = i_milk;

  -- T5 paid from the drawer while no drawer is open: refused, nothing changes
  BEGIN
    PERFORM public.stock_receive(i_milk, 500, 10000, false, 'drawer');
    report := report || E'\nFAIL T5 received from a closed drawer';
  EXCEPTION WHEN OTHERS THEN
    report := report || CASE WHEN SQLERRM LIKE 'NO_OPEN_SESSION%' AND pg_temp.t_qty(i_milk) = 1000
      THEN E'\nPASS T5 "paid from drawer" with no open drawer refused, stock unchanged' ELSE E'\nFAIL T5 ' || SQLERRM END;
  END;

  INSERT INTO public.cash_sessions (shop_id, status, opened_at, opening_cash_lak, window_start)
  VALUES (c_shop, 'open', clock_timestamp(), 500000, clock_timestamp()) RETURNING id INTO v_session;

  -- T6 receive 1,000 ml for 30,000 from the drawer: one paid-out in the drawer, one expense;
  --    each money figure moves by 30,000 exactly once
  m0 := pg_temp.t_money();
  v_res := public.stock_receive(i_milk, 1000, 30000, false, 'drawer');
  m1 := pg_temp.t_money();
  SELECT id INTO v_mov FROM public.cash_movements WHERE session_id = v_session AND kind = 'paid_out' AND note LIKE 'รับของ: __073 milk 1000 ml';
  report := report || CASE WHEN v_mov IS NOT NULL
      AND (SELECT count(*) FROM public.cash_movements WHERE session_id = v_session) = 1
      AND (SELECT count(*) FROM public.cash_flow WHERE reference_id = v_mov AND type = 'expense' AND amount_lak = 30000) = 1
      AND NOT EXISTS (SELECT 1 FROM public.cash_flow WHERE reference_id = (v_res->>'purchase_id')::uuid)
      AND pg_temp.t_moved(m0, m1, -30000, 30000, -30000)
      AND pg_temp.t_cost(i_milk) = 25
    THEN E'\nPASS T6 receive paid from drawer: 1 paid-out, 1 expense; balance -30,000, expenses +30,000, drawer -30,000 (once each)'
    ELSE E'\nFAIL T6 ' || pg_temp.t_delta(m0, m1) END;

  -- T7 a paid-out from the drawer screen (ice 20,000, cashier PIN): one expense too
  m0 := pg_temp.t_money();
  v_res := public.cash_movement_add(c_shop, c_cash_pin, 'paid_out', 20000, 'ซื้อน้ำแข็ง', 'ร้านข้างๆ');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN (v_res->>'ok')::boolean
      AND (SELECT count(*) FROM public.cash_flow WHERE reference_id = (v_res->>'id')::uuid AND type = 'expense' AND amount_lak = 20000 AND category = 'วัตถุดิบ') = 1
      AND pg_temp.t_moved(m0, m1, -20000, 20000, -20000)
    THEN E'\nPASS T7 drawer paid-out (ice 20,000): 1 expense; balance, expenses and drawer each move 20,000 once'
    ELSE E'\nFAIL T7 ' || v_res::text || ' ' || pg_temp.t_delta(m0, m1) END;

  -- T8 money put into the drawer is not income: only the drawer changes
  m0 := pg_temp.t_money();
  v_res := public.cash_movement_add(c_shop, c_cash_pin, 'paid_in', 100000, 'เติมเงินทอน');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN NOT EXISTS (SELECT 1 FROM public.cash_flow WHERE reference_id = (v_res->>'id')::uuid)
      AND pg_temp.t_moved(m0, m1, 0, 0, 100000)
    THEN E'\nPASS T8 money put into the drawer: drawer +100,000, no cash_flow row'
    ELSE E'\nFAIL T8 ' || pg_temp.t_delta(m0, m1) END;

  -- T9 voiding the ice paid-out (manager PIN) takes its expense away once; voiding the receive's paid-out too
  SELECT id INTO v_mov FROM public.cash_movements WHERE session_id = v_session AND category = 'ซื้อน้ำแข็ง';
  m0 := pg_temp.t_money();
  v_res := public.cash_movement_void(c_shop, v_mov, c_mgr_pin, 'test');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN (v_res->>'ok')::boolean AND NOT EXISTS (SELECT 1 FROM public.cash_flow WHERE reference_id = v_mov)
      AND pg_temp.t_moved(m0, m1, 20000, -20000, 20000)
    THEN E'\nPASS T9 void ice paid-out: its expense removed; balance, expenses and drawer each back by 20,000 once'
    ELSE E'\nFAIL T9 ' || v_res::text || ' ' || pg_temp.t_delta(m0, m1) END;
  SELECT id INTO v_mov FROM public.cash_movements WHERE session_id = v_session AND note LIKE 'รับของ:%';
  m0 := pg_temp.t_money();
  PERFORM public.cash_movement_void(c_shop, v_mov, c_mgr_pin, 'test');
  m1 := pg_temp.t_money();
  report := report || CASE WHEN pg_temp.t_moved(m0, m1, 30000, -30000, 30000)
      -- every paid-out of this drawer: exactly 1 expense row while it stands, none once voided
      AND NOT EXISTS (SELECT 1 FROM public.cash_movements m WHERE m.session_id = v_session AND m.kind = 'paid_out'
                      AND (SELECT count(*) FROM public.cash_flow f WHERE f.reference_id = m.id) <> CASE WHEN m.voided_at IS NULL THEN 1 ELSE 0 END)
    THEN E'\nPASS T9b void the receive''s paid-out: back by 30,000 once; every paid-out has 1 expense row, voided ones none'
    ELSE E'\nFAIL T9b ' || pg_temp.t_delta(m0, m1) END;

  -- T10 waste 200 ml with a reason: stock -200, logged, money untouched; without a reason refused
  m0 := pg_temp.t_money();
  v_x := pg_temp.t_qty(i_milk);
  PERFORM public.stock_waste(i_milk, 200, 'บูด');
  m1 := pg_temp.t_money();
  v_n := 0;
  BEGIN PERFORM public.stock_waste(i_milk, 200, '  '); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'REASON_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_waste(i_milk, 0, 'x'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'QTY_INVALID%' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_x - pg_temp.t_qty(i_milk) = 200 AND v_n = 2
      AND (SELECT count(*) FROM public.stock_movements WHERE inventory_id = i_milk AND kind = 'waste' AND qty_delta = -200 AND reason = 'บูด' AND unit_cost = 25) = 1
      AND pg_temp.t_moved(m0, m1, 0, 0, 0)
    THEN E'\nPASS T10 waste 200 ml "บูด": stock -200, logged at cost 25, money untouched; no reason / amount 0 refused'
    ELSE E'\nFAIL T10 qty change ' || (v_x - pg_temp.t_qty(i_milk)) || ' refused ' || v_n END;

  -- T11 count 3 items: stock becomes what was counted, each difference logged (a match logged as 0)
  v_x := pg_temp.t_qty(i_coffee);
  v_res := public.stock_count_submit(jsonb_build_array(
    jsonb_build_object('inventory_id', i_coffee, 'counted_qty', 3),
    jsonb_build_object('inventory_id', i_milk, 'counted_qty', 1500.5),
    jsonb_build_object('inventory_id', i_cup, 'counted_qty', 50)), false, 'คืนนี้');
  report := report || CASE WHEN pg_temp.t_qty(i_coffee) = 3 AND pg_temp.t_qty(i_milk) = 1500.5 AND pg_temp.t_qty(i_cup) = 50
      AND (v_res->>'items')::int = 3 AND (v_res->>'changed')::int = 2
      AND (SELECT qty_delta FROM public.stock_movements WHERE inventory_id = i_coffee AND kind = 'count') = 3 - v_x
      AND (SELECT qty_delta FROM public.stock_movements WHERE inventory_id = i_cup AND kind = 'count') = 0
      AND pg_temp.t_cost(i_milk) = 25
    THEN E'\nPASS T11 count of 3: stock set to the count, 2 changed, differences logged, costs unchanged'
    ELSE E'\nFAIL T11 ' || v_res::text END;
  v_n := 0;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 1), jsonb_build_object('inventory_id', i_cup, 'counted_qty', 2))); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'COUNT_DUPLICATE%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', -1))); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'COUNT_INVALID%' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', gen_random_uuid(), 'counted_qty', 1))); EXCEPTION WHEN OTHERS THEN IF SQLSTATE = 'P0002' THEN v_n := v_n + 1; END IF; END;
  BEGIN PERFORM public.stock_count_submit('[]'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'COUNT_EMPTY%' THEN v_n := v_n + 1; END IF; END;
  report := report || CASE WHEN v_n = 4 AND pg_temp.t_qty(i_cup) = 50
    THEN E'\nPASS T11b duplicate item / below 0 / unknown item / empty list refused' ELSE E'\nFAIL T11b only ' || v_n || ' of 4 refused' END;

  -- T12 opening count: a cost per unit is required and becomes the cost; a manager may count but not open
  v_n := 0;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 40)), true); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'COST_REQUIRED%' THEN v_n := v_n + 1; END IF; END;
  PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 40, 'unit_cost', 1500),
                                                      jsonb_build_object('inventory_id', i_coffee, 'counted_qty', 1000, 'unit_cost', 0)), true);
  UPDATE public.shop_users SET role = 'manager' WHERE shop_id = c_shop AND user_id = c_owner;
  BEGIN PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 41, 'unit_cost', 1)), true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  PERFORM public.stock_count_submit(jsonb_build_array(jsonb_build_object('inventory_id', i_cup, 'counted_qty', 39)));
  PERFORM public.stock_receive(i_cup, 1, 1500, false, 'owner');
  UPDATE public.shop_users SET role = 'owner' WHERE shop_id = c_shop AND user_id = c_owner;
  report := report || CASE WHEN v_n = 2 AND pg_temp.t_cost(i_cup) = 1500 AND pg_temp.t_qty(i_cup) = 40 AND pg_temp.t_cost(i_coffee) = 0
      AND (SELECT count(*) FROM public.stock_movements WHERE inventory_id = i_cup AND kind = 'opening' AND unit_cost = 1500 AND qty_delta = -10) = 1
    THEN E'\nPASS T12 opening count needs a cost (cost 0 accepted), sets it; a manager can count and receive but not open'
    ELSE E'\nFAIL T12 refused ' || v_n || ' cost ' || pg_temp.t_cost(i_cup) || ' qty ' || pg_temp.t_qty(i_cup) END;
  UPDATE public.inventory SET current_qty = 1000, cost_per_unit = 100 WHERE id = i_coffee;
  PERFORM pg_temp.t_as(NULL);

  -- T13 a sale logs what it cut; changing the recipe before the void still gives back what was cut
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_menu, 'variant_id', v_menu_def, 'qty', 2)), 60000, v_cashier);
  v_order := (v_res->>'order_id')::uuid;
  report := report || CASE WHEN pg_temp.t_qty(i_coffee) = 964 AND pg_temp.t_qty(i_cup) = 38
      AND (SELECT count(*) FROM public.stock_movements WHERE order_id = v_order AND kind = 'sale') = 2
      AND (SELECT qty_delta FROM public.stock_movements WHERE order_id = v_order AND inventory_id = i_coffee) = -36
      AND (SELECT qty_after FROM public.stock_movements WHERE order_id = v_order AND inventory_id = i_coffee) = 964
    THEN E'\nPASS T13 sale of 2: coffee -36, cup -2, both logged with the amount after'
    ELSE E'\nFAIL T13 coffee ' || pg_temp.t_qty(i_coffee) || ' cup ' || pg_temp.t_qty(i_cup) END;
  UPDATE public.recipe_ingredients SET qty_normal = 30 WHERE recipe_id = v_menu AND inventory_id = i_coffee;
  v_res := public.void_order_with_approval(v_order, c_shop, c_mgr_pin, 'test');
  report := report || CASE WHEN (v_res->>'ok')::boolean AND pg_temp.t_qty(i_coffee) = 1000 AND pg_temp.t_qty(i_cup) = 40
      AND (SELECT sum(qty_delta) FROM public.stock_movements WHERE order_id = v_order) = 0
      AND pg_temp.t_cost(i_coffee) = 100
    THEN E'\nPASS T13b recipe changed 18 -> 30 g, then void: coffee back exactly 36 (not 60), cup 2, cost unchanged'
    ELSE E'\nFAIL T13b ' || v_res::text || ' coffee ' || pg_temp.t_qty(i_coffee) END;

  -- T14 a bill sold before 073 (no log) is voided with what the recipe says (as 072 did)
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_menu, 'variant_id', v_menu_def, 'qty', 1)), 30000, v_cashier);
  v_order := (v_res->>'order_id')::uuid;
  DELETE FROM public.stock_movements WHERE order_id = v_order;
  UPDATE public.orders SET created_at = public.stock_log_start() - interval '1 hour' WHERE id = v_order;
  v_x := pg_temp.t_qty(i_coffee);
  PERFORM public.void_order_with_approval(v_order, c_shop, c_mgr_pin, 'test');
  -- a bill sold after 073 that cut nothing gets nothing back
  INSERT INTO public.recipes (product_name, price_lak, shop_id) VALUES ('__073 Water', 5000, c_shop) RETURNING id INTO v_iced_menu;
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_iced_menu, 'qty', 1)), 5000, v_cashier);
  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, qty_normal, unit) VALUES (v_iced_menu, i_cup, 1, 'pcs');
  v_y := pg_temp.t_qty(i_cup);
  PERFORM public.void_order_with_approval((v_res->>'order_id')::uuid, c_shop, c_mgr_pin, 'test');
  report := report || CASE WHEN pg_temp.t_qty(i_coffee) - v_x = 30 AND pg_temp.t_qty(i_cup) = v_y
    THEN E'\nPASS T14 bill from before 073: void gives back the recipe (30 g); bill after 073 that cut nothing: nothing given back'
    ELSE E'\nFAIL T14 coffee back ' || (pg_temp.t_qty(i_coffee) - v_x) || ' cup change ' || (pg_temp.t_qty(i_cup) - v_y) END;

  -- T16 a test bill cuts nothing and logs nothing
  INSERT INTO public.pos_test_windows (shop_id, started_at, ends_at) VALUES (c_shop, now() - interval '1 minute', now() + interval '1 hour');
  v_x := pg_temp.t_qty(i_coffee);
  v_res := pg_temp.t_sell(jsonb_build_array(jsonb_build_object('recipe_id', v_menu, 'variant_id', v_menu_def, 'qty', 1)), 30000, v_cashier, true);
  report := report || CASE WHEN v_res->>'status' = 'test' AND pg_temp.t_qty(i_coffee) = v_x
      AND NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE order_id = (v_res->>'order_id')::uuid)
    THEN E'\nPASS T16 test bill: no stock cut, nothing logged' ELSE E'\nFAIL T16 ' || v_res::text END;

  -- T18 saving a recipe from the old recipe screen keeps hot/iced-only lines
  PERFORM pg_temp.t_as(c_owner);
  PERFORM public.save_menu_variants(v_menu, '[{"kind":"hot","price_lak":30000},{"kind":"iced","price_lak":35000}]');
  SELECT id INTO v_iced FROM public.menu_variants WHERE recipe_id = v_menu AND kind = 'iced';
  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, variant_id, qty_normal, unit) VALUES (v_menu, i_milk, v_iced, 120, 'ml');
  PERFORM public.save_recipe_cost(v_menu, true, 5000, jsonb_build_array(jsonb_build_object('inventory_id', i_coffee, 'qty_normal', 20, 'qty_less', 20, 'qty_more', 20)));
  PERFORM pg_temp.t_as(NULL);
  report := report || CASE WHEN (SELECT count(*) FROM public.recipe_ingredients WHERE recipe_id = v_menu) = 2
      AND EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE recipe_id = v_menu AND variant_id = v_iced AND inventory_id = i_milk)
      AND EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE recipe_id = v_menu AND variant_id IS NULL AND inventory_id = i_coffee AND qty_normal = 20)
    THEN E'\nPASS T18 old recipe screen replaces shared lines, keeps the iced-only milk'
    ELSE E'\nFAIL T18 recipe lines' END;

  -- T19 running the migration again: no error, nothing logged or cancelled twice
  SELECT count(*) INTO v_n FROM public.stock_movements;
  v_x := (SELECT count(*) FROM public.cash_flow);
  BEGIN
    EXECUTE v_body;
    report := report || CASE WHEN (SELECT count(*) FROM public.stock_movements) = v_n AND (SELECT count(*) FROM public.cash_flow) = v_x
        AND (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_paid_out_to_cashflow') = 1
      THEN E'\nPASS T19 second run changes nothing' ELSE E'\nFAIL T19 second run changed data' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T19 second run: ' || SQLERRM;
  END;

  RAISE EXCEPTION '073 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
