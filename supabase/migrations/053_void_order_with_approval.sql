-- ============================================================
--  Alan Cafe OS -- Migration 053: void a bill only with a manager PIN
--
--  RAN on production 2026-11-10 (owner; grants checked: new fn anon/auth
--  EXECUTE, void_order revoked). The test run before it left the Telegram
--  trigger disabled: the SQL Editor did not keep the test's BEGIN open,
--  so its top-level statements committed one by one. Leftover check:
--  docs/check-053-leftovers.sql. Rollback tests must not rely on BEGIN
--  alone: keep every write inside one DO block that ends in RAISE.
--
--  Live void_order before this (pg_get_functiondef, owner 2026-11-10):
--  - anyone with the anon key could void any order id
--  - no status check: voiding twice put the stock back twice
--  - no record of who voided or when; the UI ignored errors
--  - customer lifetime_spend_lak / visit_count stayed counted
--
--  This migration:
--  1) orders.voided_at, orders.voided_by_employee_id (new columns)
--  2) void_order_with_approval(order, shop, manager PIN, reason):
--     - the order row is locked (FOR UPDATE), so two voids of one
--       bill cannot both run; anything but status 'paid' is refused
--       ('already void' and friends), before the PIN is checked
--     - reason required; the order must belong to p_shop_id. Orders
--       with shop_id NULL (create_order_with_deduction never sets it)
--       count as the real shop 9afdd9eb-... (pinned like 051/052):
--       anyone can onboard a shop and add a manager of their own, so
--       trusting p_shop_id alone would let them void real bills
--     - approval needs the PIN of an active employee of that shop
--       with role 'manager' (owner decision 2026-11-10: managers only)
--     - own attempt scope 'void:<shop_id>' (047 helpers): 5 failed
--       approvals -> locked 60 s, then 2, 4 ... max 30 min;
--       PIN_LOCKED while locked, even for the right PIN. Only a
--       manager PIN counts as success, so a cashier cannot reset the
--       counter with their own PIN (047 option A resets the PIN pad's
--       'shop:<id>' scope on any valid PIN), and the reply never
--       says whether a PIN belongs to someone ('invalid_pin' for
--       both). The PIN pad's 'shop:<id>' scope is not touched.
--     - a failed PIN RETURNS {ok:false} instead of raising: raising
--       would roll back the failed-attempt count (same rule as 047)
--     - on approval: status 'void', void_reason, voided_at,
--       voided_by_employee_id; stock put back with the same rule the
--       live create_order_with_deduction deducts with
--       (recipe_ingredients.qty_normal * qty, inventory_id NOT NULL);
--       customer stats reversed for what create_order_with_deduction
--       added (lifetime_spend_lak += total, visit_count += 1) and for
--       any loyalty 'earn' rows of this order (trg_award_loyalty adds
--       points, spend and a visit once more); an audit_logs row
--  3) void_order: EXECUTE revoked from PUBLIC, anon, authenticated
--     (left in place for service_role; nothing in the app calls it
--     once the matching client code is deployed)
--  4) get_daily_queue_number: the "status != 'voided'" filter is
--     removed. Orders are voided as 'void', so the filter never
--     matched; if it did, voiding the last order of the day would
--     hand its number out again. Queue numbers are never reused now.
--
--  Known limits (for package A):
--  - stock is put back from the CURRENT recipe; if a recipe was
--    edited between the sale and the void, the amounts differ.
--    Package A records each sale's deductions and voids from that.
--  - the loyalty reversal lowers points but does not recompute
--    vip_tier. It never runs today: trg_award_loyalty needs
--    orders.shop_id, which nothing sets yet. Fix when A sets shop_id.
--  - cash flow: trg_order_to_cashflow records income when a bill
--    becomes 'paid' (before finalize_order_payment, so always cash
--    and before discount), and a void does not take it back. Left
--    for package A, which writes payment + discount in the same
--    transaction and reverses the cash flow entry on void.
--  - orders with shop_id NULL always count as the real shop, so any
--    other onboarded shop selling through /pos cannot void (same
--    pinning as 051/052). Fix when A sets orders.shop_id.
--  - anyone with the anon key and one paid order id can keep voids
--    locked (5 wrong PINs, again when the lock ends), like the PIN
--    pad under 047 option A. Unlock by hand:
--    DELETE FROM public.pin_attempts WHERE scope = 'void:<shop_id>';
--
--  The test makes a real 50,000 LAK sale inside the rolled-back
--  transaction. Live triggers on orders (owner, 2026-11-10):
--  trg_award_loyalty, trg_large_order_telegram, trg_order_to_cashflow.
--  The test disables trg_large_order_telegram inside its transaction
--  (re-enabled by the rollback) so no Telegram message can go out.
--
--  Client: app/pos/POSClient.tsx VoidRow calls the new function.
--  Deploy it right after running this: from the REVOKE on, the old
--  client's Void button gets "permission denied".
--
--  Rollback: re-run the void_order and get_daily_queue_number
--  definitions shown above (owner's pg_get_functiondef, 2026-11-10),
--  GRANT EXECUTE ON FUNCTION public.void_order(uuid, text) TO anon,
--  authenticated; DROP FUNCTION public.void_order_with_approval(uuid,
--  uuid, text, text). The two new columns can stay.
--
--  Run in Supabase SQL Editor. Safe to run multiple times.
-- ============================================================

BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voided_by_employee_id uuid REFERENCES public.employees(id);

CREATE OR REPLACE FUNCTION public.void_order_with_approval(
  p_order_id    uuid,
  p_shop_id     uuid,
  p_manager_pin text,
  p_reason      text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_order    public.orders%ROWTYPE;
  v_reason   text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_scope    text := 'void:' || p_shop_id::text;
  v_wait     int;
  v_mgr_id   uuid;
  v_mgr_name text;
  v_earn_pts int;
  v_earn_n   int;
  v_now      timestamptz := now();
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to void a bill' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;
  -- create_order_with_deduction leaves shop_id NULL, so NULL means the real shop
  -- (anyone can onboard a shop and add a manager of their own).
  IF COALESCE(v_order.shop_id, '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid) IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'order belongs to another shop' USING ERRCODE = '42501';
  END IF;
  IF v_order.status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'ORDER_NOT_PAID' USING DETAIL = COALESCE(v_order.status, 'null'),
      HINT = 'only a paid bill can be voided';
  END IF;

  v_wait := public.pin_attempt_wait(v_scope);
  IF v_wait > 0 THEN
    RAISE EXCEPTION 'PIN_LOCKED' USING DETAIL = v_wait::text, HINT = 'retry after ' || v_wait || ' seconds';
  END IF;

  SELECT e.id, e.name INTO v_mgr_id, v_mgr_name
  FROM public.employees e
  WHERE e.shop_id = p_shop_id
    AND e.is_active = true
    AND e.role = 'manager'
    AND p_manager_pin ~ '^[0-9]{4}$'
    AND e.pin_hash = extensions.crypt(p_manager_pin, e.pin_hash)
  LIMIT 1;

  -- Own scope: only a manager PIN counts as success, so a cashier's PIN cannot reset
  -- the counter. No RAISE after this on a failed PIN: it would roll the count back.
  PERFORM public.pin_attempt_record(v_scope, v_mgr_id IS NOT NULL, 5, 60, 1800);
  IF v_mgr_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  UPDATE public.orders
  SET status = 'void',
      void_reason = v_reason,
      voided_at = v_now,
      voided_by_employee_id = v_mgr_id
  WHERE id = p_order_id;

  UPDATE public.inventory i
  SET current_qty = i.current_qty + restore.qty,
      updated_at  = v_now
  FROM (
    SELECT ri.inventory_id, SUM(oi.qty * ri.qty_normal) AS qty
    FROM public.order_items oi
    JOIN public.recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
    WHERE oi.order_id = p_order_id AND ri.inventory_id IS NOT NULL
    GROUP BY ri.inventory_id
  ) restore
  WHERE i.id = restore.inventory_id;

  IF v_order.customer_id IS NOT NULL THEN
    SELECT COALESCE(SUM(points), 0), count(*) INTO v_earn_pts, v_earn_n
    FROM public.loyalty_transactions
    WHERE order_id = p_order_id AND type = 'earn';

    UPDATE public.customers
    SET lifetime_spend_lak = GREATEST(0, COALESCE(lifetime_spend_lak, 0)
                               - COALESCE(v_order.total_lak, 0) * (1 + LEAST(v_earn_n, 1))),
        visit_count        = GREATEST(0, COALESCE(visit_count, 0) - (1 + LEAST(v_earn_n, 1))),
        loyalty_points     = GREATEST(0, COALESCE(loyalty_points, 0) - v_earn_pts)
    WHERE id = v_order.customer_id;

    IF v_earn_pts > 0 THEN
      INSERT INTO public.loyalty_transactions (shop_id, customer_id, order_id, type, points, description)
      SELECT shop_id, customer_id, order_id, 'adjust', -v_earn_pts,
             'Voided order #' || COALESCE(v_order.queue_number::text, '?')
      FROM public.loyalty_transactions
      WHERE order_id = p_order_id AND type = 'earn'
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (staff_id, action, table_name, row_id, after_data)
  VALUES (
    v_order.staff_id, 'void_order', 'orders', p_order_id,
    jsonb_build_object(
      'order_id', p_order_id, 'queue_number', v_order.queue_number,
      'total_lak', v_order.total_lak, 'reason', v_reason,
      'approved_by_employee_id', v_mgr_id, 'approved_by', v_mgr_name,
      'voided_at', v_now
    )
  );

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'voided_at', v_now, 'approved_by', v_mgr_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.void_order_with_approval(uuid, uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.void_order_with_approval(uuid, uuid, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.void_order(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_queue_number()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next
  FROM orders
  WHERE (created_at AT TIME ZONE 'Asia/Vientiane')::DATE
    = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE;
  RETURN v_next;
END;
$$;

COMMIT;

-- Checks: void_order_with_approval anon=t authenticated=t; void_order anon=f authenticated=f
SELECT p.oid::regprocedure::text AS signature,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can,
       p.prosecdef AS security_definer
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('void_order', 'void_order_with_approval', 'get_daily_queue_number')
ORDER BY 1;
