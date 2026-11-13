-- ============================================================
--  Test for migration 059 (set 1, task C: cash drawer / close shift)
--
--  CHANGES NOTHING. The whole file is ONE DO block that always ends in
--  an error ("059 TEST RESULTS ..."), so Postgres rolls everything back:
--  new tables, functions, test employees, test sales, sessions, the
--  cash book clean-up and every Telegram message queued during the test
--  (pg_net only sends after a commit, and nothing is committed).
--  Every line of the report should start with PASS.
--  No BEGIN/ROLLBACK needed (the SQL Editor does not keep a BEGIN open).
--
--  It adds, all rolled back: one throw-away sign-in (auth.users row, no
--  email or password), two test employees with PINs 7391 (cashier) and
--  8264 (manager), a few test sales. The Telegram "large order" trigger is
--  switched off first inside the block.
--  The whole test runs inside one transaction, so now() never moves; the
--  test moves the session start 1 second back where a real shop would
--  simply have opened earlier, and stamps one void with the clock time
--  (T15) where a real void would simply happen later.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor) as postgres:
--  paste the whole file, Run, copy the error text back.
--  The migration part is a generated copy of
--  supabase/migrations/059_c_cash_drawer_close_shift.sql -- keep in sync.
-- ============================================================

DO $test$
DECLARE
  c_shop constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_cash_pin constant text := '7391';
  c_mgr_pin  constant text := '8264';
  report text := '';
  v_owner uuid; v_stranger uuid := gen_random_uuid();
  v_cashier uuid; v_mgr uuid;
  v_recipe uuid; v_price numeric;
  v_n int; v_n2 int; v_num numeric;
  v_orders_md5 text; v_cf_test int; v_orders int;
  v_res jsonb; v_res2 jsonb; v_res3 jsonb; v_order uuid; v_void_order uuid; v_late uuid;
  v_txt text; v_txt2 text; v_txt3 text;
  v_err text;
