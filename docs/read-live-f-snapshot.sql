-- ============================================================
--  Snapshot for package F (close the public "anon" write access).
--
--  READ ONLY. One SELECT. Nothing is changed. No shop data is read:
--  only names, rights, policy text, function source, column names and
--  row / file counts.
--
--  Two uses:
--    1. the source for writing each F migration (the repo migrations are
--       older than the real database)
--    2. the "before" copy of every policy and function, so any F step can
--       be put back exactly as it was
--
--  Run in the Supabase SQL Editor: paste the whole file, set the row
--  limit next to the Run button to "No limit" (the default cuts the
--  result at 100 rows), Run, then "Export" -> "Download CSV" (cells are
--  long; do not copy by hand).
--  Check: the first row ("0 count") says how many rows there must be.
--  Keep the CSV out of the repo (the repo is public).
--
--  Result columns: section | name | detail
--    0 count       how many rows the full result has, per section
--    1 policy      every row-security policy in public + storage (full text)
--    2 table       row security on/off, what anon / authenticated may do
--                  (public + storage tables and views)
--    3 columns     column list of every public table
--    4 col-grant   column-level rights of anon / authenticated
--    5 function    every public function anon or a signed-in user may
--                  call, or that runs as owner: rights line, then source
--    6 trigger     triggers on public + auth tables (O = on, D = off)
--    7 bucket      storage buckets: public or not, file count
--    8 default     default rights given to new tables / functions
--    9 view        view source and options (security_invoker or not)
-- ============================================================

WITH s AS (

  SELECT '1 policy' AS section,
         p.schemaname || '.' || p.tablename || ' : ' || p.policyname AS name,
         p.cmd || ' | ' || p.permissive || ' | roles ' || array_to_string(p.roles, '+')
           || E'\nUSING: ' || COALESCE(p.qual, '(none)')
           || E'\nCHECK: ' || COALESCE(p.with_check, '(none)') AS detail
  FROM pg_policies p
  WHERE p.schemaname IN ('public', 'storage')

  UNION ALL
  SELECT '2 table', CASE WHEN n.nspname = 'public' THEN '' ELSE n.nspname || '.' END || c.relname,
         CASE WHEN c.relrowsecurity THEN 'RLS ON' ELSE 'RLS OFF' END
           || CASE WHEN c.relforcerowsecurity THEN ' (forced)' ELSE '' END
           || ' | ~' || GREATEST(c.reltuples::bigint, 0) || ' rows'
           || ' | anon: ' || concat_ws(',',
                CASE WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 'S' END,
                CASE WHEN has_table_privilege('anon', c.oid, 'INSERT') THEN 'I' END,
                CASE WHEN has_table_privilege('anon', c.oid, 'UPDATE') THEN 'U' END,
                CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'D' END,
                CASE WHEN has_table_privilege('anon', c.oid, 'TRUNCATE') THEN 'T' END)
           || ' | authenticated: ' || concat_ws(',',
                CASE WHEN has_table_privilege('authenticated', c.oid, 'SELECT') THEN 'S' END,
                CASE WHEN has_table_privilege('authenticated', c.oid, 'INSERT') THEN 'I' END,
                CASE WHEN has_table_privilege('authenticated', c.oid, 'UPDATE') THEN 'U' END,
                CASE WHEN has_table_privilege('authenticated', c.oid, 'DELETE') THEN 'D' END,
                CASE WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE') THEN 'T' END)
           || ' | kind ' || c.relkind::text || ' | owner ' || pg_get_userbyid(c.relowner)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'p', 'v', 'm')

  UNION ALL
  SELECT '3 columns', c.table_name,
         string_agg(c.column_name || ' ' || c.data_type
                    || CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
                    || CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || left(c.column_default, 60) ELSE '' END,
                    E'\n' ORDER BY c.ordinal_position)
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  GROUP BY c.table_name

  UNION ALL
  SELECT '4 col-grant', cp.table_name || ' : ' || cp.grantee || ' ' || cp.privilege_type,
         string_agg(cp.column_name, ', ' ORDER BY cp.column_name)
  FROM information_schema.column_privileges cp
  JOIN pg_class c ON c.relname = cp.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = cp.table_schema
  WHERE cp.table_schema = 'public' AND cp.grantee IN ('anon', 'authenticated', 'PUBLIC')
    AND NOT has_table_privilege(CASE WHEN cp.grantee = 'PUBLIC' THEN 'anon' ELSE cp.grantee END, c.oid, cp.privilege_type)
  GROUP BY cp.table_name, cp.grantee, cp.privilege_type

  UNION ALL
  SELECT '5 function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         '-- anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
           || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
           || ' service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE')
           || ' | ' || CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END
           || ' | ' || l.lanname
           || ' | ' || CASE p.provolatile WHEN 'v' THEN 'volatile' WHEN 's' THEN 'stable' ELSE 'immutable' END
           || ' | owner ' || pg_get_userbyid(p.proowner)
           || ' | acl ' || COALESCE(p.proacl::text, '(default)')
           || E'\n' || pg_get_functiondef(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND l.lanname IN ('plpgsql', 'sql')
    AND (p.prosecdef OR has_function_privilege('anon', p.oid, 'EXECUTE')
         OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')

  UNION ALL
  SELECT '6 trigger',
         CASE WHEN n.nspname = 'public' THEN '' ELSE n.nspname || '.' END || c.relname || '.' || t.tgname || ' [' || t.tgenabled::text || ']',
         pg_get_triggerdef(t.oid)
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'auth') AND NOT t.tgisinternal

  UNION ALL
  SELECT '7 bucket', b.id,
         'public=' || b.public::text || ' | files=' || (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id)
  FROM storage.buckets b

  UNION ALL
  SELECT '8 default', COALESCE(n.nspname, '(all schemas)') || ' : ' || a.defaclobjtype::text || ' by ' || pg_get_userbyid(a.defaclrole),
         a.defaclacl::text
  FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid = a.defaclnamespace
  WHERE n.nspname = 'public' OR a.defaclnamespace = 0

  UNION ALL
  SELECT '9 view', c.relname,
         'options ' || COALESCE(array_to_string(c.reloptions, ','), '(none)') || ' | owner ' || pg_get_userbyid(c.relowner)
           || E'\n' || pg_get_viewdef(c.oid, true)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')

)
SELECT section, name, detail FROM (
  SELECT '0 count' AS section, 'rows in the full result' AS name,
         (count(*) + 1)::text || ' rows = 1 (this row) + '
           || COALESCE((SELECT string_agg(section || ': ' || n, ', ' ORDER BY section)
                        FROM (SELECT section, count(*) AS n FROM s GROUP BY section) x), 'nothing') AS detail
  FROM s
  UNION ALL
  SELECT section, name, detail FROM s
) r
ORDER BY 1, 2;
