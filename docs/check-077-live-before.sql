-- Read-only check before migration 077 (employees: writes owner/manager only, no public read). Changes nothing.
-- Every "ok" column should be true.
SELECT
  md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname))
    = '4cf8fb906fb7d1df7c1bd0f1cca95126'                                                  AS policies_ok,
  to_regprocedure('public.user_shop_ids_by_role(text[])') IS NOT NULL                       AS helper_ok,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.employees'::regclass)             AS rls_on,
  NOT has_column_privilege('anon', 'public.employees', 'pin_hash', 'SELECT')                AS anon_no_pin_hash,
  has_table_privilege('anon', 'public.employees', 'UPDATE')                                 AS anon_update_before,
  has_column_privilege('anon', 'public.employees', 'name', 'SELECT')                        AS anon_reads_names_before,
  (SELECT count(*) FROM public.employees)                                                   AS employees,
  (SELECT count(*) FROM public.shop_users WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30' AND role = 'owner' AND active) AS owners
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employees';
