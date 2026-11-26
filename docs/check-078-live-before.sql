-- Read-only check before migration 078 (shop_users: self-insert only as first owner of an empty shop). Changes nothing.
-- Every "ok" column should be true. shops_without_members = shops anyone could still claim as first owner after 078.
SELECT
  md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname))
    = 'b1f9b0c00bde236d01df69df2b80189b'                                                   AS policies_ok,
  to_regprocedure('public.shop_has_members(uuid)') IS NULL                                   AS helper_name_free_ok,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.shop_users'::regclass)            AS rls_on,
  NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.shop_users'::regclass AND NOT tgisinternal) AS no_triggers_ok,
  (SELECT count(*) FROM public.shop_users WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30') AS real_shop_members,
  (SELECT count(*) FROM public.shop_users WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30' AND role IN ('owner', 'manager') AND active) AS real_shop_owners_managers,
  (SELECT count(*) FROM public.shops s WHERE NOT EXISTS (SELECT 1 FROM public.shop_users u WHERE u.shop_id = s.id)) AS shops_without_members
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_users';
