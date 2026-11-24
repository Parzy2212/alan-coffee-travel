-- READ-ONLY, one SELECT. Run on production before test-074 / 074.
-- 074 replaces stock_waste: it must still be the 073 version (md5 below = the number 074's
-- first check expects; CR removed, blank lines at both ends dropped), and the new column,
-- index and 4-argument function must not exist yet. Changes nothing.
SELECT 'stock_waste versions' AS what, count(*)::text AS detail, (count(*) = 1)::text AS ok
FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'stock_waste'
UNION ALL
SELECT 'stock_waste(uuid,numeric,text) md5', md5(regexp_replace(regexp_replace(replace(prosrc, E'\r', ''), '^([ ]*\n)+', ''), '(\n[ ]*)+$', '')),
       (md5(regexp_replace(regexp_replace(replace(prosrc, E'\r', ''), '^([ ]*\n)+', ''), '(\n[ ]*)+$', '')) = 'fa5257aa34200f93a8d80c7a0c72e27d')::text
FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'stock_waste' AND pronargs = 3
UNION ALL
SELECT 'stock_waste 4-argument exists (must be false)', (to_regprocedure('public.stock_waste(uuid, numeric, text, uuid)') IS NOT NULL)::text,
       (to_regprocedure('public.stock_waste(uuid, numeric, text, uuid)') IS NULL)::text
UNION ALL
SELECT 'stock_movements.request_id exists (must be false)',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'request_id')::text,
       (NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'request_id'))::text
UNION ALL
SELECT 'stock_movements rows', count(*)::text, 'info' FROM public.stock_movements
UNION ALL
SELECT 'execute stock_waste anon / authenticated',
       has_function_privilege('anon', p.oid, 'EXECUTE') || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE'),
       (NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'stock_waste';
