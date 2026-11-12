-- ============================================================
--  Audit: what can the public "anon" role write, delete or call?
--
--  READ ONLY. One SELECT, no data is changed and no row of shop data
--  is read (only table names, rights, policies and row-count estimates).
--
--  Why: every browser call of the POS uses the anon key, which is public.
--  "anon can" = "anyone on the internet can".
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor): paste the whole
--  file, Run, then use "Export" / copy all rows and send them back.
--
--  Sections in the result:
--    1 TABLE     tables in public where anon can INSERT/UPDATE/DELETE
--                (rights + row security + the policies that let anon in)
--    2 NO-RLS    tables in public with row security OFF and any anon right
--    3 STORAGE   storage policies that let anon/public write files
--    4 FUNCTION  SECURITY DEFINER functions anon may call
--  risk: HIGH = anon can change or delete every row
--        MED  = anon can add rows, or change rows under a condition
--        LOOK = needs reading (function body decides)
-- ============================================================

WITH anon_roles AS (
  SELECT unnest(ARRAY['anon', 'public']) AS r
),
tbl AS (
  SELECT c.oid, c.relname, c.relrowsecurity AS rls, c.reltuples::bigint AS est_rows,
         has_table_privilege('anon', c.oid, 'INSERT')   AS g_ins,
         has_table_privilege('anon', c.oid, 'UPDATE')   AS g_upd,
         has_table_privilege('anon', c.oid, 'DELETE')   AS g_del,
         has_table_privilege('anon', c.oid, 'TRUNCATE') AS g_trunc,
         has_table_privilege('anon', c.oid, 'SELECT')   AS g_sel
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
),
pol AS (
  SELECT p.schemaname, p.tablename, p.policyname, p.cmd, p.permissive,
         array_to_string(p.roles, '+') AS roles,
         COALESCE(p.qual, '') AS qual, COALESCE(p.with_check, '') AS with_check,
         (COALESCE(p.qual, 'true') = 'true' AND COALESCE(p.with_check, 'true') = 'true') AS wide_open
  FROM pg_policies p
  WHERE p.roles && ARRAY['anon', 'public']::name[]
),
tbl_pol AS (
  SELECT t.*,
         COALESCE(bool_or(p.cmd IN ('ALL', 'INSERT')), false) AS p_ins,
         COALESCE(bool_or(p.cmd IN ('ALL', 'UPDATE')), false) AS p_upd,
         COALESCE(bool_or(p.cmd IN ('ALL', 'DELETE')), false) AS p_del,
         COALESCE(bool_or(p.cmd IN ('ALL', 'UPDATE', 'DELETE') AND p.wide_open), false) AS p_open_change,
         COALESCE(string_agg(p.policyname || ' [' || p.cmd || ' ' || p.roles || '] using(' || left(p.qual, 80) || ') check(' || left(p.with_check, 80) || ')',
                             ' ; ' ORDER BY p.policyname) FILTER (WHERE p.cmd <> 'SELECT'), '') AS write_policies
  FROM tbl t LEFT JOIN pol p ON p.schemaname = 'public' AND p.tablename = t.relname
  GROUP BY t.oid, t.relname, t.rls, t.est_rows, t.g_ins, t.g_upd, t.g_del, t.g_trunc, t.g_sel
),
eff AS (
  SELECT *,
         g_ins AND (NOT rls OR p_ins) AS can_ins,
         g_upd AND (NOT rls OR p_upd) AS can_upd,
         g_del AND (NOT rls OR p_del) AS can_del
  FROM tbl_pol
)
SELECT '1 TABLE' AS section,
       CASE WHEN (can_upd OR can_del) AND (NOT rls OR p_open_change) THEN 'HIGH'
            ELSE 'MED' END AS risk,
       relname AS name,
       concat_ws(',', CASE WHEN can_ins THEN 'INSERT' END, CASE WHEN can_upd THEN 'UPDATE' END, CASE WHEN can_del THEN 'DELETE' END) AS anon_can,
       CASE WHEN rls THEN 'RLS ON' ELSE 'RLS OFF' END || ', ~' || GREATEST(est_rows, 0) || ' rows' AS detail,
       write_policies AS policies
FROM eff
WHERE can_ins OR can_upd OR can_del

UNION ALL
SELECT '2 NO-RLS', CASE WHEN g_upd OR g_del OR g_trunc THEN 'HIGH' WHEN g_ins THEN 'MED' ELSE 'LOOK' END,
       relname,
       concat_ws(',', CASE WHEN g_sel THEN 'SELECT' END, CASE WHEN g_ins THEN 'INSERT' END, CASE WHEN g_upd THEN 'UPDATE' END,
                 CASE WHEN g_del THEN 'DELETE' END, CASE WHEN g_trunc THEN 'TRUNCATE' END),
       'RLS OFF, ~' || GREATEST(est_rows, 0) || ' rows', ''
FROM tbl
WHERE NOT rls AND (g_sel OR g_ins OR g_upd OR g_del OR g_trunc)

UNION ALL
SELECT '3 STORAGE', CASE WHEN cmd IN ('ALL', 'UPDATE', 'DELETE') THEN 'HIGH' ELSE 'MED' END,
       tablename || ': ' || policyname, cmd, 'roles ' || roles,
       'using(' || left(qual, 120) || ') check(' || left(with_check, 120) || ')'
FROM pol
WHERE schemaname = 'storage' AND cmd <> 'SELECT'

UNION ALL
SELECT '4 FUNCTION', 'LOOK',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'EXECUTE',
       CASE WHEN p.provolatile = 'v' THEN 'may write' ELSE 'read only (declared)' END
         || CASE WHEN p.prosrc ~* 'auth\.uid\(\)|user_shop_ids' THEN ', checks the caller' ELSE ', no caller check seen' END,
       ''
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')

ORDER BY 1, 2, 3;
