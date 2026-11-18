-- 063: leave requests store a date range, as every screen already sends
--
-- Before: the live table (001) has one leave_date per row, but /cafe (StaffTab: list, new
-- request, approve, days used) and /staff (StaffClient: new request) read and write
-- start_date / end_date, so every request failed ("Could not find the 'end_date' column").
-- The table was empty on the prod copy of 2026-11-12: leave never worked.
-- After: start_date / end_date (end >= start); leave_date is filled from start_date for
-- anything that still reads it, and is no longer required.
-- Not changed here: who may read/write the table (anon can, policy "anon all
-- leave_requests") -- that is set 6.
-- Test first: docs/test-063-leave-requests-date-range.sql

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

-- PostgREST caches the columns: without this the app still says the column is missing
NOTIFY pgrst, 'reload schema';
