-- ============================================================
--  077 — POS staff list (employees): only the shop's owner or manager can add, edit or remove;
--        the public key can no longer read it at all
--
--  The live policy employees_shop_member allowed ALL to any active member of the shop, so a
--  cashier account signed in on the till could set a new PIN (pin_hash) or role for any
--  employee, then use that "manager PIN" to approve its own void or discount (053/070).
--    * read: unchanged (any active member of the shop, same expression as before)
--    * add / edit / remove: active owner or manager of that shop (user_shop_ids_by_role)
--  The public key (anon) loses employees_anon_read and every grant. pin_hash was already hidden
--  from anon by column grants, but names, roles and shop ids were readable by anyone. PIN checks
--  go through verify_employee_pin (SECURITY DEFINER, returns no hash), so the till and clock-in
--  screens do not read this table. The two /cafe counters that used the public key (getting
--  started list, health check) now read with the signed-in session (same push).
-- ============================================================

-- 0) the policies must be exactly the ones checked on production 2026-11-25, or 077's own
DO $chk$
DECLARE
  v_fp text;
BEGIN
  SELECT md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname))
    INTO v_fp FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employees';
  IF v_fp IS DISTINCT FROM '4cf8fb906fb7d1df7c1bd0f1cca95126'
     AND v_fp IS DISTINCT FROM '20ca89a1973b1d6f366cbdbd56c914f7' THEN
    RAISE EXCEPTION '077: employees policies are not the expected ones, nothing changed (fingerprint %)', v_fp;
  END IF;
  IF to_regprocedure('public.user_shop_ids_by_role(text[])') IS NULL THEN
    RAISE EXCEPTION '077: user_shop_ids_by_role not found, nothing changed';
  END IF;
END
$chk$;

DROP POLICY IF EXISTS employees_shop_member ON public.employees;
DROP POLICY IF EXISTS employees_anon_read ON public.employees;
DROP POLICY IF EXISTS employees_member_select ON public.employees;
DROP POLICY IF EXISTS employees_manager_insert ON public.employees;
DROP POLICY IF EXISTS employees_manager_update ON public.employees;
DROP POLICY IF EXISTS employees_manager_delete ON public.employees;

CREATE POLICY employees_member_select ON public.employees FOR SELECT TO authenticated
  USING (shop_id IN (SELECT shop_users.shop_id FROM public.shop_users
                      WHERE shop_users.user_id = auth.uid() AND shop_users.active = true));
CREATE POLICY employees_manager_insert ON public.employees FOR INSERT TO authenticated
  WITH CHECK (shop_id IN (SELECT public.user_shop_ids_by_role(ARRAY['owner', 'manager'])));
CREATE POLICY employees_manager_update ON public.employees FOR UPDATE TO authenticated
  USING (shop_id IN (SELECT public.user_shop_ids_by_role(ARRAY['owner', 'manager'])))
  WITH CHECK (shop_id IN (SELECT public.user_shop_ids_by_role(ARRAY['owner', 'manager'])));
CREATE POLICY employees_manager_delete ON public.employees FOR DELETE TO authenticated
  USING (shop_id IN (SELECT public.user_shop_ids_by_role(ARRAY['owner', 'manager'])));

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employees FROM PUBLIC, anon;
