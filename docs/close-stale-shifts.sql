-- ============================================================
--  Close POS shifts that were left open (employee_shifts)
--
--  STATUS: DRAFT -- not run on production yet.
--  Run docs/test-close-stale-shifts.sql first (changes nothing, ends
--  in an error that is the report), then this file.
--
--  Why: the POS opens a new shift on every PIN entry and only closes
--  it when "ปิดกะ" is pressed, so closing the browser leaves the shift
--  open for ever. /shop/team/employees then shows "N กำลังทำงาน".
--
--  What it does: every shift of the real shop that is still open and
--  started before today (Asia/Vientiane) gets clocked_out = clocked_in
--  (a closed shift of 0 minutes). Nothing is deleted, shifts started
--  today stay open, other shops are not touched.
--
--  Not affected: attendance (HR clock-in, used for salary), orders,
--  cash flow. total_minutes of the closed shifts is 0, so no hours or
--  earnings are added to the shift history.
--  Visible change: in an employee's shift history (last 30 days) the
--  closed ones show as 0-minute shifts and count in "กะทั้งหมด".
--  Before running: press "ปิดกะ" / close every open POS tab. A POS tab
--  still signed in on an old shift would overwrite its 0 minutes with
--  a very long shift when "ปิดกะ" is pressed later.
--  Not a permanent cure: the POS still opens a shift on every PIN
--  entry, so new stale shifts appear until that is changed in code.
--
--  Safe to run twice (the second run finds nothing).
--  Rollback: none needed for reports; the original state (open) can be
--  restored with UPDATE ... SET clocked_out = NULL WHERE clocked_out =
--  clocked_in AND shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30'.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
-- ============================================================

DO $fix$
DECLARE
  c_shop  constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_today constant timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Vientiane') AT TIME ZONE 'Asia/Vientiane';
  n int;
BEGIN
  UPDATE public.employee_shifts
     SET clocked_out = clocked_in
   WHERE shop_id = c_shop AND clocked_out IS NULL AND clocked_in < c_today;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'closed % stale shift(s)', n;
END
$fix$;
