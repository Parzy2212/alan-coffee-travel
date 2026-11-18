-- ============================================================
--  072 — set 2 step 1: hot/iced variants, one stock/cost calculator, checkout + void use it
--
--  * menu_variants: every menu item has 1+ variants (default / hot / iced), each with its own
--    price. Existing items get one 'default' variant at today's price. recipes.price_lak stays
--    (old screens and reports read it) and follows the cheapest active variant.
--  * recipe_ingredients.variant_id: a recipe line for one variant only (NULL = every variant).
--  * line_stock_usage / order_stock_usage / variant_unit_cost: the only place that answers
--    "what does this drink use": base recipes are expanded, the variant's lines are picked,
--    the sweetness level picks qty_less / qty_normal / qty_more, "none" uses 0 of
--    ingredients marked as sweetener, and extra shots add the shop's coffee per shot.
--  * checkout_order: price = variant price + extra shots; never refuses a sale for low stock
--    (owner decision 2026-11-13) but returns stock_warnings; stock is cut with
--    order_stock_usage; each bill line keeps unit_cost_lak (ingredient cost at the time of sale).
--  * void_order_with_approval: gives back exactly what order_stock_usage cut.
--  * extra shot price/ingredient/grams per shop; sweetener flag per ingredient; owner-only
--    function to save a menu item's variants.
--  Old POS code (no variant_id in the cart) keeps working: the default variant, or the one
--  named in the customization text, is used.
-- ============================================================

-- 0) checkout_order / void_order_with_approval must still be the versions this file was
--    written against (061 + 070 + 071 / 053); a second run sees the 072 versions and goes on.
--    The void check is the exact one step 6 needs, so a mismatch stops here before anything
--    changes (the SQL Editor may not run the file as one transaction). This file itself may be
--    saved with CRLF on Windows, so every text compared here has CR removed.
DO $chk$
DECLARE
  v_src text;
  v_old text := replace($o$    FROM (
      SELECT ri.inventory_id, SUM(oi.qty * ri.qty_normal) AS qty
      FROM public.order_items oi
      JOIN public.recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
      WHERE oi.order_id = p_order_id AND ri.inventory_id IS NOT NULL
      GROUP BY ri.inventory_id
    ) restore$o$, E'\r', '');
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname = 'checkout_order';
  IF position('order_stock_usage' IN v_src) = 0 AND md5(replace(v_src, E'\r', '')) <> '827846d3feeb3d58fc8d1c2d7f4b3560' THEN
    RAISE EXCEPTION '072: checkout_order is not the 071 version, nothing changed';
  END IF;
  SELECT replace(prosrc, E'\r', '') INTO v_src FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname = 'void_order_with_approval';
  IF position('order_stock_usage' IN v_src) = 0
     AND (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION '072: void_order_with_approval is not the 053 version, nothing changed';
  END IF;
  -- step 6 replaces exactly this text (read back on the same connection; missing = step 6 stops)
  PERFORM set_config('alan.m072_void_old', v_old, false);
END
$chk$;

-- 1) variants -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('default', 'hot', 'iced')),
  price_lak   numeric(10,2) NOT NULL CHECK (price_lak >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, kind),
  UNIQUE (id, recipe_id)
);
ALTER TABLE public.menu_variants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_variants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.menu_variants TO anon, authenticated;
GRANT ALL ON public.menu_variants TO service_role;
DROP POLICY IF EXISTS menu_variants_read ON public.menu_variants;
CREATE POLICY menu_variants_read ON public.menu_variants FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.menu_variants (recipe_id, kind, price_lak)
SELECT r.id, 'default', r.price_lak FROM public.recipes r
ON CONFLICT (recipe_id, kind) DO NOTHING;

-- the POS reloads its menu on realtime changes; a hot/iced price change must reach it like a menu change
DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'recipes')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_variants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_variants;
  END IF;
