-- Read-only. Run in the Supabase SQL Editor as one query; copy the whole result grid back.
-- Counts the 3 people lists before the merge (employees becomes the one staff list).
-- Shows names and roles only: no PIN, no hash, no ID card, no salary.
WITH fk AS (
  SELECT c.confrelid::regclass::text AS target,
         c.conrelid::regclass::text  AS src_table,
         a.attname                   AS src_column,
         c.confdeltype               AS on_delete
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.contype = 'f'
    AND c.confrelid IN ('public.staff'::regclass, 'public.employees'::regclass)
)
SELECT '1 count' AS section, 'staff (HR)' AS item,
       format('total %s | active %s | with pin_hash %s | with plain pin_code %s | shop_id null %s',
              count(*), count(*) FILTER (WHERE is_active),
              count(*) FILTER (WHERE pin_hash IS NOT NULL),
              count(*) FILTER (WHERE pin_code IS NOT NULL),
              count(*) FILTER (WHERE shop_id IS NULL)) AS detail
FROM public.staff
UNION ALL
SELECT '1 count', 'employees (POS PIN)',
       format('total %s | active %s | manager %s | cashier %s',
              count(*), count(*) FILTER (WHERE is_active),
              count(*) FILTER (WHERE role = 'manager'),
              count(*) FILTER (WHERE role = 'cashier'))
FROM public.employees
UNION ALL
SELECT '1 count', 'shop_users (login)',
       format('total %s | active %s | owner %s | other roles %s',
              count(*), count(*) FILTER (WHERE active),
              count(*) FILTER (WHERE role = 'owner'),
              count(*) FILTER (WHERE role <> 'owner'))
FROM public.shop_users
UNION ALL
SELECT '2 names', 'staff: ' || name,
       format('role %s | active %s | has PIN %s | shop %s | id %s',
              role, is_active, pin_hash IS NOT NULL, coalesce(left(shop_id::text, 8), 'null'), id)
FROM public.staff
UNION ALL
SELECT '2 names', 'employees: ' || name,
       format('role %s | active %s | shop %s | id %s', role, is_active, left(shop_id::text, 8), id)
FROM public.employees
UNION ALL
SELECT '3 linked data', target || ' <- ' || src_table || '.' || src_column,
       format('rows %s | on delete %s',
              (xpath('/row/c/text()', query_to_xml(
                 format('SELECT count(*) AS c FROM %s WHERE %I IS NOT NULL', src_table, src_column),
                 false, true, '')))[1]::text,
              CASE on_delete WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set null' WHEN 'a' THEN 'no action'
                             WHEN 'r' THEN 'restrict' ELSE on_delete::text END)
FROM fk
ORDER BY 1, 2;
