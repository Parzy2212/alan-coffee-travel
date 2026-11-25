-- ============================================================
--  076 — held (parked) bills: shop accounts only, not the public key
--
--  031 gave anon ALL on held_orders with a USING (true) policy, so anyone with the public key
--  could read held bills (table, customer name, cart), add junk ones or delete them.
--  The POS already needs a signed-in shop account on the device (shop id, checkout), so the
--  POS now reads/writes held bills with that session (authClient):
--    * read: any active member of the real shop (owner, manager, cashier, viewer)
--    * park / take back / delete: owner, manager, cashier
--  The client never updates a held bill (resume = delete), so no UPDATE grant.
--  held_orders has no shop_id: like 051/057 it is tied to the one real shop (real_shop_role_in).
--  Order on production: run 076, then push the POS that uses authClient for held bills
--  (until then the live POS, still on the public key, cannot park or list held bills).
-- ============================================================

-- 0) held_orders must still have exactly 031's open policy; a second run sees 076's and goes on
DO $chk$
DECLARE
  v_pol text;
BEGIN
  SELECT string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname)
    INTO v_pol FROM pg_policies WHERE schemaname = 'public' AND tablename = 'held_orders';
  IF v_pol IS DISTINCT FROM 'anon_held_orders_all|ALL|{anon}|true|true'
     AND v_pol IS DISTINCT FROM 'held_orders_member_delete|DELETE|{authenticated}|real_shop_role_in(ARRAY[''owner''::text, ''manager''::text, ''cashier''::text])|;'
                             || 'held_orders_member_insert|INSERT|{authenticated}||real_shop_role_in(ARRAY[''owner''::text, ''manager''::text, ''cashier''::text]);'
                             || 'held_orders_member_select|SELECT|{authenticated}|real_shop_role_in(ARRAY[''owner''::text, ''manager''::text, ''cashier''::text, ''viewer''::text])|' THEN
    RAISE EXCEPTION '076: held_orders policies are not the 031 ones, nothing changed: %', v_pol;
  END IF;
  IF to_regprocedure('public.real_shop_role_in(text[])') IS NULL THEN
    RAISE EXCEPTION '076: real_shop_role_in (057) not found, nothing changed';
  END IF;
END
$chk$;

DROP POLICY IF EXISTS anon_held_orders_all ON public.held_orders;
DROP POLICY IF EXISTS held_orders_member_select ON public.held_orders;
DROP POLICY IF EXISTS held_orders_member_insert ON public.held_orders;
DROP POLICY IF EXISTS held_orders_member_delete ON public.held_orders;

CREATE POLICY held_orders_member_select ON public.held_orders FOR SELECT TO authenticated
  USING (public.real_shop_role_in(ARRAY['owner', 'manager', 'cashier', 'viewer']));
CREATE POLICY held_orders_member_insert ON public.held_orders FOR INSERT TO authenticated
  WITH CHECK (public.real_shop_role_in(ARRAY['owner', 'manager', 'cashier']));
CREATE POLICY held_orders_member_delete ON public.held_orders FOR DELETE TO authenticated
  USING (public.real_shop_role_in(ARRAY['owner', 'manager', 'cashier']));

ALTER TABLE public.held_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.held_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.held_orders TO authenticated;
