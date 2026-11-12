-- ============================================================
--  Test for docs/close-stale-shifts.sql (close POS shifts left open)
--
--  CHANGES NOTHING. The whole file is ONE DO block that always ends in
--  an error ("STALE SHIFTS TEST RESULTS ..."), so Postgres rolls the
--  update back. The error message IS the report: every T line should
--  start with PASS. No BEGIN/ROLLBACK needed.
--
--  What the fix does: every POS shift (employee_shifts) of the real
--  shop that is still open and started before today (Asia/Vientiane)
--  gets clocked_out = clocked_in, i.e. a closed shift of 0 minutes.
--  No row is deleted. Shifts started today stay open (someone may be
--  selling right now). Other shops are not touched.
--
--  Why 0 minutes and not "now": total_minutes is computed from
--  clocked_out - clocked_in. Closing with the current time would add
--  thousands of hours to the employee's shift history / earnings.
--
--  If "shifts that would be closed" says 0, nothing was tested: do not
--  run the fix, send the report back instead.
--
--  It makes no sale and writes no order or attendance row.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor) as postgres:
--  paste the whole file, Run, copy the error text back.
-- ============================================================

DO $test$
DECLARE
  c_shop  constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_today constant timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Vientiane') AT TIME ZONE 'Asia/Vientiane';
  report text := '';
  n int;
  b_rows int; b_minutes bigint; b_closed int; b_real int; b_open_old int; b_open_today int;
  b_other text; b_att int; b_orders int;
  v_list text; v_triggers text; v_funcs text;
