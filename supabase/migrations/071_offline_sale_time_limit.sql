-- 071: an offline bill may be back-dated at most 24 hours, and never before the open drawer session
--
-- Before: a bill sent with its own sale time (p_created_at = an offline bill) was accepted up to
-- 30 days back. Someone who edits the request in the browser could date a bill before the
-- current drawer session, so its cash belonged to no shift count.
-- After (owner decision 2026-11-18): an offline bill older than 24 hours, or sold before the
-- drawer session that is open now, is refused with SALE_TOO_OLD. It stays on the POS as a stuck
-- bill; a manager decides there (re-sell it in this shift, then remove it with their PIN).
-- The sale time comes from the tablet's clock, so 5 minutes of slack before opened_at keeps a
-- tablet running a little slow from losing bills sold right after the drawer was opened.
-- Run after 070. Test first: docs/test-071-offline-sale-time-limit.sql

-- checkout_order is edited in place on the live definition (repo copies of it have drifted
-- before): exactly one known piece is swapped, or the migration stops without changing anything.
DO $swap$
DECLARE
  v_fn  regprocedure;
  v_def text;
  v_old text := $o$  IF v_created < now() - interval '30 days' THEN
    RAISE EXCEPTION 'sale time out of range' USING ERRCODE = '22023';
  END IF;$o$;
  v_new text := $n$  -- an offline bill keeps its real sale time only within 24 hours and inside the open
  -- drawer session (071); an older one waits on the POS for a manager
  IF v_replay AND (v_created < now() - interval '24 hours' OR v_created < COALESCE(
       (SELECT s.opened_at - interval '5 minutes' FROM public.cash_sessions s WHERE s.shop_id = p_shop_id AND s.status <> 'closed'),
       '-infinity'::timestamptz)) THEN
    RAISE EXCEPTION 'SALE_TOO_OLD: sold %, more than 24 hours ago or before the open drawer session',
      to_char(v_created AT TIME ZONE 'Asia/Vientiane', 'YYYY-MM-DD HH24:MI') USING ERRCODE = '22023';
  END IF;$n$;
BEGIN
  SELECT p.oid::regprocedure INTO STRICT v_fn FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'checkout_order';
  v_def := pg_get_functiondef(v_fn);
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION '071: checkout_order does not look like the 061 version, nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END
$swap$;
