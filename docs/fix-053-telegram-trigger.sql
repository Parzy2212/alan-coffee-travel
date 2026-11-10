-- ============================================================
--  Re-enable trg_large_order_telegram (left disabled by the test-053 run,
--  2026-11-10). Refuses to run if any test-053 data is still there:
--  that needs a full cleanup script instead (docs/check-053-leftovers.sql).
--
--  Everything is inside ONE DO block (the SQL Editor does not keep BEGIN
--  open). p_test = true -> ends in an error, nothing changes.
--  Run once with true, read the message, then once with false.
-- ============================================================

DO $$
DECLARE
  p_test   CONSTANT boolean := true;   -- step 1: true (test)   step 2: false (real)
  leftover int;
  state    "char";
BEGIN
  SELECT (SELECT count(*) FROM public.employees WHERE name LIKE 'test053 %')
       + (SELECT count(*) FROM public.shops     WHERE slug LIKE 'test053-%')
       + (SELECT count(*) FROM public.customers WHERE phone LIKE 'test053-%')
       + (SELECT count(*) FROM public.orders    WHERE void_reason LIKE 'test053%')
       + (SELECT count(*) FROM public.audit_logs WHERE after_data::text LIKE '%test053%')
    INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'STOPPED: % test-053 rows still exist. Nothing changed. Run docs/check-053-leftovers.sql and send the result.', leftover;
  END IF;

  ALTER TABLE public.orders ENABLE TRIGGER trg_large_order_telegram;

  SELECT tgenabled INTO state FROM pg_trigger
  WHERE tgrelid = 'public.orders'::regclass AND tgname = 'trg_large_order_telegram';
  IF state IS DISTINCT FROM 'O' THEN
    RAISE EXCEPTION 'FAIL: trigger state is %, expected O. Nothing changed.', state;
  END IF;

  IF p_test THEN
    RAISE EXCEPTION 'TEST PASS: no test-053 rows; trigger would be O. Rolled back, nothing changed. Now set p_test := false and run again.';
  END IF;
  RAISE NOTICE 'DONE: trg_large_order_telegram enabled (O).';
END;
$$;

-- After step 2 (real): all three should be O
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass AND NOT tgisinternal ORDER BY 1;
