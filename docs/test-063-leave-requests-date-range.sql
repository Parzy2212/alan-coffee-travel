-- ============================================================
--  Test for migration 063 (leave requests store a date range)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("063 TEST RESULTS ..."), so everything rolls back. Every line should
--  start with PASS. Run in Supabase SQL Editor as postgres, copy the error text back.
--  The migration part is a copy of supabase/migrations/063_leave_requests_date_range.sql
--  (minus the NOTIFY, which only matters after a real commit).
-- ============================================================
DO $test$
DECLARE
  report text := '';
  v_staff uuid;
  v_id uuid;
  v_row record;
BEGIN
  SELECT id INTO v_staff FROM public.staff ORDER BY created_at LIMIT 1;
  IF v_staff IS NULL THEN RAISE EXCEPTION '063 TEST: no staff row to attach a test request to'; END IF;

  -- ---- body of 063 ----
  ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS start_date date;
  ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS end_date date;
  UPDATE public.leave_requests SET start_date = leave_date WHERE start_date IS NULL;
  UPDATE public.leave_requests SET end_date = start_date WHERE end_date IS NULL;
  ALTER TABLE public.leave_requests ALTER COLUMN start_date SET NOT NULL;
  ALTER TABLE public.leave_requests ALTER COLUMN end_date SET NOT NULL;
  ALTER TABLE public.leave_requests ALTER COLUMN leave_date DROP NOT NULL;
  ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_range_chk;
  ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_range_chk CHECK (end_date >= start_date);
  CREATE OR REPLACE FUNCTION public.leave_requests_fill_leave_date()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
  BEGIN
    NEW.leave_date := NEW.start_date;
    RETURN NEW;
  END
  $fn$;
  DROP TRIGGER IF EXISTS trg_leave_requests_fill_leave_date ON public.leave_requests;
  CREATE TRIGGER trg_leave_requests_fill_leave_date BEFORE INSERT OR UPDATE OF start_date ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.leave_requests_fill_leave_date();

  -- ---- tests ----
  -- T1 the insert the screens send (no leave_date) works
  INSERT INTO public.leave_requests (staff_id, leave_type, start_date, end_date, reason, status)
  VALUES (v_staff, 'sick', DATE '2026-12-01', DATE '2026-12-03', 'TEST063', 'pending') RETURNING id INTO v_id;
  SELECT * INTO v_row FROM public.leave_requests WHERE id = v_id;
  report := report || CASE WHEN v_row.start_date = DATE '2026-12-01' AND v_row.end_date = DATE '2026-12-03'
      THEN E'\nPASS T1 request with start/end saved' ELSE E'\nFAIL T1' END;
  -- T2 leave_date follows start_date
  report := report || CASE WHEN v_row.leave_date = DATE '2026-12-01' THEN E'\nPASS T2 leave_date filled from start_date' ELSE E'\nFAIL T2' END;
  -- T3 approve (the screen's update) works
  UPDATE public.leave_requests SET status = 'approved' WHERE id = v_id;
  report := report || CASE WHEN (SELECT status FROM public.leave_requests WHERE id = v_id) = 'approved' THEN E'\nPASS T3 approve works' ELSE E'\nFAIL T3' END;
  -- T4 end before start is refused
  BEGIN
    INSERT INTO public.leave_requests (staff_id, leave_type, start_date, end_date, status)
    VALUES (v_staff, 'sick', DATE '2026-12-05', DATE '2026-12-04', 'pending');
    report := report || E'\nFAIL T4 end before start accepted';
  EXCEPTION WHEN check_violation THEN
    report := report || E'\nPASS T4 end before start refused';
  END;
  -- T5 a request without dates is refused
  BEGIN
    INSERT INTO public.leave_requests (staff_id, leave_type, status) VALUES (v_staff, 'sick', 'pending');
    report := report || E'\nFAIL T5 request without dates accepted';
  EXCEPTION WHEN not_null_violation THEN
    report := report || E'\nPASS T5 dates required';
  END;

  RAISE EXCEPTION '063 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
