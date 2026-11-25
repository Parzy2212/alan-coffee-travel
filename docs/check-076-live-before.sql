-- READ-ONLY, one SELECT. Run on production before test-076 / 076.
-- held_orders must still have exactly 031's open policy (the string 076's first check expects)
-- and real_shop_role_in (057) must exist. Changes nothing.
SELECT 'held_orders policies' AS what,
       COALESCE(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname), '(none)') AS detail,
       (COALESCE(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname), '') = 'anon_held_orders_all|ALL|{anon}|true|true')::text AS ok
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'held_orders'
UNION ALL
SELECT 'held_orders RLS on', relrowsecurity::text, relrowsecurity::text FROM pg_class WHERE oid = 'public.held_orders'::regclass
UNION ALL
SELECT 'real_shop_role_in exists', (to_regprocedure('public.real_shop_role_in(text[])') IS NOT NULL)::text,
       (to_regprocedure('public.real_shop_role_in(text[])') IS NOT NULL)::text
UNION ALL
SELECT 'anon select / insert / delete on held_orders (before: true)',
       has_table_privilege('anon', 'public.held_orders', 'SELECT') || ' / ' || has_table_privilege('anon', 'public.held_orders', 'INSERT') || ' / ' || has_table_privilege('anon', 'public.held_orders', 'DELETE'),
       'info'
UNION ALL
SELECT 'held_orders rows / not expired', count(*)::text || ' / ' || count(*) FILTER (WHERE expires_at > now()), 'info' FROM public.held_orders
UNION ALL
SELECT 'real shop members (role/active)', string_agg(role || '/' || active::text, ', ' ORDER BY role), 'info'
FROM public.shop_users WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30';