BEGIN
  SELECT user_id INTO v_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active IS TRUE AND user_id IS NOT NULL ORDER BY user_id LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION '059 TEST: the real shop has no active owner account'; END IF;
  IF EXISTS (SELECT 1 FROM public.employees WHERE shop_id = c_shop AND is_active
             AND (pin_hash = extensions.crypt(c_cash_pin, pin_hash) OR pin_hash = extensions.crypt(c_mgr_pin, pin_hash))) THEN
    RAISE EXCEPTION '059 TEST: a real employee uses PIN % or % -- change c_cash_pin / c_mgr_pin at the top and run again', c_cash_pin, c_mgr_pin;
  END IF;
  SELECT id, price_lak INTO v_recipe, v_price FROM public.recipes
   WHERE COALESCE(is_active, true) AND NOT COALESCE(is_archived, false) AND price_lak > 0
   ORDER BY created_at, id LIMIT 1;
  IF v_recipe IS NULL THEN RAISE EXCEPTION '059 TEST: no active menu item to sell'; END IF;

  INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_stranger, 'authenticated', 'authenticated', now(), now());
  ALTER TABLE public.orders DISABLE TRIGGER trg_large_order_telegram;

  SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t.id), '')), count(*) INTO v_orders_md5, v_orders FROM public.orders t;
  SELECT count(*) INTO v_cf_test FROM public.cash_flow cf JOIN public.orders o ON o.id = cf.reference_id
   WHERE o.status = 'test' OR COALESCE(o.is_test, false);

  -- ---- body of 059 ----
  -- 1) tables ---------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS public.order_payments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    method      text NOT NULL CHECK (method IN ('cash', 'transfer', 'qr', 'card', 'split')),
    amount_lak  numeric NOT NULL CHECK (amount_lak >= 0),
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS order_payments_order_idx ON public.order_payments (order_id);
  COMMENT ON TABLE public.order_payments IS
    'What a bill was paid with, one row per part (net of change). method split = an old split bill whose parts were never recorded.';

  CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id           uuid NOT NULL REFERENCES public.shops(id),
    status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'counted', 'closed')),
    opened_at         timestamptz NOT NULL DEFAULT now(),
    opened_by         uuid REFERENCES public.employees(id),
    carried_over_lak  numeric,
    opening_cash_lak  numeric NOT NULL CHECK (opening_cash_lak >= 0),
    opening_reason    text,
    window_start      timestamptz NOT NULL,
    counted_at        timestamptz,
    counted_by        uuid REFERENCES public.employees(id),
    counted_cash_lak  numeric CHECK (counted_cash_lak >= 0),
    cash_sales_lak    numeric,
    paid_out_lak      numeric,
    paid_in_lak       numeric,
    expected_cash_lak numeric,
    difference_lak    numeric,
    diff_reason       text,
    recounts          int NOT NULL DEFAULT 0,
    closed_at         timestamptz,
    closed_by         uuid REFERENCES public.employees(id),
    checked_by        uuid REFERENCES public.employees(id),
    no_checker        boolean
  );
  CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_active
    ON public.cash_sessions (shop_id) WHERE status <> 'closed';
  CREATE INDEX IF NOT EXISTS cash_sessions_closed_idx ON public.cash_sessions (shop_id, closed_at DESC);
  COMMENT ON TABLE public.cash_sessions IS
    'One cash drawer session (open -> counted -> closed). It covers every sale after the previous count (window_start) up to its own count.';

  CREATE TABLE IF NOT EXISTS public.cash_movements (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   uuid NOT NULL REFERENCES public.cash_sessions(id),
    shop_id      uuid NOT NULL REFERENCES public.shops(id),
    kind         text NOT NULL CHECK (kind IN ('paid_out', 'paid_in')),
    amount_lak   numeric NOT NULL CHECK (amount_lak > 0),
    category     text NOT NULL,
    note         text,
    employee_id  uuid REFERENCES public.employees(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    voided_at    timestamptz,
    voided_by    uuid REFERENCES public.employees(id),
    void_reason  text
  );
  CREATE INDEX IF NOT EXISTS cash_movements_session_idx ON public.cash_movements (session_id);

  -- a copy of the cash-book rows section 11 removes (old test bills)
  CREATE TABLE IF NOT EXISTS public.cash_flow_removed_059 (LIKE public.cash_flow);
  ALTER TABLE public.cash_flow_removed_059 ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.cash_flow_removed_059 FROM PUBLIC, anon, authenticated;

  ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.cash_sessions  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.order_payments, public.cash_sessions, public.cash_movements FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.order_payments, public.cash_sessions, public.cash_movements TO authenticated;
  GRANT ALL ON public.order_payments, public.cash_sessions, public.cash_movements TO service_role;
  DROP POLICY IF EXISTS c_order_payments_owner_read ON public.order_payments;
  CREATE POLICY c_order_payments_owner_read ON public.order_payments
    FOR SELECT TO authenticated USING (public.real_shop_role_in(ARRAY['owner']));
  DROP POLICY IF EXISTS c_cash_sessions_owner_read ON public.cash_sessions;
  CREATE POLICY c_cash_sessions_owner_read ON public.cash_sessions
    FOR SELECT TO authenticated USING (public.real_shop_role_in(ARRAY['owner']));
  DROP POLICY IF EXISTS c_cash_movements_owner_read ON public.cash_movements;
  CREATE POLICY c_cash_movements_owner_read ON public.cash_movements
    FOR SELECT TO authenticated USING (public.real_shop_role_in(ARRAY['owner']));

  -- every existing bill gets its payment row (old split bills: parts unknown)
  INSERT INTO public.order_payments (order_id, method, amount_lak, created_at)
  SELECT o.id,
         CASE WHEN lower(COALESCE(o.payment_method, 'cash')) IN ('cash', 'transfer', 'qr', 'card', 'split')
              THEN lower(COALESCE(o.payment_method, 'cash')) ELSE 'cash' END,
         GREATEST(COALESCE(o.total_lak, 0), 0), o.created_at
  FROM public.orders o
  WHERE NOT EXISTS (SELECT 1 FROM public.order_payments p WHERE p.order_id = o.id);

  -- 2) small helpers (not callable from the app) -----------------------------
  -- Telegram must never stop a sale or a close: any failure is swallowed
  CREATE OR REPLACE FUNCTION public.cash_notify(p_text text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  BEGIN
    BEGIN
      PERFORM public.notify_telegram(p_text, 'cash');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END
  $fn$;

  CREATE OR REPLACE FUNCTION public.cash_fmt(p numeric)
  RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
    SELECT CASE WHEN p < 0 THEN '-' ELSE '' END || to_char(abs(COALESCE(p, 0)), 'FM999,999,999,990')
  $fn$;

  -- Checks a 4-digit PIN of an active employee of the shop (p_manager: role
  -- manager only). Wrong PINs count towards a lock (5 fails -> 60 s, doubling
  -- up to 30 min). Staff PINs: counter 'cash:<shop>', any right PIN resets
  -- it (same as the PIN pad, so staff typos never pile up). Manager PINs:
  -- the voiding counter 'void:<shop>' (053), reset only by a manager PIN.
  -- Returns {id, name} or {error: invalid_pin | locked, wait}.
  -- The caller must NOT raise after a failed PIN (it would undo the count).
  CREATE OR REPLACE FUNCTION public.cash_check_pin(p_shop_id uuid, p_pin text, p_manager boolean)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    v_scope text := CASE WHEN p_manager THEN 'void:' ELSE 'cash:' END || p_shop_id::text;
    v_wait  int;
    v_id    uuid;
    v_name  text;
  BEGIN
    v_wait := public.pin_attempt_wait(v_scope);
    IF v_wait > 0 THEN
      RETURN jsonb_build_object('error', 'locked', 'wait', v_wait);
    END IF;
    SELECT e.id, e.name INTO v_id, v_name
    FROM public.employees e
    WHERE e.shop_id = p_shop_id AND e.is_active = true
      AND (NOT p_manager OR e.role = 'manager')
      AND COALESCE(p_pin, '') ~ '^[0-9]{4}$'
      AND e.pin_hash = extensions.crypt(p_pin, e.pin_hash)
    LIMIT 1;
    PERFORM public.pin_attempt_record(v_scope, v_id IS NOT NULL, 5, 60, 1800);
    IF v_id IS NULL THEN
      RETURN jsonb_build_object('error', 'invalid_pin');
    END IF;
    RETURN jsonb_build_object('id', v_id, 'name', v_name);
  END
  $fn$;

  -- sales of a shop between two moments (test bills never):
  --   sold    = bills made in the window that were paid at its end (a bill
  --             voided later still counts here: the cash was in the drawer)
  --   refunds = bills made before the window and voided inside it (the cash
  --             part goes back out of this drawer)
  --   a bill made and voided in the same window counts in neither
  --   bills with no shop_id belong to the real shop (as in 053 / 055)
  CREATE OR REPLACE FUNCTION public.cash_sales_between(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
  RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    WITH o AS (
      SELECT id, total_lak,
             (created_at > p_from AND created_at <= p_to
              AND (status = 'paid' OR (status = 'void' AND voided_at > p_to))) AS sold,
             (status = 'void' AND created_at <= p_from AND voided_at > p_from AND voided_at <= p_to) AS refund,
             (status = 'void' AND ((voided_at > p_from AND voided_at <= p_to)
                                   OR (voided_at IS NULL AND created_at > p_from AND created_at <= p_to))) AS voided_here
      FROM public.orders
      WHERE COALESCE(shop_id, '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid) = p_shop_id
        AND NOT COALESCE(is_test, false) AND status IN ('paid', 'void')
        AND (created_at > p_from OR voided_at > p_from)
    ), pay AS (
      SELECT p.method, count(DISTINCT p.order_id) AS bills, sum(p.amount_lak) AS amount
      FROM public.order_payments p JOIN o ON o.id = p.order_id AND o.sold
      GROUP BY p.method
    ), ref AS (
      SELECT count(DISTINCT o.id) AS bills, COALESCE(sum(p.amount_lak), 0) AS cash
      FROM o LEFT JOIN public.order_payments p ON p.order_id = o.id AND p.method = 'cash'
      WHERE o.refund
    )
    SELECT jsonb_build_object(
      'by_method', COALESCE((SELECT jsonb_object_agg(method, jsonb_build_object('bills', bills, 'amount', amount)) FROM pay), '{}'::jsonb),
      'bills',     (SELECT count(*) FROM o WHERE sold),
      'total',     (SELECT COALESCE(sum(total_lak), 0) FROM o WHERE sold),
      'cash_sold', COALESCE((SELECT amount FROM pay WHERE method = 'cash'), 0),
      'refund_bills', (SELECT bills FROM ref),
      'refund_cash',  (SELECT cash FROM ref),
      'cash',      COALESCE((SELECT amount FROM pay WHERE method = 'cash'), 0) - (SELECT cash FROM ref),
      'void_bills', (SELECT count(*) FROM o WHERE voided_here),
      'void_total', (SELECT COALESCE(sum(total_lak), 0) FROM o WHERE voided_here))
  $fn$;

  REVOKE ALL ON FUNCTION public.cash_notify(text), public.cash_check_pin(uuid, text, boolean),
    public.cash_sales_between(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

  -- 3) what the POS shows (no expected cash before the blind count) ---------
  CREATE OR REPLACE FUNCTION public.cash_session_state(p_shop_id uuid)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    s      public.cash_sessions%ROWTYPE;
    v_last public.cash_sessions%ROWTYPE;
    v_sales jsonb;
  BEGIN
    SELECT * INTO s FROM public.cash_sessions WHERE shop_id = p_shop_id AND status <> 'closed';
    IF NOT FOUND THEN
      SELECT * INTO v_last FROM public.cash_sessions
      WHERE shop_id = p_shop_id AND status = 'closed' ORDER BY closed_at DESC LIMIT 1;
      RETURN jsonb_build_object('session', NULL,
        'carried_over', v_last.counted_cash_lak,
        'carried_from', CASE WHEN v_last.id IS NULL THEN NULL ELSE jsonb_build_object(
          'counted_at', v_last.counted_at,
          'counted_by', (SELECT name FROM public.employees WHERE id = v_last.counted_by)) END);
    END IF;
    v_sales := public.cash_sales_between(p_shop_id, s.window_start, COALESCE(s.counted_at, now()));
    RETURN jsonb_build_object(
      'session', jsonb_build_object(
        'id', s.id, 'status', s.status, 'opened_at', s.opened_at,
        'opened_by', (SELECT name FROM public.employees WHERE id = s.opened_by),
        'opening_cash', s.opening_cash_lak, 'carried_over', s.carried_over_lak,
        'opening_reason', s.opening_reason,
        'counted_at', s.counted_at,
        'counted_by', (SELECT name FROM public.employees WHERE id = s.counted_by)),
      'movements', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'amount', m.amount_lak,
                 'category', m.category, 'note', m.note, 'at', m.created_at,
                 'by', (SELECT name FROM public.employees WHERE id = m.employee_id))
               ORDER BY m.created_at)
        FROM public.cash_movements m WHERE m.session_id = s.id AND m.voided_at IS NULL), '[]'::jsonb),
      -- before the count: bill counts for every type, amounts only for non-cash
      'sales', CASE WHEN s.status = 'open'
        THEN jsonb_build_object('bills', v_sales->'bills', 'void_bills', v_sales->'void_bills',
               'refund_bills', v_sales->'refund_bills',
               'by_method', (SELECT COALESCE(jsonb_object_agg(k, CASE WHEN k = 'cash' THEN jsonb_build_object('bills', v->'bills') ELSE v END), '{}'::jsonb)
                             FROM jsonb_each(v_sales->'by_method') AS e(k, v)))
        ELSE v_sales END,
      'result', CASE WHEN s.status = 'open' THEN NULL ELSE jsonb_build_object(
        'counted', s.counted_cash_lak, 'expected', s.expected_cash_lak, 'difference', s.difference_lak,
        'cash_sales', s.cash_sales_lak, 'paid_out', s.paid_out_lak, 'paid_in', s.paid_in_lak,
        'recounts', s.recounts) END);
  END
  $fn$;

  -- 4) open the drawer -------------------------------------------------------
  CREATE OR REPLACE FUNCTION public.cash_session_open(p_shop_id uuid, p_pin text, p_opening_cash numeric, p_reason text DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    v_last    public.cash_sessions%ROWTYPE;
    v_reason  text := NULLIF(btrim(COALESCE(p_reason, '')), '');
    v_who     jsonb;
    v_id      uuid;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
      RAISE EXCEPTION 'shop not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_opening_cash IS NULL OR p_opening_cash < 0 THEN
      RAISE EXCEPTION 'opening cash must be 0 or more' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('cash_session:' || p_shop_id::text));
    IF EXISTS (SELECT 1 FROM public.cash_sessions WHERE shop_id = p_shop_id AND status <> 'closed') THEN
      RAISE EXCEPTION 'SESSION_ALREADY_OPEN' USING ERRCODE = '55000';
    END IF;
    SELECT * INTO v_last FROM public.cash_sessions
    WHERE shop_id = p_shop_id AND status = 'closed' ORDER BY closed_at DESC LIMIT 1;
    IF v_last.id IS NOT NULL AND p_opening_cash <> v_last.counted_cash_lak AND v_reason IS NULL THEN
      RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023',
        DETAIL = v_last.counted_cash_lak::text, HINT = 'the opening cash differs from the last count';
    END IF;

    v_who := public.cash_check_pin(p_shop_id, p_pin, false);
    IF v_who ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_who; END IF;

    INSERT INTO public.cash_sessions (shop_id, opened_by, carried_over_lak, opening_cash_lak, opening_reason, window_start)
    VALUES (p_shop_id, (v_who->>'id')::uuid, v_last.counted_cash_lak, p_opening_cash, v_reason,
            COALESCE(v_last.counted_at, now()))
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('ok', true, 'session_id', v_id, 'opened_by', v_who->>'name');
  END
  $fn$;

  -- 5) money paid out of / put into the drawer during the shift --------------
  CREATE OR REPLACE FUNCTION public.cash_movement_add(p_shop_id uuid, p_pin text, p_kind text, p_amount numeric, p_category text, p_note text DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    v_session uuid;
    v_cat     text := NULLIF(btrim(COALESCE(p_category, '')), '');
    v_who     jsonb;
    v_id      uuid;
  BEGIN
    IF p_kind NOT IN ('paid_out', 'paid_in') THEN
      RAISE EXCEPTION 'unknown kind: %', p_kind USING ERRCODE = '22023';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
      RAISE EXCEPTION 'amount must be more than 0' USING ERRCODE = '22023';
    END IF;
    IF v_cat IS NULL THEN
      RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_session FROM public.cash_sessions WHERE shop_id = p_shop_id AND status = 'open' FOR UPDATE;
    IF v_session IS NULL THEN
      RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE = '55000';
    END IF;

    v_who := public.cash_check_pin(p_shop_id, p_pin, false);
    IF v_who ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_who; END IF;

    INSERT INTO public.cash_movements (session_id, shop_id, kind, amount_lak, category, note, employee_id)
    VALUES (v_session, p_shop_id, p_kind, p_amount, v_cat, NULLIF(btrim(COALESCE(p_note, '')), ''), (v_who->>'id')::uuid)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'by', v_who->>'name');
  END
  $fn$;

  CREATE OR REPLACE FUNCTION public.cash_movement_void(p_shop_id uuid, p_movement_id uuid, p_manager_pin text, p_reason text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    m        public.cash_movements%ROWTYPE;
    v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
    v_mgr    jsonb;
  BEGIN
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.cash_sessions WHERE shop_id = p_shop_id AND status = 'open' FOR UPDATE;
    SELECT * INTO m FROM public.cash_movements WHERE id = p_movement_id AND shop_id = p_shop_id FOR UPDATE;
    IF NOT FOUND OR m.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'movement not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cash_sessions WHERE id = m.session_id AND status = 'open') THEN
      RAISE EXCEPTION 'the drawer was already counted' USING ERRCODE = '55000';
    END IF;

    v_mgr := public.cash_check_pin(p_shop_id, p_manager_pin, true);
    IF v_mgr ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_mgr; END IF;

    UPDATE public.cash_movements
    SET voided_at = now(), voided_by = (v_mgr->>'id')::uuid, void_reason = v_reason
    WHERE id = m.id;
    PERFORM public.cash_notify(format(E'<b>มีการใช้ PIN ผู้จัดการ</b>\nยกเลิกรายการ%s %s ₭ (%s)\nผู้จัดการ %s · %s · เหตุผล: %s',
      CASE m.kind WHEN 'paid_out' THEN 'จ่ายออก' ELSE 'ใส่เงินเข้า' END, public.cash_fmt(m.amount_lak), m.category,
      v_mgr->>'name', to_char(now() AT TIME ZONE 'Asia/Vientiane', 'DD/MM HH24:MI'), v_reason));
    RETURN jsonb_build_object('ok', true);
  END
  $fn$;

  -- 6) blind count: the counted cash goes in first, then the expected amount is shown
  CREATE OR REPLACE FUNCTION public.cash_session_compute(p_session_id uuid, p_counted numeric, p_at timestamptz)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    s       public.cash_sessions%ROWTYPE;
    v_sales jsonb;
    v_out   numeric;
    v_in    numeric;
    v_exp   numeric;
  BEGIN
    SELECT * INTO s FROM public.cash_sessions WHERE id = p_session_id;
    v_sales := public.cash_sales_between(s.shop_id, s.window_start, p_at);
    SELECT COALESCE(sum(amount_lak) FILTER (WHERE kind = 'paid_out'), 0),
           COALESCE(sum(amount_lak) FILTER (WHERE kind = 'paid_in'), 0)
      INTO v_out, v_in
    FROM public.cash_movements WHERE session_id = s.id AND voided_at IS NULL;
    v_exp := s.opening_cash_lak + (v_sales->>'cash')::numeric - v_out + v_in;
    RETURN jsonb_build_object('sales', v_sales, 'cash_sales', (v_sales->>'cash')::numeric,
      'paid_out', v_out, 'paid_in', v_in, 'expected', v_exp, 'difference', p_counted - v_exp);
  END
  $fn$;
  REVOKE ALL ON FUNCTION public.cash_session_compute(uuid, numeric, timestamptz) FROM PUBLIC, anon, authenticated;

  CREATE OR REPLACE FUNCTION public.cash_session_count(p_shop_id uuid, p_pin text, p_counted numeric)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    s     public.cash_sessions%ROWTYPE;
    v_who jsonb;
    v_now timestamptz;
    c     jsonb;
  BEGIN
    IF p_counted IS NULL OR p_counted < 0 THEN
      RAISE EXCEPTION 'counted cash must be 0 or more' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO s FROM public.cash_sessions WHERE shop_id = p_shop_id AND status <> 'closed' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NO_OPEN_SESSION' USING ERRCODE = '55000';
    END IF;
    IF s.status <> 'open' THEN
      RAISE EXCEPTION 'ALREADY_COUNTED' USING ERRCODE = '55000', HINT = 'a recount needs a manager PIN';
    END IF;

    v_who := public.cash_check_pin(p_shop_id, p_pin, false);
    IF v_who ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_who; END IF;

    -- a sale being saved right now finishes first (checkout_order holds this
    -- lock and stamps an online sale after taking it), so every online sale
    -- is either in this count or after it
    PERFORM pg_advisory_xact_lock(hashtext('alan_checkout'));
    v_now := clock_timestamp();
    c := public.cash_session_compute(s.id, p_counted, v_now);
    UPDATE public.cash_sessions SET
      status = 'counted', counted_at = v_now, counted_by = (v_who->>'id')::uuid,
      counted_cash_lak = p_counted, cash_sales_lak = (c->>'cash_sales')::numeric,
      paid_out_lak = (c->>'paid_out')::numeric, paid_in_lak = (c->>'paid_in')::numeric,
      expected_cash_lak = (c->>'expected')::numeric, difference_lak = (c->>'difference')::numeric
    WHERE id = s.id;
    RETURN jsonb_build_object('ok', true, 'session_id', s.id, 'counted', p_counted, 'counted_by', v_who->>'name') || c;
  END
  $fn$;

  -- a counted drawer can only be counted again with a manager PIN
  CREATE OR REPLACE FUNCTION public.cash_session_recount(p_shop_id uuid, p_manager_pin text, p_counted numeric)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    s     public.cash_sessions%ROWTYPE;
    v_mgr jsonb;
    c     jsonb;
  BEGIN
    IF p_counted IS NULL OR p_counted < 0 THEN
      RAISE EXCEPTION 'counted cash must be 0 or more' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO s FROM public.cash_sessions WHERE shop_id = p_shop_id AND status = 'counted' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_COUNTED' USING ERRCODE = '55000';
    END IF;

    v_mgr := public.cash_check_pin(p_shop_id, p_manager_pin, true);
    IF v_mgr ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_mgr; END IF;

    c := public.cash_session_compute(s.id, p_counted, s.counted_at);
    UPDATE public.cash_sessions SET
      counted_cash_lak = p_counted, cash_sales_lak = (c->>'cash_sales')::numeric,
      paid_out_lak = (c->>'paid_out')::numeric, paid_in_lak = (c->>'paid_in')::numeric,
      expected_cash_lak = (c->>'expected')::numeric, difference_lak = (c->>'difference')::numeric,
      recounts = recounts + 1
    WHERE id = s.id;
    PERFORM public.cash_notify(format(E'<b>มีการใช้ PIN ผู้จัดการ</b>\nนับเงินซ้ำ: เดิม %s ใหม่ %s ₭ (ควรมี %s)\nผู้จัดการ %s · %s',
      public.cash_fmt(s.counted_cash_lak), public.cash_fmt(p_counted), public.cash_fmt((c->>'expected')::numeric),
      v_mgr->>'name', to_char(now() AT TIME ZONE 'Asia/Vientiane', 'DD/MM HH24:MI')));
    RETURN jsonb_build_object('ok', true, 'session_id', s.id, 'counted', p_counted, 'checked_by', v_mgr->>'name') || c;
  END
  $fn$;

  -- 7) close: staff PIN always; manager PIN = second person; without it =
  --    closed alone ("no checker")
  DROP FUNCTION IF EXISTS public.cash_session_close(uuid, text, text);
  CREATE OR REPLACE FUNCTION public.cash_session_close(p_shop_id uuid, p_pin text, p_diff_reason text, p_manager_pin text DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    s         public.cash_sessions%ROWTYPE;
    v_reason  text := NULLIF(btrim(COALESCE(p_diff_reason, '')), '');
    v_alone   boolean := NULLIF(btrim(COALESCE(p_manager_pin, '')), '') IS NULL;
    v_who     jsonb;
    v_mgr     jsonb;
    v_checker uuid;
    v_counter text;
    v_now     timestamptz := now();
    v_sales   jsonb;
  BEGIN
    SELECT * INTO s FROM public.cash_sessions WHERE shop_id = p_shop_id AND status = 'counted' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_COUNTED' USING ERRCODE = '55000', HINT = 'count the cash first';
    END IF;
    IF s.difference_lak <> 0 AND v_reason IS NULL THEN
      RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023', DETAIL = s.difference_lak::text;
    END IF;

    v_who := public.cash_check_pin(p_shop_id, p_pin, false);
    IF v_who ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_who; END IF;
    IF NOT v_alone THEN
      v_mgr := public.cash_check_pin(p_shop_id, p_manager_pin, true);
      IF v_mgr ? 'error' THEN RETURN jsonb_build_object('ok', false) || v_mgr; END IF;
      v_checker := (v_mgr->>'id')::uuid;
      IF v_checker = s.counted_by OR v_checker = (v_who->>'id')::uuid THEN
        RETURN jsonb_build_object('ok', false, 'error', 'same_person');
      END IF;
    END IF;

    UPDATE public.cash_sessions SET
      status = 'closed', closed_at = v_now, diff_reason = v_reason,
      closed_by = (v_who->>'id')::uuid, checked_by = v_checker, no_checker = v_alone
    WHERE id = s.id;

    SELECT name INTO v_counter FROM public.employees WHERE id = s.counted_by;
    IF s.difference_lak <> 0 OR v_alone THEN
      PERFORM public.cash_notify(format(E'<b>ปิดกะ: %s</b>\nคนนับ %s · %s · %s\nควรมี %s นับได้ %s%s',
        CASE WHEN s.difference_lak < 0 THEN 'เงินขาด ' || public.cash_fmt(-s.difference_lak) || ' ₭'
             WHEN s.difference_lak > 0 THEN 'เงินเกิน ' || public.cash_fmt(s.difference_lak) || ' ₭'
             ELSE 'ยอดตรง' END,
        v_counter, CASE WHEN v_alone THEN 'ไม่มีผู้ตรวจ' ELSE 'ผู้ตรวจ ' || (v_mgr->>'name') END,
        to_char(v_now AT TIME ZONE 'Asia/Vientiane', 'DD/MM HH24:MI'),
        public.cash_fmt(s.expected_cash_lak), public.cash_fmt(s.counted_cash_lak),
        CASE WHEN v_reason IS NULL THEN '' ELSE E'\nเหตุผล: ' || v_reason END));
    END IF;

    v_sales := public.cash_sales_between(p_shop_id, s.window_start, s.counted_at);
    RETURN jsonb_build_object('ok', true, 'session_id', s.id,
      'opened_at', s.opened_at, 'opened_by', (SELECT name FROM public.employees WHERE id = s.opened_by),
      'window_start', s.window_start, 'counted_at', s.counted_at, 'closed_at', v_now,
      'carried_over', s.carried_over_lak, 'opening_cash', s.opening_cash_lak, 'opening_reason', s.opening_reason,
      'sales', v_sales, 'cash_sales', s.cash_sales_lak, 'paid_out', s.paid_out_lak, 'paid_in', s.paid_in_lak,
      'movements', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', kind, 'amount', amount_lak, 'category', category, 'note', note) ORDER BY created_at)
                    FROM public.cash_movements WHERE session_id = s.id AND voided_at IS NULL), '[]'::jsonb),
      'expected', s.expected_cash_lak, 'counted', s.counted_cash_lak, 'difference', s.difference_lak,
      'diff_reason', v_reason, 'recounts', s.recounts,
      'counted_by', v_counter, 'closed_by', v_who->>'name', 'checked_by', v_mgr->>'name', 'no_checker', v_alone);
  END
  $fn$;

  -- 8) reports for the owner (back office, signed in) + weekly Telegram -------
  CREATE OR REPLACE FUNCTION public.cash_session_report(p_from date, p_to date)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  BEGIN
    PERFORM public.require_real_shop_role(ARRAY['owner']);
    RETURN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'opened_at', s.opened_at, 'counted_at', s.counted_at, 'closed_at', s.closed_at,
        'counted_by', ec.name, 'checked_by', ek.name, 'no_checker', s.no_checker,
        'opening_cash', s.opening_cash_lak, 'carried_over', s.carried_over_lak, 'opening_reason', s.opening_reason,
        'cash_sales', s.cash_sales_lak, 'paid_out', s.paid_out_lak, 'paid_in', s.paid_in_lak,
        'expected', s.expected_cash_lak, 'counted', s.counted_cash_lak, 'difference', s.difference_lak,
        'diff_reason', s.diff_reason, 'recounts', s.recounts,
        'movements', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', m.kind, 'amount', m.amount_lak,
                       'category', m.category, 'note', m.note, 'at', m.created_at,
                       'voided', m.voided_at IS NOT NULL) ORDER BY m.created_at)
                     FROM public.cash_movements m WHERE m.session_id = s.id), '[]'::jsonb))
        ORDER BY s.closed_at)
      FROM public.cash_sessions s
      LEFT JOIN public.employees ec ON ec.id = s.counted_by
      LEFT JOIN public.employees ek ON ek.id = s.checked_by
      WHERE s.status = 'closed'
        AND (s.closed_at AT TIME ZONE 'Asia/Vientiane')::date BETWEEN p_from AND p_to), '[]'::jsonb);
  END
  $fn$;

  -- the 7 days up to and including today (Laos time); meant to run Sunday evening
  CREATE OR REPLACE FUNCTION public.cash_week_report_send()
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    v_to    date := (now() AT TIME ZONE 'Asia/Vientiane')::date;
    v_from  date := v_to - 6;
    v_text  text;
  BEGIN
    SELECT format(E'<b>สรุปเงินขาด/เกิน %s - %s</b>\nปิดกะ %s ครั้ง · ขาดรวม %s · เกินรวม %s\n%s\nไม่มีผู้ตรวจ %s กะ',
        to_char(v_from, 'DD/MM'), to_char(v_to, 'DD/MM'),
        count(*), public.cash_fmt(COALESCE(sum(LEAST(difference_lak, 0)), 0)),
        public.cash_fmt(COALESCE(sum(GREATEST(difference_lak, 0)), 0)),
        COALESCE((SELECT string_agg(format('%s %s (%s กะ)', COALESCE(e.name, '?'), public.cash_fmt(x.net), x.n), ' · ' ORDER BY x.net)
                  FROM (SELECT counted_by, sum(difference_lak) AS net, count(*) AS n FROM public.cash_sessions
                        WHERE status = 'closed' AND (closed_at AT TIME ZONE 'Asia/Vientiane')::date BETWEEN v_from AND v_to
                        GROUP BY counted_by) x
                  LEFT JOIN public.employees e ON e.id = x.counted_by), 'ไม่มีการปิดกะ'),
        count(*) FILTER (WHERE no_checker))
      INTO v_text
    FROM public.cash_sessions
    WHERE status = 'closed' AND (closed_at AT TIME ZONE 'Asia/Vientiane')::date BETWEEN v_from AND v_to;
    PERFORM public.cash_notify(v_text);
    RETURN v_text;
  END
  $fn$;

  -- 9) Telegram on every void (whatever screen voided it) ----------------------
  CREATE OR REPLACE FUNCTION public.trg_fn_order_void_telegram()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  BEGIN
    IF NEW.status = 'void' AND OLD.status IS DISTINCT FROM 'void' AND NOT COALESCE(NEW.is_test, false) THEN
      PERFORM public.cash_notify(format(E'<b>ยกเลิกบิล #%s · %s ₭</b>\nอนุมัติโดย %s · %s\nเหตุผล: %s',
        COALESCE(NEW.queue_number::text, '?'), public.cash_fmt(NEW.total_lak),
        COALESCE((SELECT name FROM public.employees WHERE id = NEW.voided_by_employee_id), '?'),
        to_char(COALESCE(NEW.voided_at, now()) AT TIME ZONE 'Asia/Vientiane', 'DD/MM HH24:MI'),
        COALESCE(NEW.void_reason, '-')));
    END IF;
    RETURN NEW;
  END
  $fn$;
  DROP TRIGGER IF EXISTS trg_order_void_telegram ON public.orders;
  CREATE TRIGGER trg_order_void_telegram AFTER UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_order_void_telegram();

  REVOKE ALL ON FUNCTION public.cash_week_report_send(), public.trg_fn_order_void_telegram() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.cash_week_report_send() TO service_role;
  REVOKE ALL ON FUNCTION public.cash_session_state(uuid), public.cash_session_open(uuid, text, numeric, text),
    public.cash_movement_add(uuid, text, text, numeric, text, text), public.cash_movement_void(uuid, uuid, text, text),
    public.cash_session_count(uuid, text, numeric), public.cash_session_recount(uuid, text, numeric),
    public.cash_session_close(uuid, text, text, text), public.cash_session_report(date, date) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.cash_session_state(uuid), public.cash_session_open(uuid, text, numeric, text),
    public.cash_movement_add(uuid, text, text, numeric, text, text), public.cash_movement_void(uuid, uuid, text, text),
    public.cash_session_count(uuid, text, numeric), public.cash_session_recount(uuid, text, numeric),
    public.cash_session_close(uuid, text, text, text) TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.cash_session_report(date, date) TO authenticated, service_role;

  -- 10) audit item 7: a void takes the sale back out of income (a negative
  --     income row), it is not an expense. Existing void expense rows too.
  --     cash_flow only allowed amounts above 0: a void row is the one exception.
  ALTER TABLE public.cash_flow DROP CONSTRAINT IF EXISTS cash_flow_amount_lak_check;
  ALTER TABLE public.cash_flow ADD CONSTRAINT cash_flow_amount_lak_check
    CHECK (amount_lak > 0 OR (type = 'income' AND category = 'ยกเลิกบิล' AND amount_lak < 0));
  EXECUTE $do$DO $mig$
  DECLARE
    v_oid oid := 'public.void_order_with_approval(uuid, uuid, text, text)'::regprocedure;
    v_def text := pg_get_functiondef(v_oid);
  BEGIN
    IF position('VALUES (''expense'', ''คืนเงินยกเลิกบิล'', v_income,' IN v_def) > 0 THEN
      EXECUTE replace(v_def, 'VALUES (''expense'', ''คืนเงินยกเลิกบิล'', v_income,',
                             'VALUES (''income'', ''ยกเลิกบิล'', -v_income,');
    ELSIF position('VALUES (''income'', ''ยกเลิกบิล'', -v_income,' IN v_def) = 0 THEN
      RAISE EXCEPTION '059: void_order_with_approval does not post the void as expected (run 053 first)';
    END IF;
  END
  $mig$$do$;
  UPDATE public.cash_flow SET type = 'income', category = 'ยกเลิกบิล', amount_lak = -amount_lak
  WHERE type = 'expense' AND category = 'คืนเงินยกเลิกบิล' AND amount_lak > 0;

  -- 11) audit item 4: old test bills out of the cash book (the bills stay;
  --     the removed rows are kept in cash_flow_removed_059)
  INSERT INTO public.cash_flow_removed_059
  SELECT cf.* FROM public.cash_flow cf JOIN public.orders o ON o.id = cf.reference_id
  WHERE (o.status = 'test' OR COALESCE(o.is_test, false))
    AND NOT EXISTS (SELECT 1 FROM public.cash_flow_removed_059 r WHERE r.id = cf.id);
  DELETE FROM public.cash_flow cf
  USING public.orders o
  WHERE cf.reference_id = o.id AND (o.status = 'test' OR COALESCE(o.is_test, false));

  -- 12) checkout_order keeps each part of a split bill and the change.
  --     Same as 055 plus p_split_cash / p_split_transfer (parts as handed
  --     over; the change comes out of the cash part) and the order_payments rows.
  DROP FUNCTION IF EXISTS public.checkout_order(uuid, uuid, uuid, jsonb, uuid, text, numeric, numeric, text, text, text, text, boolean, numeric, timestamptz, integer);
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
    v_name      text;
    shortage    record;
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
        'change_lak', v_existing.change_amount, 'status', v_existing.status, 'duplicate', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
      RAISE EXCEPTION 'shop not found' USING ERRCODE = 'P0002';
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
    IF v_created < now() - interval '30 days' THEN
      RAISE EXCEPTION 'sale time out of range' USING ERRCODE = '22023';
    END IF;

    -- prices from the menu, never from the client
    FOR item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
      v_rid := NULLIF(item->>'recipe_id', '')::uuid;
      v_qty := (item->>'qty')::int;
      IF v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN
        RAISE EXCEPTION 'invalid quantity' USING ERRCODE = '22023';
      END IF;
      SELECT price_lak, product_name INTO v_price, v_name
      FROM public.recipes WHERE id = v_rid AND (v_replay OR (COALESCE(is_active, true) AND NOT COALESCE(is_archived, false)));
      IF NOT FOUND THEN
        RAISE EXCEPTION 'menu item not available: %', COALESCE(item->>'recipe_id', '?') USING ERRCODE = 'P0002';
      END IF;
      v_subtotal := v_subtotal + v_qty * v_price;
    END LOOP;

    IF v_discount < 0 OR v_discount > v_subtotal THEN
      RAISE EXCEPTION 'discount must be between 0 and the subtotal' USING ERRCODE = '22023';
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

    -- an offline sale already happened: record it even if stock goes below zero
    IF NOT v_test AND p_created_at IS NULL THEN
      FOR shortage IN SELECT * FROM public.check_stock_for_cart(p_cart) WHERE NOT sufficient LOOP
        RAISE EXCEPTION 'Insufficient stock: "%" requires %, only % available',
          shortage.ingredient_name, shortage.required_qty, shortage.available_qty USING ERRCODE = 'P0001';
      END LOOP;
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
        'change_lak', v_existing.change_amount, 'status', v_existing.status, 'duplicate', true);
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

    FOR item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
      v_rid := (item->>'recipe_id')::uuid;
      v_qty := (item->>'qty')::int;
      SELECT price_lak INTO v_price FROM public.recipes WHERE id = v_rid;
      INSERT INTO public.order_items (order_id, recipe_id, qty, unit_price_lak, customization)
      VALUES (v_order_id, v_rid, v_qty, v_price, NULLIF(item->>'customization', ''));
    END LOOP;

    IF NOT v_test THEN
      UPDATE public.inventory i
      SET current_qty = i.current_qty - use.qty, updated_at = now()
      FROM (
        SELECT ri.inventory_id, SUM(oi.qty * ri.qty_normal) AS qty
        FROM public.order_items oi
        JOIN public.recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
        WHERE oi.order_id = v_order_id AND ri.inventory_id IS NOT NULL
        GROUP BY ri.inventory_id
      ) use
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
        'offline', v_replay));

    RETURN jsonb_build_object(
      'order_id', v_order_id, 'queue_number', v_queue, 'receipt_number', v_receipt,
      'subtotal_lak', v_subtotal, 'discount_lak', v_discount, 'total_lak', v_total,
      'change_lak', v_change, 'status', CASE WHEN v_test THEN 'test' ELSE 'paid' END, 'duplicate', false);
  END;
  $function$;
  REVOKE ALL ON FUNCTION public.checkout_order(uuid, uuid, uuid, jsonb, uuid, text, numeric, numeric, text, text, text, text, boolean, numeric, timestamptz, integer, numeric, numeric) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.checkout_order(uuid, uuid, uuid, jsonb, uuid, text, numeric, numeric, text, text, text, text, boolean, numeric, timestamptz, integer, numeric, numeric) TO anon, authenticated, service_role;
  -- ---- end of 059 body ----

  CREATE FUNCTION pg_temp.t059_try(p_role text, p_sub uuid, p_sql text) RETURNS text
  LANGUAGE plpgsql AS $h$
  DECLARE n bigint;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', COALESCE(p_sub::text, ''), 'role', p_role)::text, true);
    PERFORM set_config('role', p_role, true);
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    RESET ROLE;
    RETURN 'ok:' || n;
  EXCEPTION
    WHEN insufficient_privilege THEN RESET ROLE; RETURN 'denied';
    WHEN OTHERS THEN RESET ROLE; RETURN 'error ' || SQLSTATE || ' ' || SQLERRM;
  END
  $h$;
  -- run a function as the POS does (public key), return its jsonb or the error text
  CREATE FUNCTION pg_temp.t059_pos(p_sql text) RETURNS jsonb
  LANGUAGE plpgsql AS $h$
  DECLARE v jsonb;
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('role', 'anon', true);
    EXECUTE p_sql INTO v;
    RESET ROLE;
    RETURN v;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN jsonb_build_object('raised', SQLERRM);
  END
  $h$;
  GRANT EXECUTE ON FUNCTION pg_temp.t059_try(text, uuid, text), pg_temp.t059_pos(text) TO anon, authenticated;

  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'ทดสอบ แคชเชียร์', 'cashier', extensions.crypt(c_cash_pin, extensions.gen_salt('bf')), true)
  RETURNING id INTO v_cashier;
  INSERT INTO public.employees (shop_id, name, role, pin_hash, is_active)
  VALUES (c_shop, 'ทดสอบ ผู้จัดการ', 'manager', extensions.crypt(c_mgr_pin, extensions.gen_salt('bf')), true)
  RETURNING id INTO v_mgr;

  -- T1 the migration keeps every bill, gives each a payment row, takes old test bills out of the cash book
  SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t.id), '')) INTO v_txt FROM public.orders t;
  SELECT count(*) INTO v_n FROM public.order_payments;
  SELECT count(*) INTO v_n2 FROM public.cash_flow cf JOIN public.orders o ON o.id = cf.reference_id
   WHERE o.status = 'test' OR COALESCE(o.is_test, false);
  report := report || CASE WHEN v_txt = v_orders_md5 AND v_n = v_orders AND v_n2 = 0 THEN 'PASS' ELSE 'FAIL' END
    || format(' T1 bills unchanged (%s), payment rows %s of %s, test-bill rows taken out of the cash book %s (left %s)',
              v_txt = v_orders_md5, v_n, v_orders, v_cf_test, v_n2) || E'\n';

  -- T2 the new tables are closed to the public key and to strangers
  v_txt  := pg_temp.t059_try('anon', NULL, 'SELECT * FROM public.cash_sessions');
  v_txt2 := pg_temp.t059_try('anon', NULL, 'INSERT INTO public.order_payments (order_id, method, amount_lak) SELECT id, $q$cash$q$, 1 FROM public.orders LIMIT 1');
  v_txt3 := pg_temp.t059_try('authenticated', v_stranger, 'SELECT * FROM public.order_payments');
  v_err  := pg_temp.t059_try('anon', NULL, 'SELECT public.cash_check_pin($q$' || c_shop || '$q$, $q$0000$q$, true)');
  report := report || CASE WHEN v_txt = 'denied' AND v_txt2 = 'denied' AND v_txt3 = 'ok:0' AND v_err = 'denied' THEN 'PASS' ELSE 'FAIL' END
    || format(' T2 public key read sessions %s, add payment row %s, stranger reads payments %s, public key calls the PIN checker %s',
              v_txt, v_txt2, v_txt3, v_err) || E'\n';

  -- T3 open the drawer: wrong PIN refused, right PIN opens, a second open is refused
  v_res  := pg_temp.t059_pos(format('SELECT public.cash_session_open(%L, %L, 500000, NULL)', c_shop, '0000'));
  v_res2 := pg_temp.t059_pos(format('SELECT public.cash_session_open(%L, %L, 500000, NULL)', c_shop, c_cash_pin));
  v_res3 := pg_temp.t059_pos(format('SELECT public.cash_session_open(%L, %L, 500000, NULL)', c_shop, c_cash_pin));
  report := report || CASE WHEN v_res->>'error' = 'invalid_pin' AND (v_res2->>'ok')::boolean AND v_res3->>'raised' = 'SESSION_ALREADY_OPEN' THEN 'PASS' ELSE 'FAIL' END
    || format(' T3 open: wrong PIN %s, cashier PIN %s, open again %s', v_res->>'error', v_res2->>'ok', v_res3->>'raised') || E'\n';
  UPDATE public.cash_sessions SET window_start = now() - interval '1 second' WHERE shop_id = c_shop AND status = 'open';

  -- T4 sales during the shift: cash with change, split cash+transfer with change, QR, a test bill, a voided bill
  v_res := pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'cash', %s, 0, NULL, NULL, NULL, NULL, false, %s, now(), NULL)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 2)), v_price * 2 + 30000, v_price * 2));
  v_res2 := pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'split', NULL, 0, NULL, NULL, NULL, NULL, false, %s, now(), NULL, %s, %s)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price, v_price - 15000 + 5000, 15000));
  v_res3 := pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'qr', NULL, 0, NULL, NULL, NULL, NULL, false, %s, now(), NULL)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price));
  PERFORM pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'cash', %s, 0, NULL, NULL, NULL, NULL, true, %s, now(), NULL)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price, v_price));
  v_void_order := (pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'cash', %s, 0, NULL, NULL, NULL, NULL, false, %s, now(), NULL)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price, v_price)) ->> 'order_id')::uuid;
  -- a cash bill that is voided two shifts later (T15)
  v_late := (pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'cash', %s, 0, NULL, NULL, NULL, NULL, false, %s, now(), NULL)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price, v_price)) ->> 'order_id')::uuid;
  v_order := (v_res2 ->> 'order_id')::uuid;
  SELECT string_agg(method || '=' || amount_lak::bigint, ' ' ORDER BY method) INTO v_txt FROM public.order_payments WHERE order_id = v_order;
  report := report || CASE WHEN (v_res->>'change_lak')::numeric = 30000 AND (v_res2->>'change_lak')::numeric = 5000
                             AND v_txt = format('cash=%s transfer=15000', (v_price - 15000)::bigint) AND v_res3 ? 'order_id' AND v_void_order IS NOT NULL
                             AND v_late IS NOT NULL
                        THEN 'PASS' ELSE 'FAIL' END
    || format(' T4 cash bill change %s (want 30000); split bill change %s (want 5000), parts %s; QR bill %s',
              v_res->>'change_lak', v_res2->>'change_lak', v_txt, v_res3 ? 'order_id') || E'\n';

  -- T5 a split bill whose parts do not add up is refused; an old-style split (no parts) is still accepted
  v_res := pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'split', NULL, 0, NULL, NULL, NULL, NULL, false, %s, NULL, NULL, 1000, 1000)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price));
  v_res2 := pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'split', NULL, 0, NULL, NULL, NULL, NULL, false, %s, NULL, NULL, 0, %s)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price, v_price + 1000));
  v_res3 := pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'split', NULL, 0, NULL, NULL, NULL, NULL, true, %s, NULL, NULL)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price));
  SELECT string_agg(method, ',') INTO v_txt FROM public.order_payments WHERE order_id = (v_res3->>'order_id')::uuid;
  -- an offline split whose transfer is now more than the bill is still saved (the sale happened); test bill so it stays out of the drawer
  v_order := (pg_temp.t059_pos(format($s$SELECT public.checkout_order(gen_random_uuid(), %L, %L, %L::jsonb, NULL, 'split', NULL, 0, NULL, NULL, NULL, NULL, true, %s, now(), NULL, 0, %s)$s$,
     c_shop, v_cashier, jsonb_build_array(jsonb_build_object('recipe_id', v_recipe, 'qty', 1)), v_price + 1000, v_price + 1000)) ->> 'order_id')::uuid;
  SELECT string_agg(method || '=' || amount_lak::bigint, ' ' ORDER BY method) INTO v_txt2 FROM public.order_payments WHERE order_id = v_order;
  report := report || CASE WHEN v_res->>'raised' LIKE '%less than the total%' AND v_res2->>'raised' LIKE '%transfer part is more%' AND v_txt = 'split'
                             AND v_txt2 = format('transfer=%s', v_price::bigint) THEN 'PASS' ELSE 'FAIL' END
    || format(' T5 split too small: %s; transfer bigger than bill: %s; old-style split saved as %s; offline split with transfer over the bill saved as %s',
              v_res->>'raised', v_res2->>'raised', v_txt, COALESCE(v_txt2, 'NOT SAVED')) || E'\n';

  -- T6 voiding a bill takes the sale back out of income (no expense row)
  v_res := pg_temp.t059_pos(format('SELECT public.void_order_with_approval(%L, %L, %L, %L)', v_void_order, c_shop, c_mgr_pin, '059 test'));
  SELECT count(*) FILTER (WHERE type = 'expense'), COALESCE(sum(amount_lak) FILTER (WHERE type = 'income'), 0)
    INTO v_n, v_num FROM public.cash_flow WHERE reference_id = v_void_order;
  report := report || CASE WHEN (v_res->>'ok')::boolean AND v_n = 0 AND v_num = 0 THEN 'PASS' ELSE 'FAIL' END
    || format(' T6 void %s: expense rows %s (want 0), income left for that bill %s (want 0)', v_res->>'ok', v_n, v_num) || E'\n';

  -- T7 paid out / paid in: reason needed, wrong PIN refused, a manager can cancel one
  v_res  := pg_temp.t059_pos(format('SELECT public.cash_movement_add(%L, %L, %L, 30000, %L, %L)', c_shop, c_cash_pin, 'paid_out', 'ซื้อน้ำแข็ง', '3 ถุง'));
  v_res2 := pg_temp.t059_pos(format('SELECT public.cash_movement_add(%L, %L, %L, 10000, %L, NULL)', c_shop, c_cash_pin, 'paid_in', 'เติมเงินทอน'));
  v_res3 := pg_temp.t059_pos(format('SELECT public.cash_movement_add(%L, %L, %L, 5000, %L, NULL)', c_shop, c_cash_pin, 'paid_out', ''));
  v_txt  := pg_temp.t059_pos(format('SELECT public.cash_movement_add(%L, %L, %L, 5000, %L, NULL)', c_shop, '1112', 'paid_out', 'x')) ->> 'error';
  v_order := (pg_temp.t059_pos(format('SELECT public.cash_movement_add(%L, %L, %L, 5000, %L, NULL)', c_shop, c_cash_pin, 'paid_out', 'ผิด')) ->> 'id')::uuid;
  v_txt2 := pg_temp.t059_pos(format('SELECT public.cash_movement_void(%L, %L, %L, %L)', c_shop, v_order, c_cash_pin, 'ใส่ผิด')) ->> 'error';
  v_txt3 := pg_temp.t059_pos(format('SELECT public.cash_movement_void(%L, %L, %L, %L)', c_shop, v_order, c_mgr_pin, 'ใส่ผิด')) ->> 'ok';
  report := report || CASE WHEN (v_res->>'ok')::boolean AND (v_res2->>'ok')::boolean AND v_res3->>'raised' = 'REASON_REQUIRED'
                             AND v_txt = 'invalid_pin' AND v_txt2 = 'invalid_pin' AND v_txt3 = 'true' THEN 'PASS' ELSE 'FAIL' END
    || format(' T7 paid out %s, paid in %s, no reason %s, wrong PIN %s, cancel with cashier PIN %s, cancel with manager PIN %s',
              v_res->>'ok', v_res2->>'ok', v_res3->>'raised', v_txt, v_txt2, v_txt3) || E'\n';

  -- T8 blind count: before counting nobody (not even the public key) gets the cash amount
  v_res := pg_temp.t059_pos(format('SELECT public.cash_session_state(%L)', c_shop));
  report := report || CASE WHEN v_res->'result' = 'null'::jsonb AND NOT (v_res->'sales'->'by_method'->'cash' ? 'amount')
                             AND (v_res->'sales'->'by_method'->'cash'->>'bills')::int = 3
                             AND (v_res->'sales'->'by_method'->'transfer'->>'amount')::numeric = 15000 THEN 'PASS' ELSE 'FAIL' END
    || format(' T8 before the count: bills with a cash part %s (want 3) with no amount shown %s, transfer %s, qr %s, expected hidden %s',
              v_res->'sales'->'by_method'->'cash'->>'bills', NOT (v_res->'sales'->'by_method'->'cash' ? 'amount'),
              v_res->'sales'->'by_method'->'transfer'->>'amount', v_res->'sales'->'by_method'->'qr'->>'amount',
              v_res->'result' = 'null'::jsonb) || E'\n';

  -- T9 count: expected = 500,000 + cash sales - paid out + paid in; counted once only
  v_num := 500000 + (v_price * 2) + (v_price - 15000) + v_price - 30000 + 10000;
  v_res  := pg_temp.t059_pos(format('SELECT public.cash_session_count(%L, %L, %s)', c_shop, c_cash_pin, v_num - 5000));
  v_res2 := pg_temp.t059_pos(format('SELECT public.cash_session_count(%L, %L, %s)', c_shop, c_cash_pin, v_num));
  report := report || CASE WHEN (v_res->>'expected')::numeric = v_num AND (v_res->>'difference')::numeric = -5000
                             AND v_res2->>'raised' = 'ALREADY_COUNTED' THEN 'PASS' ELSE 'FAIL' END
    || format(' T9 count: expected %s (want %s), counted %s, difference %s, count again %s',
              v_res->>'expected', v_num, v_res->>'counted', v_res->>'difference', v_res2->>'raised') || E'\n';

  -- T10 close: short needs a reason, wrong manager PIN refused, recount needs the manager, then close with 2 people
  v_res  := pg_temp.t059_pos(format('SELECT public.cash_session_close(%L, %L, NULL, %L)', c_shop, c_cash_pin, c_mgr_pin));
  v_res2 := pg_temp.t059_pos(format('SELECT public.cash_session_close(%L, %L, %L, %L)', c_shop, c_cash_pin, 'ทอนผิด', c_cash_pin));
  v_res3 := pg_temp.t059_pos(format('SELECT public.cash_session_recount(%L, %L, %s)', c_shop, c_mgr_pin, v_num));
  v_txt  := (pg_temp.t059_pos(format('SELECT public.cash_session_close(%L, %L, NULL, %L)', c_shop, c_cash_pin, c_mgr_pin))) ->> 'checked_by';
  SELECT status || ' checked=' || (checked_by = v_mgr) || ' closed_by_cashier=' || (closed_by = v_cashier) || ' no_checker=' || no_checker
         || ' recounts=' || recounts || ' adds_up=' || (counted_cash_lak - expected_cash_lak = difference_lak) INTO v_txt2
  FROM public.cash_sessions WHERE shop_id = c_shop ORDER BY opened_at DESC LIMIT 1;
  report := report || CASE WHEN v_res->>'raised' = 'REASON_REQUIRED' AND v_res2->>'error' = 'invalid_pin'
                             AND (v_res3->>'difference')::numeric = 0 AND v_txt = 'ทดสอบ ผู้จัดการ'
                             AND v_txt2 = 'closed checked=true closed_by_cashier=true no_checker=false recounts=1 adds_up=true' THEN 'PASS' ELSE 'FAIL' END
    || format(' T10 close short without reason %s, cashier PIN as checker %s, manager recount difference %s, closed by %s (%s)',
              v_res->>'raised', v_res2->>'error', v_res3->>'difference', v_txt, v_txt2) || E'\n';

  -- T11 next shift: opening cash is carried over; a different amount needs a reason; closing alone = no checker
  v_res  := pg_temp.t059_pos(format('SELECT public.cash_session_state(%L)', c_shop));
  v_res2 := pg_temp.t059_pos(format('SELECT public.cash_session_open(%L, %L, 400000, NULL)', c_shop, c_cash_pin));
  v_res3 := pg_temp.t059_pos(format('SELECT public.cash_session_open(%L, %L, 400000, %L)', c_shop, c_cash_pin, 'ฝากธนาคาร'));
  PERFORM pg_temp.t059_pos(format('SELECT public.cash_session_count(%L, %L, 400000)', c_shop, c_cash_pin));
  v_txt2 := (pg_temp.t059_pos(format('SELECT public.cash_session_close(%L, NULL, NULL, NULL)', c_shop))) ->> 'error';
  v_txt := (pg_temp.t059_pos(format('SELECT public.cash_session_close(%L, %L, NULL, NULL)', c_shop, c_cash_pin))) ->> 'no_checker';
  report := report || CASE WHEN (v_res->>'carried_over')::numeric = v_num AND v_res2->>'raised' = 'REASON_REQUIRED'
                             AND (v_res3->>'ok')::boolean AND v_txt2 = 'invalid_pin' AND v_txt = 'true' THEN 'PASS' ELSE 'FAIL' END
    || format(' T11 carried over %s (want %s), 400,000 without reason %s, with reason %s, close with no PIN %s, closed alone with staff PIN: no checker %s',
              v_res->>'carried_over', v_num, v_res2->>'raised', v_res3->>'ok', v_txt2, v_txt) || E'\n';

  -- T12 reports: the owner sees both closes, others are refused; weekly Telegram text is built
  v_txt  := pg_temp.t059_try('authenticated', v_owner, 'SELECT public.cash_session_report(current_date - 1, current_date + 1)');
  v_txt2 := pg_temp.t059_try('authenticated', v_stranger, 'SELECT public.cash_session_report(current_date - 1, current_date + 1)');
  v_txt3 := pg_temp.t059_try('anon', NULL, 'SELECT public.cash_session_report(current_date - 1, current_date + 1)');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  v_n := jsonb_array_length(public.cash_session_report((now() AT TIME ZONE 'Asia/Vientiane')::date - 1, (now() AT TIME ZONE 'Asia/Vientiane')::date + 1));
  v_err := public.cash_week_report_send();
  v_res := pg_temp.t059_pos('SELECT to_jsonb(public.cash_week_report_send())');
  report := report || CASE WHEN v_txt = 'ok:1' AND v_txt2 = 'denied' AND v_txt3 = 'denied' AND v_n = 2
                             AND v_err LIKE '%ปิดกะ 2 ครั้ง%' AND v_res ? 'raised' THEN 'PASS' ELSE 'FAIL' END
    || format(' T12 owner report %s (%s closes), stranger %s, public key %s, weekly text "%s", public key sends weekly %s',
              v_txt, v_n, v_txt2, v_txt3, replace(left(v_err, 70), E'\n', ' / '), CASE WHEN v_res ? 'raised' THEN 'refused' ELSE 'ALLOWED' END) || E'\n';

  -- T13 wrong PINs lock: 5 wrong staff PINs lock the drawer (even the right PIN waits) but not voiding;
  --     5 wrong manager PINs lock voiding too (same counter as 053)
  DELETE FROM public.pin_attempts WHERE scope IN ('void:' || c_shop::text, 'cash:' || c_shop::text);
  v_res2 := pg_temp.t059_pos(format('SELECT public.cash_session_open(%L, %L, 400000, %L)', c_shop, c_cash_pin, 'test'));
  v_order := (pg_temp.t059_pos(format('SELECT public.cash_movement_add(%L, %L, %L, 1000, %L, NULL)', c_shop, c_cash_pin, 'paid_in', 'x')) ->> 'id')::uuid;
  FOR v_n IN 1..5 LOOP
    PERFORM pg_temp.t059_pos(format('SELECT public.cash_movement_add(%L, %L, %L, 1000, %L, NULL)', c_shop, '0000', 'paid_in', 'x'));
  END LOOP;
  v_res := pg_temp.t059_pos(format('SELECT public.cash_movement_add(%L, %L, %L, 1000, %L, NULL)', c_shop, c_cash_pin, 'paid_in', 'x'));
  SELECT count(*) INTO v_n2 FROM public.pin_attempts WHERE scope = 'void:' || c_shop::text AND fail_count > 0;
  FOR v_n IN 1..5 LOOP
    PERFORM pg_temp.t059_pos(format('SELECT public.cash_movement_void(%L, %L, %L, %L)', c_shop, v_order, '0000', 'r'));
  END LOOP;
  v_res3 := pg_temp.t059_pos(format('SELECT public.void_order_with_approval(%L, %L, %L, %L)', v_late, c_shop, c_mgr_pin, '059 test'));
  report := report || CASE WHEN (v_res2->>'ok')::boolean AND v_res->>'error' = 'locked' AND v_n2 = 0 AND v_res3::text ILIKE '%lock%' THEN 'PASS' ELSE 'FAIL' END
    || format(' T13 drawer open %s; after 5 wrong staff PINs the right PIN gets: %s (wait %s s); voiding counter touched %s (want 0); after 5 wrong manager PINs void gets: %s',
              v_res2->>'ok', COALESCE(v_res->>'error', v_res::text), v_res->>'wait', v_n2, left(v_res3::text, 60)) || E'\n';

  -- T14 a bill sold two shifts ago and voided now: its cash goes back out of this drawer, the old shift stays as it was
  DELETE FROM public.pin_attempts WHERE scope IN ('void:' || c_shop::text, 'cash:' || c_shop::text);
  SELECT expected_cash_lak INTO v_num FROM public.cash_sessions WHERE shop_id = c_shop AND status = 'closed' ORDER BY opened_at LIMIT 1;
  v_res := pg_temp.t059_pos(format('SELECT public.void_order_with_approval(%L, %L, %L, %L)', v_late, c_shop, c_mgr_pin, '059 test'));
  UPDATE public.orders SET voided_at = clock_timestamp() WHERE id = v_late;
  v_res2 := pg_temp.t059_pos(format('SELECT public.cash_session_count(%L, %L, %s)', c_shop, c_cash_pin, 401000 - v_price));
  report := report || CASE WHEN (v_res->>'ok')::boolean AND (v_res2->>'expected')::numeric = 401000 - v_price
                             AND (v_res2->>'difference')::numeric = 0 AND (v_res2->'sales'->>'refund_bills')::int = 1
                             AND v_num = (SELECT expected_cash_lak FROM public.cash_sessions WHERE shop_id = c_shop AND status = 'closed' ORDER BY opened_at LIMIT 1)
                        THEN 'PASS' ELSE 'FAIL' END
    || format(' T14 void %s; this drawer expected %s (want %s), refunds %s, difference %s; first shift unchanged %s',
              v_res->>'ok', v_res2->>'expected', 401000 - v_price, v_res2->'sales'->>'refund_bills', v_res2->>'difference',
              v_num = (SELECT expected_cash_lak FROM public.cash_sessions WHERE shop_id = c_shop AND status = 'closed' ORDER BY opened_at LIMIT 1)) || E'\n';

  RAISE EXCEPTION E'059 TEST RESULTS (everything rolled back, nothing changed):\n%', report;
END
$test$;