BEGIN
  SELECT count(*), COALESCE(sum(total_minutes), 0), count(clocked_out)
    INTO b_rows, b_minutes, b_closed
    FROM public.employee_shifts WHERE shop_id = c_shop;
  SELECT count(*) INTO b_real FROM public.employee_shifts
    WHERE shop_id = c_shop AND clocked_out IS NOT NULL AND total_minutes > 0;
  SELECT count(*) INTO b_open_old FROM public.employee_shifts
    WHERE shop_id = c_shop AND clocked_out IS NULL AND clocked_in < c_today;
  SELECT count(*) INTO b_open_today FROM public.employee_shifts
    WHERE shop_id = c_shop AND clocked_out IS NULL AND clocked_in >= c_today;
  SELECT md5(COALESCE(string_agg(id::text || COALESCE(clocked_out::text, '-'), ',' ORDER BY id), ''))
    INTO b_other FROM public.employee_shifts WHERE shop_id <> c_shop;
  SELECT count(*) INTO b_att FROM public.attendance;
  SELECT count(*) INTO b_orders FROM public.orders;

  SELECT COALESCE(string_agg(e.name || ' ' || to_char(s.clocked_in AT TIME ZONE 'Asia/Vientiane', 'YYYY-MM-DD HH24:MI'), '; ' ORDER BY s.clocked_in), '(none)')
    INTO v_list
    FROM public.employee_shifts s JOIN public.employees e ON e.id = s.employee_id
    WHERE s.shop_id = c_shop AND s.clocked_out IS NULL AND s.clocked_in < c_today;
  SELECT COALESCE(string_agg(tgname, ', '), '(none)') INTO v_triggers
    FROM pg_trigger WHERE tgrelid = 'public.employee_shifts'::regclass AND NOT tgisinternal;
  SELECT COALESCE(string_agg(p.proname, ', ' ORDER BY p.proname), '(none)') INTO v_funcs
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prosrc ILIKE '%employee_shifts%';

  -- ---- the fix (same statement as docs/close-stale-shifts.sql) ----
  UPDATE public.employee_shifts
     SET clocked_out = clocked_in
   WHERE shop_id = c_shop AND clocked_out IS NULL AND clocked_in < c_today;
  GET DIAGNOSTICS n = ROW_COUNT;

  report := report || E'\nINFO shifts that would be closed (' || n || '): ' || v_list;
  report := report || E'\nINFO open shifts started today, left open: ' || b_open_today;
  report := report || E'\nINFO closed shifts in the list: ' || b_closed || ' -> ' || (b_closed + n) || ' (the new ones show as 0 minutes)';
  report := report || E'\nINFO policies on employee_shifts: ' || COALESCE((
    SELECT string_agg(policyname || ' [' || cmd || ' ' || array_to_string(roles, '+') || ']', '; ' ORDER BY policyname)
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employee_shifts'), '(none)');
  report := report || E'\nINFO row level security on employee_shifts: ' || (
    SELECT CASE WHEN relrowsecurity THEN 'ON' ELSE 'OFF' END FROM pg_class WHERE oid = 'public.employee_shifts'::regclass);
  report := report || E'\nINFO table rights anon: ' || COALESCE((
    SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'employee_shifts' AND grantee = 'anon'), '(none)');
  report := report || E'\nINFO triggers on employee_shifts: ' || v_triggers;
  report := report || E'\nINFO functions that read employee_shifts: ' || v_funcs;

  report := report || E'\n' || CASE WHEN n = b_open_old THEN 'PASS' ELSE 'FAIL' END
    || ' T1 closed exactly the old open shifts (' || n || ' of ' || b_open_old || ')';

  SELECT count(*) INTO n FROM public.employee_shifts
    WHERE shop_id = c_shop AND clocked_out IS NULL AND clocked_in < c_today;
  report := report || E'\n' || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END
    || ' T2 no old open shift is left (' || n || ')';

  SELECT count(*) INTO n FROM public.employee_shifts
    WHERE shop_id = c_shop AND clocked_out IS NULL AND clocked_in >= c_today;
  report := report || E'\n' || CASE WHEN n = b_open_today THEN 'PASS' ELSE 'FAIL' END
    || ' T3 shifts started today are still open (' || n || ' of ' || b_open_today || ')';

  SELECT COALESCE(sum(total_minutes), 0) INTO n FROM public.employee_shifts WHERE shop_id = c_shop;
  report := report || E'\n' || CASE WHEN n = b_minutes THEN 'PASS' ELSE 'FAIL' END
    || ' T4 total worked minutes unchanged (' || b_minutes || ' -> ' || n || ')';

  SELECT count(*) INTO n FROM public.employee_shifts WHERE shop_id = c_shop;
  report := report || E'\n' || CASE WHEN n = b_rows THEN 'PASS' ELSE 'FAIL' END
    || ' T5 no shift row added or deleted (' || b_rows || ' -> ' || n || ')';

  SELECT count(*) INTO n FROM public.employee_shifts
    WHERE shop_id = c_shop AND clocked_out IS NOT NULL AND total_minutes > 0;
  report := report || E'\n' || CASE WHEN n = b_real THEN 'PASS' ELSE 'FAIL' END
    || ' T6 number of shifts with real hours unchanged (' || b_real || ' -> ' || n || ')';

  report := report || E'\n' || CASE WHEN b_other = (
      SELECT md5(COALESCE(string_agg(id::text || COALESCE(clocked_out::text, '-'), ',' ORDER BY id), ''))
      FROM public.employee_shifts WHERE shop_id <> c_shop) THEN 'PASS' ELSE 'FAIL' END
    || ' T7 other shops untouched';

  SELECT count(*) INTO n FROM public.attendance;
  report := report || E'\n' || CASE WHEN n = b_att THEN 'PASS' ELSE 'FAIL' END
    || ' T8 attendance (HR clock-in, used for salary) unchanged (' || n || ')';

  SELECT count(*) INTO n FROM public.orders;
  report := report || E'\n' || CASE WHEN n = b_orders THEN 'PASS' ELSE 'FAIL' END
    || ' T9 orders unchanged (' || n || ')';

  RAISE EXCEPTION E'STALE SHIFTS TEST RESULTS (nothing was changed)%', report;
END
$test$;