END
$rt$;

ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS variant_id uuid;
DO $fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_ingredients_variant_fkey') THEN
    -- the variant must belong to the same menu item as the recipe line
    ALTER TABLE public.recipe_ingredients ADD CONSTRAINT recipe_ingredients_variant_fkey
      FOREIGN KEY (variant_id, recipe_id) REFERENCES public.menu_variants (id, recipe_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id    uuid REFERENCES public.menu_variants(id),
  ADD COLUMN IF NOT EXISTS sweetness     text CHECK (sweetness IN ('none', 'less', 'normal', 'more')),
  ADD COLUMN IF NOT EXISTS extra_shots   int NOT NULL DEFAULT 0 CHECK (extra_shots BETWEEN 0 AND 9),
  ADD COLUMN IF NOT EXISTS unit_cost_lak numeric(14,2);

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS is_sweetener boolean NOT NULL DEFAULT false;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS extra_shot_price_lak    numeric(10,2) CHECK (extra_shot_price_lak > 0),
  ADD COLUMN IF NOT EXISTS extra_shot_inventory_id uuid REFERENCES public.inventory(id),
  ADD COLUMN IF NOT EXISTS extra_shot_qty          numeric CHECK (extra_shot_qty > 0);

-- 2) recipes.price_lak <-> variant prices -------------------------------------------
-- new menu item: gets its default variant
CREATE OR REPLACE FUNCTION public.trg_fn_recipe_default_variant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  INSERT INTO public.menu_variants (recipe_id, kind, price_lak) VALUES (NEW.id, 'default', NEW.price_lak)
  ON CONFLICT (recipe_id, kind) DO NOTHING;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS trg_recipe_default_variant ON public.recipes;
CREATE TRIGGER trg_recipe_default_variant AFTER INSERT ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_recipe_default_variant();

-- the old menu form edits recipes.price_lak: with one active variant that is its price;
-- with hot + iced the form cannot say which one, so it is refused
CREATE OR REPLACE FUNCTION public.trg_fn_recipe_price_to_variant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_n int; v_min numeric;
BEGIN
  IF NEW.price_lak IS NOT DISTINCT FROM OLD.price_lak THEN RETURN NEW; END IF;
  SELECT count(*), min(price_lak) INTO v_n, v_min FROM public.menu_variants WHERE recipe_id = NEW.id AND is_active;
  IF v_n = 1 THEN
    UPDATE public.menu_variants SET price_lak = NEW.price_lak
    WHERE recipe_id = NEW.id AND is_active AND price_lak IS DISTINCT FROM NEW.price_lak;
  ELSIF v_n > 1 AND NEW.price_lak IS DISTINCT FROM v_min THEN
    RAISE EXCEPTION 'MENU_HAS_VARIANTS: this item has hot/iced prices, change them in the item''s variants'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS trg_recipe_price_to_variant ON public.recipes;
CREATE TRIGGER trg_recipe_price_to_variant AFTER UPDATE OF price_lak ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_recipe_price_to_variant();

-- recipes.price_lak = the cheapest active variant ("from 35,000" on old screens)
CREATE OR REPLACE FUNCTION public.trg_fn_variant_price_to_recipe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_min numeric;
BEGIN
  SELECT min(price_lak) INTO v_min FROM public.menu_variants WHERE recipe_id = NEW.recipe_id AND is_active;
  IF v_min IS NOT NULL THEN
    UPDATE public.recipes SET price_lak = v_min WHERE id = NEW.recipe_id AND price_lak IS DISTINCT FROM v_min;
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS trg_variant_price_to_recipe ON public.menu_variants;
CREATE TRIGGER trg_variant_price_to_recipe AFTER INSERT OR UPDATE OF price_lak, is_active ON public.menu_variants
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_variant_price_to_recipe();

-- 3) the calculator -------------------------------------------------------------
-- ingredients used by ONE drink of this menu item / variant / sweetness / extra shots
CREATE OR REPLACE FUNCTION public.line_stock_usage(p_recipe_id uuid, p_variant_id uuid, p_sweetness text, p_extra_shots int, p_shop_id uuid)
RETURNS TABLE (inventory_id uuid, qty numeric)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  WITH lines AS (
    SELECT ri.inventory_id, ri.base_id,
      CASE
        WHEN p_sweetness = 'none' AND inv.is_sweetener THEN 0
        -- "none" is the far end of "less" for everything that is not a sweetener
        WHEN p_sweetness IN ('none', 'less') THEN COALESCE(ri.qty_less, ri.qty_normal)
        WHEN p_sweetness = 'more' THEN COALESCE(ri.qty_more, ri.qty_normal)
        ELSE ri.qty_normal
      END AS q
    FROM public.recipe_ingredients ri
    LEFT JOIN public.inventory inv ON inv.id = ri.inventory_id
    WHERE ri.recipe_id = p_recipe_id AND (ri.variant_id IS NULL OR ri.variant_id = p_variant_id)
  )
  SELECT u.inventory_id, sum(u.q)
  FROM (
    SELECT l.inventory_id, l.q FROM lines l WHERE l.inventory_id IS NOT NULL
    UNION ALL
    -- a base recipe (e.g. milk mix) is cut as its own ingredients; yield 0 is skipped, not divided by
    SELECT rbi.inventory_id, l.q * rbi.qty / rb.yield_qty
    FROM lines l
    JOIN public.recipe_bases rb ON rb.id = l.base_id AND rb.yield_qty > 0
    JOIN public.recipe_base_ingredients rbi ON rbi.base_id = l.base_id
    UNION ALL
    SELECT s.extra_shot_inventory_id, s.extra_shot_qty * p_extra_shots
    FROM public.shops s
    WHERE s.id = p_shop_id AND p_extra_shots > 0 AND s.extra_shot_inventory_id IS NOT NULL AND s.extra_shot_qty > 0
  ) u
  GROUP BY u.inventory_id
  HAVING sum(u.q) <> 0
