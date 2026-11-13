-- ============================================================
--  Weekly short / over report to Telegram, every Sunday 23:55 Laos time
--  (= 16:55 UTC; pg_cron runs in UTC). Late so a Sunday-night close is
--  still in that week (the report covers Monday-Sunday by close date).
--
--  Before running: Supabase Dashboard -> Database -> Extensions,
--  search "pg_cron" and switch it on (also check "pg_net" is on: every
--  Telegram message goes through it).
--
--  Then run this file in the SQL Editor. Safe to run again (it replaces
--  the job). It sends nothing now; the first message comes on Sunday.
--  Needs migration 059 (cash_week_report_send).
--
--  To stop it later:  SELECT cron.unschedule('cash-week-report');
--  To see past runs:  SELECT * FROM cron.job_run_details
--                     WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cash-week-report')
--                     ORDER BY start_time DESC LIMIT 5;
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron is not switched on: Dashboard -> Database -> Extensions -> pg_cron';
  END IF;
  IF to_regprocedure('public.cash_week_report_send()') IS NULL THEN
    RAISE EXCEPTION 'run migration 059 first';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cash-week-report') THEN
    PERFORM cron.unschedule('cash-week-report');
  END IF;
  PERFORM cron.schedule('cash-week-report', '55 16 * * 0', 'SELECT public.cash_week_report_send()');
END
$$;

SELECT jobname, schedule, command, active FROM cron.job WHERE jobname = 'cash-week-report';
