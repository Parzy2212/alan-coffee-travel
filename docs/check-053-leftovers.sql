-- ============================================================
--  READ-ONLY check: did docs/test-053-void-order-with-approval.sql leave
--  anything behind on production? (2026-11-10)
--
--  Only SELECTs: changes nothing, safe to run any number of times.
--  One result table (the SQL Editor shows only the last result), one row
--  per check: item / n / detail. Copy the whole table back.
--
--  Why it can have left data: the test's setup + tests are ONE DO block.
--  If the editor ran the statements without the surrounding BEGIN (each
--  statement committed on its own), that DO block committed as a whole,
--  and only the final "report" DO block failed. Then everything below
--  exists together; if the DO block did not commit, none of it exists
--  (a DO block is all or nothing). The disabled Telegram trigger is a
--  top-level statement, which is why it may be the only leftover.
-- ============================================================

WITH
test_emp AS (SELECT id FROM public.employees WHERE name LIKE 'test053 %'),
test_cust AS (SELECT id FROM public.customers WHERE phone LIKE 'test053-%' OR name = 'test053 customer'),
test_ord AS (
  SELECT * FROM public.orders
  WHERE void_reason LIKE 'test053%'
     OR voided_by_employee_id IN (SELECT id FROM test_emp)
     OR customer_id IN (SELECT id FROM test_cust)
),
test_inv AS (
  SELECT DISTINCT ri.inventory_id AS id
  FROM public.order_items oi
  JOIN public.recipe_ingredients ri ON ri.recipe_id = oi.recipe_id
  WHERE oi.order_id IN (SELECT id FROM test_ord) AND ri.inventory_id IS NOT NULL
)
SELECT '01 triggers on orders (O = on, D = off)' AS item, count(*)::bigint AS n,
       jsonb_agg(jsonb_build_object('name', t.tgname, 'enabled', t.tgenabled,
                                    'def', pg_get_triggerdef(t.oid)) ORDER BY t.tgname) AS detail
FROM pg_trigger t WHERE t.tgrelid = 'public.orders'::regclass AND NOT t.tgisinternal

UNION ALL
SELECT '02 053 installed: columns + queue fn without voided filter', NULL,
       jsonb_build_object(
         'voided_at', EXISTS (SELECT 1 FROM information_schema.columns
                              WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'voided_at'),
         'voided_by_employee_id', EXISTS (SELECT 1 FROM information_schema.columns
                              WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'voided_by_employee_id'),
         'queue_fn_mentions_voided', pg_get_functiondef('public.get_daily_queue_number()'::regprocedure) LIKE '%voided%',
         'void_fn_search_path', (SELECT p.proconfig FROM pg_proc p
                                 WHERE p.oid = 'public.void_order_with_approval(uuid,uuid,text,text)'::regprocedure))

UNION ALL
SELECT '03 orders total / voided (expect 82 / 0 if no leftovers)',
       (SELECT count(*) FROM public.orders),
       jsonb_build_object('voided_at_not_null', (SELECT count(*) FROM public.orders WHERE voided_at IS NOT NULL),
                          'status_void', (SELECT count(*) FROM public.orders WHERE status IN ('void', 'voided')))

UNION ALL
SELECT '04 test orders (50,000 bill)', count(*), jsonb_agg(to_jsonb(o)) FROM test_ord o

UNION ALL
SELECT '05 order_items of test orders', count(*), jsonb_agg(to_jsonb(oi))
FROM public.order_items oi WHERE oi.order_id IN (SELECT id FROM test_ord)

UNION ALL
SELECT '06 test employees (test053 ...)', count(*),
       jsonb_agg(to_jsonb(e) - 'pin_hash')
FROM public.employees e WHERE e.id IN (SELECT id FROM test_emp)

UNION ALL
SELECT '07 real shop employees (active count in n)',
       count(*) FILTER (WHERE e.is_active),
       jsonb_agg(to_jsonb(e) - 'pin_hash' ORDER BY e.name)
FROM public.employees e
WHERE e.shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30' AND e.name NOT LIKE 'test053 %'

UNION ALL
SELECT '08 test shops (test053-...)', count(*), jsonb_agg(to_jsonb(s))
FROM public.shops s WHERE s.slug LIKE 'test053-%' OR s.name = 'test053 other shop'

UNION ALL
SELECT '09 test customers', count(*), jsonb_agg(to_jsonb(c))
FROM public.customers c WHERE c.id IN (SELECT id FROM test_cust)

UNION ALL
SELECT '10 loyalty rows of test orders/customers', count(*), jsonb_agg(to_jsonb(l))
FROM public.loyalty_transactions l
WHERE l.order_id IN (SELECT id FROM test_ord) OR l.customer_id IN (SELECT id FROM test_cust)

UNION ALL
SELECT '11 audit_logs of test orders', count(*), jsonb_agg(to_jsonb(a))
FROM public.audit_logs a
WHERE a.row_id IN (SELECT id FROM test_ord) OR a.after_data::text LIKE '%test053%'

UNION ALL
SELECT '12 stock of the test recipe ingredients (+100,000 if left over)', count(*), jsonb_agg(to_jsonb(i))
FROM public.inventory i WHERE i.id IN (SELECT id FROM test_inv)

UNION ALL
SELECT '13 any inventory row >= 100,000', count(*), jsonb_agg(to_jsonb(i))
FROM public.inventory i WHERE i.current_qty >= 100000

UNION ALL
SELECT '14 pin_attempts (all rows)', count(*), jsonb_agg(to_jsonb(p))
FROM public.pin_attempts p

UNION ALL
SELECT '15 tables with a foreign key to orders', count(*),
       jsonb_agg(jsonb_build_object('table', c.conrelid::regclass::text, 'fk', pg_get_constraintdef(c.oid)))
FROM pg_constraint c WHERE c.contype = 'f' AND c.confrelid = 'public.orders'::regclass

UNION ALL
SELECT '16 cash flow trigger function (to find its row)', NULL,
       to_jsonb(pg_get_functiondef(t.tgfoid))
FROM pg_trigger t WHERE t.tgrelid = 'public.orders'::regclass AND t.tgname = 'trg_order_to_cashflow'

ORDER BY 1;