$fn$;

-- ingredients used by a whole bill. Lines saved before 072 have no variant: they were cut
-- with qty_normal of the direct ingredients only, so that is what is given back for them
CREATE OR REPLACE FUNCTION public.order_stock_usage(p_order_id uuid)
RETURNS TABLE (inventory_id uuid, qty numeric)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT x.inventory_id, sum(x.qty)
  FROM (
    SELECT u.inventory_id, oi.qty * u.qty AS qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    CROSS JOIN LATERAL public.line_stock_usage(oi.recipe_id, oi.variant_id, oi.sweetness, oi.extra_shots,
      COALESCE(o.shop_id, '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid)) u
    WHERE oi.order_id = p_order_id AND oi.variant_id IS NOT NULL
    UNION ALL
    SELECT ri.inventory_id, oi.qty * ri.qty_normal
    FROM public.order_items oi
    JOIN public.recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
    WHERE oi.order_id = p_order_id AND oi.variant_id IS NULL
      AND ri.inventory_id IS NOT NULL AND ri.variant_id IS NULL
  ) x
  GROUP BY x.inventory_id
  HAVING sum(x.qty) <> 0
$fn$;

-- ingredient cost of one drink at today's average cost; NULL when an ingredient it uses has
-- no cost yet (an unknown cost must not look like a free drink in profit reports)
CREATE OR REPLACE FUNCTION public.variant_unit_cost(p_variant_id uuid, p_sweetness text DEFAULT 'normal', p_extra_shots int DEFAULT 0)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT CASE WHEN bool_or(i.cost_per_unit IS NULL) THEN NULL
              ELSE round(COALESCE(sum(u.qty * i.cost_per_unit), 0), 2) END
  FROM public.menu_variants v
  JOIN public.recipes r ON r.id = v.recipe_id
  CROSS JOIN LATERAL public.line_stock_usage(v.recipe_id, v.id, COALESCE(p_sweetness, 'normal'), COALESCE(p_extra_shots, 0),
    COALESCE(r.shop_id, '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid)) u
  JOIN public.inventory i ON i.id = u.inventory_id
  WHERE v.id = p_variant_id
$fn$;

REVOKE ALL ON FUNCTION public.line_stock_usage(uuid, uuid, text, int, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_stock_usage(uuid) FROM PUBLIC, anon, authenticated;
-- only checkout_order (runs as owner) uses it; anyone can sign up, so the real shop's drink
-- costs stay out of reach
REVOKE ALL ON FUNCTION public.variant_unit_cost(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_fn_recipe_default_variant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_fn_recipe_price_to_variant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_fn_variant_price_to_recipe() FROM PUBLIC, anon, authenticated;
-- the old per-line stock check refused sales; checkout no longer calls it and no screen does
REVOKE ALL ON FUNCTION public.check_stock_for_cart(jsonb) FROM PUBLIC, anon, authenticated;

-- 4) back-office writes (owner / manager of the real shop) ---------------------------------
-- the variants of one menu item, e.g. [{"kind":"hot","price_lak":35000},{"kind":"iced","price_lak":40000}]
-- kinds left out are switched off (bills point at them, so they are never deleted)
CREATE OR REPLACE FUNCTION public.save_menu_variants(p_recipe_id uuid, p_variants jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v jsonb;
  v_kinds text[] := '{}';
  v_kind text;
  v_price numeric;
BEGIN
  PERFORM public.require_real_shop_role('{owner}'::text[]);
  IF NOT EXISTS (SELECT 1 FROM public.recipes WHERE id = p_recipe_id) THEN
    RAISE EXCEPTION 'menu item not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' OR jsonb_array_length(p_variants) = 0 THEN
    RAISE EXCEPTION 'at least one variant is required' USING ERRCODE = '22023';
  END IF;
  FOR v IN SELECT * FROM jsonb_array_elements(p_variants) LOOP
    v_kind := v->>'kind';
    v_price := (v->>'price_lak')::numeric;
    IF v_kind IS NULL OR v_kind NOT IN ('default', 'hot', 'iced') OR v_kind = ANY (v_kinds) THEN
      RAISE EXCEPTION 'bad or repeated variant kind: %', COALESCE(v_kind, 'null') USING ERRCODE = '22023';
    END IF;
    IF v_price IS NULL OR v_price <= 0 THEN
      RAISE EXCEPTION 'price must be more than 0' USING ERRCODE = '22023';
    END IF;
    v_kinds := v_kinds || v_kind;
  END LOOP;
  IF 'default' = ANY (v_kinds) AND array_length(v_kinds, 1) > 1 THEN
    RAISE EXCEPTION 'use either one price, or hot and/or iced prices' USING ERRCODE = '22023';
  END IF;

  UPDATE public.menu_variants SET is_active = false
  WHERE recipe_id = p_recipe_id AND NOT (kind = ANY (v_kinds)) AND is_active;
  FOR v IN SELECT * FROM jsonb_array_elements(p_variants) LOOP
    INSERT INTO public.menu_variants (recipe_id, kind, price_lak, is_active, sort_order)
    VALUES (p_recipe_id, v->>'kind', (v->>'price_lak')::numeric, true,
            CASE v->>'kind' WHEN 'hot' THEN 1 WHEN 'iced' THEN 2 ELSE 0 END)
    ON CONFLICT (recipe_id, kind) DO UPDATE SET price_lak = EXCLUDED.price_lak, is_active = true;
  END LOOP;
END
$fn$;

CREATE OR REPLACE FUNCTION public.set_extra_shot(p_price_lak numeric, p_inventory_id uuid, p_qty numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  PERFORM public.require_real_shop_role('{owner}'::text[]);
  -- all NULL = no extra shot button on the POS
  IF p_price_lak IS NULL AND p_inventory_id IS NULL AND p_qty IS NULL THEN
    UPDATE public.shops SET extra_shot_price_lak = NULL, extra_shot_inventory_id = NULL, extra_shot_qty = NULL
    WHERE id = '9afdd9eb-728d-4e36-8077-492c92dbef30';
    RETURN;
  END IF;
  IF p_price_lak IS NULL OR p_price_lak <= 0 OR p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'price and amount per shot must be more than 0' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory WHERE id = p_inventory_id AND COALESCE(is_active, true)) THEN
    RAISE EXCEPTION 'ingredient not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.shops SET extra_shot_price_lak = p_price_lak, extra_shot_inventory_id = p_inventory_id, extra_shot_qty = p_qty
  WHERE id = '9afdd9eb-728d-4e36-8077-492c92dbef30';
END
$fn$;

CREATE OR REPLACE FUNCTION public.set_inventory_sweetener(p_inventory_id uuid, p_is_sweetener boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  PERFORM public.require_real_shop_role('{owner,manager}'::text[]);
  UPDATE public.inventory SET is_sweetener = COALESCE(p_is_sweetener, false), updated_at = now()
  WHERE id = p_inventory_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingredient not found' USING ERRCODE = 'P0002';
  END IF;
END
$fn$;

REVOKE ALL ON FUNCTION public.save_menu_variants(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_extra_shot(numeric, uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_inventory_sweetener(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_menu_variants(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_extra_shot(numeric, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_inventory_sweetener(uuid, boolean) TO authenticated;

-- 5) checkout ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_order(p_client_uuid uuid, p_shop_id uuid, p_employee_id uuid, p_cart jsonb, p_customer_id uuid, p_payment_method text, p_amount_received numeric, p_discount_lak numeric, p_discount_reason text, p_table_number text, p_customer_name text, p_staff_note text, p_is_test boolean, p_expected_total numeric, p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_queue_number integer DEFAULT NULL::integer, p_split_cash numeric DEFAULT NULL::numeric, p_split_transfer numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_existing  public.orders%ROWTYPE;
  -- offline replay: the sale already happened, so record it rather than reject it
  v_replay    boolean := p_created_at IS NOT NULL;
  v_created   timestamptz := LEAST(COALESCE(p_created_at, now()), now());
  v_xfer_part numeric;
  v_employee  uuid := p_employee_id;
  v_note      text := NULLIF(btrim(COALESCE(p_staff_note, '')), '');
  v_day       date;
  v_order_id  uuid;
  v_queue     int;
  v_receipt   text;
  v_subtotal  numeric := 0;
  v_discount  numeric := COALESCE(p_discount_lak, 0);
  v_cap       numeric;
  v_total     numeric;
  v_change    numeric;
  v_received  numeric;
  v_method    text := lower(btrim(COALESCE(p_payment_method, '')));
  v_test      boolean := COALESCE(p_is_test, false);
  v_split     boolean := false;
  v_scash     numeric := COALESCE(p_split_cash, 0);
  v_sxfer     numeric := COALESCE(p_split_transfer, 0);
  item        jsonb;
  v_rid       uuid;
  v_qty       int;
  v_price     numeric;
  v_vid       uuid;
  v_vactive   boolean;
  v_sweet     text;
  v_shots     int;
  v_cust      text;
  v_shot_price numeric;
  v_lines     jsonb := '[]'::jsonb;
  v_warnings  jsonb := '[]'::jsonb;
BEGIN
  IF p_client_uuid IS NULL THEN
    RAISE EXCEPTION 'client_uuid is required' USING ERRCODE = '22023';
  END IF;

  -- same checkout sent again: return the first result, change nothing
  SELECT * INTO v_existing FROM public.orders WHERE client_uuid = p_client_uuid;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id', v_existing.id, 'queue_number', v_existing.queue_number,
      'receipt_number', v_existing.receipt_number, 'subtotal_lak', v_existing.subtotal_lak,
      'discount_lak', v_existing.discount_amount, 'total_lak', v_existing.total_lak,
      'change_lak', v_existing.change_amount, 'status', v_existing.status, 'duplicate', true,
      'stock_warnings', '[]'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'shop not found' USING ERRCODE = 'P0002';
  END IF;
  -- a test bill skips stock, sales and the drawer count, so it is only accepted inside a test
  -- window a manager opened with a PIN (060); an offline bill replayed later is kept as a real sale
  IF v_test AND NOT EXISTS (
    SELECT 1 FROM public.pos_test_windows w
    WHERE w.shop_id = p_shop_id AND w.started_at <= v_created AND v_created < COALESCE(w.ended_at, w.ends_at)
  ) THEN
    IF NOT v_replay THEN
      RAISE EXCEPTION 'TEST_MODE_OFF' USING ERRCODE = '42501';
    END IF;
    v_test := false;
  END IF;
  IF v_employee IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.employees WHERE id = v_employee AND shop_id = p_shop_id AND is_active
  ) THEN
    IF NOT v_replay THEN
      RAISE EXCEPTION 'employee is not an active member of this shop' USING ERRCODE = '42501';
    END IF;
    v_employee := NULL;
  END IF;
  IF v_method NOT IN ('cash', 'qr', 'transfer', 'card', 'split') THEN
    RAISE EXCEPTION 'unknown payment method: %', p_payment_method USING ERRCODE = '22023';
  END IF;
  IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' OR jsonb_array_length(p_cart) = 0 THEN
    RAISE EXCEPTION 'cart is empty' USING ERRCODE = '22023';
  END IF;
  -- an offline bill keeps its real sale time only within 24 hours and inside the open
  -- drawer session (071); an older one waits on the POS for a manager
  IF v_replay AND (v_created < now() - interval '24 hours' OR v_created < COALESCE(
       (SELECT s.opened_at FROM public.cash_sessions s WHERE s.shop_id = p_shop_id AND s.status <> 'closed'),
       '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'SALE_TOO_OLD: sold %, more than 24 hours ago or before the open drawer session',
      to_char(v_created AT TIME ZONE 'Asia/Vientiane', 'YYYY-MM-DD HH24:MI') USING ERRCODE = '22023';
  END IF;

  SELECT extra_shot_price_lak INTO v_shot_price FROM public.shops WHERE id = p_shop_id;

  -- prices from the menu variants, never from the client
  FOR item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
    v_rid := NULLIF(item->>'recipe_id', '')::uuid;
    v_qty := (item->>'qty')::int;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN
      RAISE EXCEPTION 'invalid quantity' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.recipes
    WHERE id = v_rid AND (v_replay OR (COALESCE(is_active, true) AND NOT COALESCE(is_archived, false)));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'menu item not available: %', COALESCE(item->>'recipe_id', '?') USING ERRCODE = 'P0002';
    END IF;

    v_cust := COALESCE(item->>'customization', '');
    v_vid := NULLIF(item->>'variant_id', '')::uuid;
    IF v_vid IS NOT NULL THEN
      SELECT price_lak, is_active INTO v_price, v_vactive FROM public.menu_variants
      WHERE id = v_vid AND recipe_id = v_rid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'variant does not belong to this menu item' USING ERRCODE = '22023';
      END IF;
      IF NOT v_vactive AND NOT v_replay THEN
        RAISE EXCEPTION 'menu item not available: %', v_rid USING ERRCODE = 'P0002';
      END IF;
    ELSE
      -- a POS still running pre-072 code (or an offline bill saved by it) sends no variant:
      -- use the one price, else the hot/iced named in the note; drop once every POS runs 072 code
      SELECT v.id, v.price_lak INTO v_vid, v_price
      FROM public.menu_variants v
      WHERE v.recipe_id = v_rid AND (v.is_active OR v_replay)
      ORDER BY (v.kind = 'default' AND v.is_active) DESC,
               COALESCE(v.kind = CASE WHEN v_cust ~ '(เย็น|ເຢັນ|Iced)' THEN 'iced'
                                      WHEN v_cust ~ '(ร้อน|ຮ້ອນ|Hot)' THEN 'hot' END, false) DESC,
               v.is_active DESC, v.sort_order, v.price_lak
      LIMIT 1;
      IF v_vid IS NULL THEN
        RAISE EXCEPTION 'menu item not available: %', v_rid USING ERRCODE = 'P0002';
      END IF;
    END IF;

    v_sweet := lower(NULLIF(item->>'sweetness', ''));
    IF v_sweet IS NULL THEN
      v_sweet := CASE WHEN v_cust LIKE '%ไม่หวาน%' THEN 'none' WHEN v_cust LIKE '%หวานน้อย%' THEN 'less'
                      WHEN v_cust LIKE '%หวานมาก%' THEN 'more' ELSE 'normal' END;
    ELSIF v_sweet NOT IN ('none', 'less', 'normal', 'more') THEN
      RAISE EXCEPTION 'unknown sweetness: %', v_sweet USING ERRCODE = '22023';
    END IF;

    v_shots := COALESCE((item->>'extra_shots')::int, 0);
    IF v_shots < 0 OR v_shots > 9 THEN
      RAISE EXCEPTION 'extra shots must be 0 to 9' USING ERRCODE = '22023';
    END IF;
    IF v_shots > 0 AND v_shot_price IS NULL THEN
      IF NOT v_replay THEN
        RAISE EXCEPTION 'EXTRA_SHOT_NOT_SET' USING ERRCODE = '22023';
      END IF;
      v_shots := 0;
    END IF;
    v_price := v_price + v_shots * COALESCE(v_shot_price, 0);

    v_subtotal := v_subtotal + v_qty * v_price;
    v_lines := v_lines || jsonb_build_object('recipe_id', v_rid, 'variant_id', v_vid, 'qty', v_qty,
      'price', v_price, 'sweetness', v_sweet, 'extra_shots', v_shots, 'customization', NULLIF(v_cust, ''));
  END LOOP;

  IF v_discount < 0 OR v_discount > v_subtotal THEN
    RAISE EXCEPTION 'discount must be between 0 and the subtotal' USING ERRCODE = '22023';
  END IF;
  -- cap = 15% + the customer's VIP % (loyalty_settings, 070), then the POS rounds the amount
  -- to pay down to 500 or 1,000: allow the 1,000 rounding, the larger of the two
  IF v_discount > 0 THEN
    v_cap := round(v_subtotal * (15 + COALESCE((SELECT public.vip_discount_percent(p_shop_id, c.vip_tier)
                                                FROM public.customers c WHERE c.id = p_customer_id), 0)) / 100);
    v_cap := v_subtotal - GREATEST(floor((v_subtotal - v_cap) / 1000) * 1000, 0);
    IF v_discount > v_cap AND NOT EXISTS (SELECT 1 FROM public.pos_discount_approvals a
        WHERE a.client_uuid = p_client_uuid AND a.shop_id = p_shop_id AND a.max_discount_lak >= v_discount) THEN
      RAISE EXCEPTION 'DISCOUNT_NEEDS_PIN' USING ERRCODE = '42501', DETAIL = v_cap::text;
    END IF;
  END IF;
  v_total := v_subtotal - v_discount;

  IF v_replay AND p_expected_total IS DISTINCT FROM v_total THEN
    v_note := concat_ws(' · ', v_note, 'ออฟไลน์คิดเงิน ' || COALESCE(p_expected_total::text, '?') || ' ₭ ราคาระบบ ' || v_total || ' ₭');
  ELSIF p_expected_total IS NULL OR p_expected_total <> v_total THEN
    RAISE EXCEPTION 'PRICE_CHANGED' USING DETAIL = v_total::text,
      HINT = 'menu prices changed since the POS loaded; reload and try again';
  END IF;

  IF v_method = 'cash' THEN
    v_received := COALESCE(p_amount_received, 0);
    IF v_received < v_total AND NOT v_replay THEN
      RAISE EXCEPTION 'cash received is less than the total' USING ERRCODE = '22023';
    END IF;
    v_change := GREATEST(v_received - v_total, 0);
  ELSIF v_method = 'split' AND (p_split_cash IS NOT NULL OR p_split_transfer IS NOT NULL) THEN
    v_split := true;
    IF v_scash < 0 OR v_sxfer < 0 THEN
      RAISE EXCEPTION 'split parts must be 0 or more' USING ERRCODE = '22023';
    END IF;
    IF v_sxfer > v_total AND NOT v_replay THEN
      RAISE EXCEPTION 'the transfer part is more than the total' USING ERRCODE = '22023';
    END IF;
    IF v_scash + v_sxfer < v_total AND NOT v_replay THEN
      RAISE EXCEPTION 'the split payment is less than the total' USING ERRCODE = '22023';
    END IF;
    v_received := v_scash + v_sxfer;
    v_change := GREATEST(v_scash + v_sxfer - v_total, 0);
    v_xfer_part := LEAST(v_sxfer, v_total);
  ELSE
    v_received := NULLIF(p_amount_received, 0);
    v_change := NULL;
  END IF;

  -- queue + receipt numbers are counted across all shops (as before): one checkout at a time
  v_day := (v_created AT TIME ZONE 'Asia/Vientiane')::date;
  PERFORM pg_advisory_xact_lock(hashtext('alan_checkout'));
  -- an online sale is stamped after the lock, so a drawer count (which takes
  -- the same lock) never misses a sale that was still being saved
  IF NOT v_replay THEN
    v_created := clock_timestamp();
    v_day := (v_created AT TIME ZONE 'Asia/Vientiane')::date;
  END IF;

  -- the lock holder may find this checkout already saved by a concurrent call
  SELECT * INTO v_existing FROM public.orders WHERE client_uuid = p_client_uuid;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id', v_existing.id, 'queue_number', v_existing.queue_number,
      'receipt_number', v_existing.receipt_number, 'subtotal_lak', v_existing.subtotal_lak,
      'discount_lak', v_existing.discount_amount, 'total_lak', v_existing.total_lak,
      'change_lak', v_existing.change_amount, 'status', v_existing.status, 'duplicate', true,
      'stock_warnings', '[]'::jsonb);
  END IF;

  IF p_queue_number IS NOT NULL AND p_queue_number > 0 AND NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE queue_number = p_queue_number AND (created_at AT TIME ZONE 'Asia/Vientiane')::date = v_day
  ) THEN
    v_queue := p_queue_number;
  ELSE
    SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_queue
    FROM public.orders
    WHERE (created_at AT TIME ZONE 'Asia/Vientiane')::date = v_day
      AND queue_number < 900;
  END IF;

  SELECT to_char(v_day, 'YYYYMMDD') || '-' || lpad((count(*) + 1)::text, 4, '0') INTO v_receipt
  FROM public.orders WHERE receipt_number LIKE to_char(v_day, 'YYYYMMDD') || '-%';

  INSERT INTO public.orders (
    client_uuid, shop_id, staff_id, employee_id, customer_id,
    payment_method, payment_currency, amount_received, change_amount,
    discount_lak, discount_amount, discount_reason,
    subtotal_lak, total_lak, table_number, customer_name, staff_note,
    queue_number, queue_status, receipt_number, is_test, status, created_at
  ) VALUES (
    p_client_uuid, p_shop_id, 'ff000000-0000-0000-0000-000000000001', v_employee, p_customer_id,
    v_method, 'LAK', v_received, v_change,
    v_discount, v_discount, NULLIF(btrim(COALESCE(p_discount_reason, '')), ''),
    v_subtotal, v_total, NULLIF(btrim(COALESCE(p_table_number, '')), ''),
    NULLIF(btrim(COALESCE(p_customer_name, '')), ''), v_note,
    v_queue, 'waiting', v_receipt, v_test, CASE WHEN v_test THEN 'test' ELSE 'paid' END, v_created
  )
  RETURNING id INTO v_order_id;

  -- what the bill was paid with (net of change)
  IF v_split THEN
    IF LEAST(v_scash, v_total - v_xfer_part) > 0 THEN
      INSERT INTO public.order_payments (order_id, method, amount_lak, created_at)
      VALUES (v_order_id, 'cash', LEAST(v_scash, v_total - v_xfer_part), v_created);
    END IF;
    IF v_xfer_part > 0 THEN
      INSERT INTO public.order_payments (order_id, method, amount_lak, created_at)
      VALUES (v_order_id, 'transfer', v_xfer_part, v_created);
    END IF;
  ELSE
    INSERT INTO public.order_payments (order_id, method, amount_lak, created_at)
    VALUES (v_order_id, v_method, CASE WHEN v_method = 'cash' AND v_received < v_total THEN v_received ELSE v_total END, v_created);
  END IF;

  -- unit_cost_lak = ingredient cost at the time of sale, so later price changes leave old profit alone
  INSERT INTO public.order_items (order_id, recipe_id, variant_id, qty, unit_price_lak, customization,
                                  sweetness, extra_shots, unit_cost_lak)
  SELECT v_order_id, (l->>'recipe_id')::uuid, (l->>'variant_id')::uuid, (l->>'qty')::int, (l->>'price')::numeric,
         l->>'customization', l->>'sweetness', (l->>'extra_shots')::int,
         public.variant_unit_cost((l->>'variant_id')::uuid, l->>'sweetness', (l->>'extra_shots')::int)
  FROM jsonb_array_elements(v_lines) l;

  IF NOT v_test THEN
    -- low stock never stops a sale (owner decision 2026-11-13): it is reported back instead
    SELECT COALESCE(jsonb_agg(jsonb_build_object('inventory_id', i.id, 'name', COALESCE(i.name_th, i.name),
             'unit', i.unit, 'needed', u.qty, 'had', i.current_qty) ORDER BY i.name), '[]'::jsonb)
    INTO v_warnings
    FROM public.order_stock_usage(v_order_id) u
    JOIN public.inventory i ON i.id = u.inventory_id
    WHERE u.qty > 0 AND i.current_qty < u.qty AND COALESCE(i.is_active, true);

    UPDATE public.inventory i
    SET current_qty = i.current_qty - use.qty, updated_at = now()
    FROM public.order_stock_usage(v_order_id) use
    WHERE i.id = use.inventory_id;

    IF p_customer_id IS NOT NULL THEN
      UPDATE public.customers
      SET lifetime_spend_lak = COALESCE(lifetime_spend_lak, 0) + v_total,
          visit_count        = COALESCE(visit_count, 0) + 1,
          last_visit         = now(),
          updated_at         = now()
      WHERE id = p_customer_id;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (staff_id, action, table_name, row_id, after_data)
  VALUES ('ff000000-0000-0000-0000-000000000001', 'create_order', 'orders', v_order_id,
    jsonb_build_object('order_id', v_order_id, 'queue_number', v_queue, 'total_lak', v_total,
      'payment_method', v_method, 'employee_id', v_employee, 'is_test', v_test,
      'offline', v_replay, 'stock_warnings', v_warnings));

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'queue_number', v_queue, 'receipt_number', v_receipt,
    'subtotal_lak', v_subtotal, 'discount_lak', v_discount, 'total_lak', v_total,
    'change_lak', v_change, 'status', CASE WHEN v_test THEN 'test' ELSE 'paid' END, 'duplicate', false,
    'stock_warnings', v_warnings);
END;
$function$;

-- 6) void gives back what checkout cut (053 skipped base recipes and sweetness) -----------
DO $void$
DECLARE
  v_def text;
  v_old text := current_setting('alan.m072_void_old');
  v_new text := replace($n$    FROM public.order_stock_usage(p_order_id) restore$n$, E'\r', '');
BEGIN
  -- 053 was saved from Windows (CRLF line ends); compare and re-create with LF only
  SELECT replace(pg_get_functiondef(p.oid), E'\r', '') INTO v_def FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'void_order_with_approval';
  IF position(v_new IN v_def) > 0 THEN
    RETURN;
  END IF;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION '072: void_order_with_approval does not look like the 053 version, nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END
$void$;
