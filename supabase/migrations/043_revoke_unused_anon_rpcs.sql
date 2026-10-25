-- ============================================================
--  Alan Cafe OS -- Migration 043: revoke anon/authenticated EXECUTE on
--  RPCs the app never calls (audit group "ข")
--
--  Run on production (run date not recorded). Verified live 2026-10-25
--  with a read-only catalog query: every listed function is service_role
--  only (anon/authenticated EXECUTE = false).
--
--  No code in app/, components/, lib/, supabase/functions/ or
--  print-server/ calls any of these (checked by name, including
--  /rest/v1/rpc/...). They are SECURITY DEFINER with no caller or shop
--  check, so anon can call them with the public key:
--    create_staff, update_staff        -- write staff incl. plaintext pin_code
--    get_attendance_report             -- all staff attendance
--    clock_out                         -- app writes attendance directly instead
--    add_loyalty_points, submit_purchase_request,
--    create_recipe, update_recipe, update_recipe_price,
--    get_sales_chart, get_top_items    -- superseded by *_full / dashboard RPCs
--    notify_telegram                   -- exists only in the live DB (not in
--                                         any migration); signature unknown
--
--  Revoking EXECUTE does not affect triggers that use these functions, or
--  calls from other SECURITY DEFINER functions (those run as the owner).
--  It WOULD break a call from a SECURITY INVOKER function run by anon,
--  so run step 0 first and read the result.
--
--  Not included (still used internally -- verify live before touching):
--  generate_receipt_number, get_daily_queue_number, check_stock_for_cart.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
--  Safe to run multiple times.
-- ============================================================

-- 0) BEFORE: who references these functions inside the DB?
--    (other functions' source, and triggers) -- review before step 1.
--    Not covered: pg_cron jobs -- if pg_cron is enabled, also check
--    SELECT jobname, command FROM cron.job;
SELECT p.proname AS referencing_function, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosrc ~ '\m(create_staff|update_staff|get_attendance_report|clock_out|add_loyalty_points|submit_purchase_request|create_recipe|update_recipe|update_recipe_price|get_sales_chart|get_top_items|notify_telegram)\M'
  AND p.proname NOT IN ('create_staff','update_staff','get_attendance_report','clock_out','add_loyalty_points',
                        'submit_purchase_request','create_recipe','update_recipe','update_recipe_price',
                        'get_sales_chart','get_top_items','notify_telegram');

SELECT tgrelid::regclass AS on_table, tgname, tgfoid::regproc AS trigger_function
FROM pg_trigger WHERE NOT tgisinternal
  AND tgfoid::regproc::text ~ '\m(create_staff|update_staff|get_attendance_report|clock_out|add_loyalty_points|submit_purchase_request|create_recipe|update_recipe|update_recipe_price|get_sales_chart|get_top_items|notify_telegram)\M';

-- Exact live signatures (notify_telegram's is unknown from the repo)
SELECT p.oid::regprocedure AS signature,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_staff','update_staff','get_attendance_report','clock_out','add_loyalty_points',
                    'submit_purchase_request','create_recipe','update_recipe','update_recipe_price',
                    'get_sales_chart','get_top_items','notify_telegram')
ORDER BY 1;

-- 1) Lock down every overload by name (atomic)
BEGIN;

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_staff','update_staff','get_attendance_report','clock_out','add_loyalty_points',
                        'submit_purchase_request','create_recipe','update_recipe','update_recipe_price',
                        'get_sales_chart','get_top_items','notify_telegram')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

COMMIT;

-- 2) AFTER: every row must show anon_can = false and authenticated_can = false
SELECT p.oid::regprocedure AS signature,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_can
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_staff','update_staff','get_attendance_report','clock_out','add_loyalty_points',
                    'submit_purchase_request','create_recipe','update_recipe','update_recipe_price',
                    'get_sales_chart','get_top_items','notify_telegram')
ORDER BY 1;
