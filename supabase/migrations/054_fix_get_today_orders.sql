-- ============================================================
--  054: fix get_today_orders() (POS "คิว & ออเดอร์" -> "ออเดอร์วันนี้")
--
--  Found 2026-11-11: on production every call fails with
--  "structure of query does not match function result type" (HTTP 400),
--  so the POS today-orders list is always empty and its Void (053) and
--  reprint buttons can't be reached.
--  Cause (repo 037): created_at_vt is declared timestamptz but the query
--  returned `created_at AT TIME ZONE 'Asia/Vientiane'` (timestamp without
--  time zone). The live definition may also drift elsewhere, so every
--  column is now cast to its declared type.
--  created_at_vt now carries the real instant (timestamptz); the POS
--  formats it in the browser's time zone (Laos), same as before.
--  Same name, columns, filter (today in Asia/Vientiane) and grants.
--  Unchanged on purpose (tracked separately): no shop filter, anon access.
--
--  Everything is inside ONE DO block (the SQL Editor does not keep BEGIN
--  open). p_test = true -> replaces the function, calls it, then ends in
--  an error so nothing is kept. Run once with true, read the message,
--  then once with false.
-- ============================================================

DO $$
DECLARE
  p_test CONSTANT boolean := true;   -- step 1: true (test)   step 2: false (real)
  n_rows int;
BEGIN
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_today_orders()';

  EXECUTE $fn$
CREATE FUNCTION public.get_today_orders()
RETURNS TABLE (
  id              uuid,
  queue_number    integer,
  status          text,
  total_lak       numeric,
  payment_method  text,
  customer_name   text,
  table_number    text,
  receipt_number  text,
  discount_amount numeric,
  void_reason     text,
  created_at_vt   timestamptz,
  items           jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Vientiane')::date;
BEGIN
  RETURN QUERY
    SELECT
      o.id::uuid,
      o.queue_number::integer,
      o.status::text,
      o.total_lak::numeric,
      o.payment_method::text,
      o.customer_name::text,
      o.table_number::text,
      o.receipt_number::text,
      COALESCE(o.discount_amount, 0)::numeric,
      o.void_reason::text,
      o.created_at::timestamptz,
      COALESCE(
        jsonb_agg(
          jsonb_build_object('name', r.product_name, 'qty', oi.qty, 'note', oi.customization)
          ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::jsonb
      )
    FROM   orders o
    LEFT   JOIN order_items oi ON oi.order_id = o.id
    LEFT   JOIN recipes r      ON r.id = oi.recipe_id
    WHERE  (o.created_at AT TIME ZONE 'Asia/Vientiane')::date = v_today
    GROUP  BY o.id
    ORDER  BY o.created_at DESC;
END;
$body$
$fn$;

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_today_orders() TO anon, authenticated';

  SELECT count(*) INTO n_rows FROM public.get_today_orders();

  IF p_test THEN
    RAISE EXCEPTION 'TEST PASS: get_today_orders() works, % orders today. Nothing was kept. Set p_test := false and run again.', n_rows;
  END IF;
  RAISE NOTICE 'DONE: get_today_orders() replaced, % orders today.', n_rows;
END
$$;
