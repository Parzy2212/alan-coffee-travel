-- Read-only: live definitions needed for package A+B (single checkout).
-- Changes nothing. One result table: section | name | detail.
-- Run in the Supabase SQL Editor, then "Download CSV" (the cells are long).

WITH fn AS (
  SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
trig AS (
  SELECT t.tgname, c.relname, t.tgenabled, t.tgfoid, pg_get_triggerdef(t.oid) AS def
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
    AND c.relname IN ('orders', 'order_items', 'cash_flow', 'customers', 'inventory', 'loyalty_transactions')
)
SELECT * FROM (
  -- 1. functions the checkout / void / reports path uses
  SELECT '1 function' AS section, f.proname || '(' || f.args || ')' AS name, pg_get_functiondef(f.oid) AS detail
  FROM fn f
  WHERE f.proname IN (
    'create_order_with_deduction', 'finalize_order_payment', 'void_order_with_approval', 'void_order',
    'get_daily_queue_number', 'generate_receipt_number', 'check_stock_for_cart', 'update_queue_status',
    'get_today_pos_queue', 'get_today_orders', 'get_dashboard_stats', 'close_shift',
    'upsert_customer', 'crm_upsert_customer', 'user_shop_ids', 'pos_attempt_check'
  )

  UNION ALL
  -- 2. trigger functions on the tables above
  SELECT '2 trigger function', f.proname || '()', pg_get_functiondef(f.oid)
  FROM fn f WHERE f.oid IN (SELECT tgfoid FROM trig)

  UNION ALL
  -- 3. triggers (enabled: O = on, D = off)
  SELECT '3 trigger', relname || '.' || tgname || ' [' || tgenabled::text || ']', def FROM trig

  UNION ALL
  -- 4. columns
  SELECT '4 columns', c.table_name,
         string_agg(c.column_name || ' ' || c.data_type
                    || CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
                    || COALESCE(' DEFAULT ' || c.column_default, ''), E'\n' ORDER BY c.ordinal_position)
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name IN ('orders', 'order_items', 'recipes', 'recipe_ingredients', 'recipe_bases',
                         'recipe_base_ingredients', 'inventory', 'stock_movements', 'cash_flow',
                         'customers', 'loyalty_settings', 'loyalty_transactions', 'employees', 'shops', 'audit_logs')
  GROUP BY c.table_name

  UNION ALL
  -- 5. constraints and indexes on orders / order_items / cash_flow
  SELECT '5 constraint', conrelid::regclass::text || '.' || conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid IN ('public.orders'::regclass, 'public.order_items'::regclass, 'public.cash_flow'::regclass)
  UNION ALL
  SELECT '5 index', tablename || '.' || indexname, indexdef
  FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('orders', 'order_items', 'cash_flow')

  UNION ALL
  -- 6. RLS policies on the same tables
  SELECT '6 policy', tablename || '.' || policyname,
         cmd || ' TO ' || array_to_string(roles, ',') || ' USING ' || COALESCE(qual, '-') || ' CHECK ' || COALESCE(with_check, '-')
  FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('orders', 'order_items', 'cash_flow', 'customers', 'inventory')

  UNION ALL
  -- 7. who may call the section-1 functions
  SELECT '7 grants', f.proname || '(' || f.args || ')',
         'anon=' || has_function_privilege('anon', f.oid, 'EXECUTE')
         || ' authenticated=' || has_function_privilege('authenticated', f.oid, 'EXECUTE')
  FROM fn f
  WHERE f.proname IN ('create_order_with_deduction', 'finalize_order_payment', 'void_order_with_approval',
                      'update_queue_status', 'get_today_orders', 'close_shift', 'upsert_customer')

  UNION ALL
  -- 8. every public function name (to spot ones not listed above)
  SELECT '8 all functions', count(*)::text, string_agg(proname || '(' || args || ')', E'\n' ORDER BY proname)
  FROM fn
) x
ORDER BY section, name;
