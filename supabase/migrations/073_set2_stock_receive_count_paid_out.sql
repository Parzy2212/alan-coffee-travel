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
