-- ============================================================
--  078 — shop members (shop_users): a signed-in account can add ITSELF only as the first owner
--        of a shop that has no members yet (the onboarding wizard)
--
--  The live policy shop_users_self_insert only checked user_id = auth.uid(), so any account
--  (signup is open, shop ids are public) could insert itself into the real shop with role
--  'owner' or 'manager' and then pass every owner/manager check (051/052 payment and site
--  settings, 070, 076, 077 POS staff PINs).
--    * self-insert: own row, role 'owner', into a shop with no shop_users rows at all
--      (inactive rows count too, so a shop whose members were switched off cannot be claimed)
--    * adding anyone to a shop that already has members: unchanged, shop_users_insert_owner
--      (active owner/manager); invitations go through accept_shop_invitation (SECURITY DEFINER)
--  shop_has_members is SECURITY DEFINER because a subquery on shop_users inside a shop_users
--  policy recurses forever (42P17, incident 2026-09-03).
-- ============================================================

-- 0) the policies must be exactly the ones checked on production 2026-11-26, or 078's own
DO $chk$
DECLARE
  v_fp text;
BEGIN
  SELECT md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname))
    INTO v_fp FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_users';
  IF v_fp IS DISTINCT FROM 'b1f9b0c00bde236d01df69df2b80189b'
     AND v_fp IS DISTINCT FROM 'a1b5afc6c62461df405e5262ce710df9' THEN
    RAISE EXCEPTION '078: shop_users policies are not the expected ones, nothing changed (fingerprint %)', v_fp;
  END IF;
END
$chk$;

CREATE OR REPLACE FUNCTION public.shop_has_members(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_users WHERE shop_id = p_shop_id)
$$;
REVOKE ALL ON FUNCTION public.shop_has_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_has_members(uuid) TO authenticated;

DROP POLICY IF EXISTS shop_users_self_insert ON public.shop_users;
DROP POLICY IF EXISTS shop_users_self_insert_first_owner ON public.shop_users;
CREATE POLICY shop_users_self_insert_first_owner ON public.shop_users FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'owner' AND shop_id IS NOT NULL
              AND NOT public.shop_has_members(shop_id));
