-- ============================================================
--  Test for migration 076 (held bills: shop accounts only, not the public key)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("076 TEST RESULTS ..."), so everything rolls back, including the test bills and sign-ins.
--  Every line should start with PASS. Run as postgres, copy the error text back.
--  Section "body of 076" is a copy of supabase/migrations/076_held_orders_shop_members_only.sql
--  (this file is built from docs/test-076.template.sql by scripts/build-migration-test.sh).
-- ============================================================
DO $test$
DECLARE
  c_shop    constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_owner   uuid;
  c_cashier uuid := gen_random_uuid();
  c_viewer  uuid := gen_random_uuid();
  report    text := '';
  v_body    text;
  v_held    uuid;
  v_n       int;
BEGIN
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active ORDER BY id LIMIT 1;
  IF c_owner IS NULL THEN RAISE EXCEPTION '076 TEST: the shop has no active owner'; END IF;

  -- ---- body of 076 ----
  v_body := $body$
__BODY__
$body$;
  EXECUTE v_body;

  CREATE FUNCTION pg_temp.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $f$
    SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
           set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $f$;
  -- throw-away sign-ins (no email, no password, nobody can log in with them), rolled back with the rest
  INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at) VALUES
    ('00000000-0000-0000-0000-000000000000', c_cashier, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-0000-0000-000000000000', c_viewer, 'authenticated', 'authenticated', now(), now());
  INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES
    (c_shop, c_cashier, '__076cashier@test.invalid', 'cashier', true),
    (c_shop, c_viewer, '__076viewer@test.invalid', 'viewer', true);
  -- a bill parked before the change, as the database owner
  INSERT INTO public.held_orders (table_number, cart_items, total_lak) VALUES ('__076 T1', '[]', 10000) RETURNING id INTO v_held;

  -- T1 privileges: anon nothing; signed-in read / add / delete only
  report := report || CASE WHEN NOT has_table_privilege('anon', 'public.held_orders', 'SELECT')
      AND NOT has_table_privilege('anon', 'public.held_orders', 'INSERT')
      AND NOT has_table_privilege('anon', 'public.held_orders', 'DELETE')
      AND NOT has_table_privilege('anon', 'public.held_orders', 'UPDATE')
      AND NOT has_table_privilege('anon', 'public.held_orders', 'TRUNCATE')
      AND has_table_privilege('authenticated', 'public.held_orders', 'SELECT')
      AND has_table_privilege('authenticated', 'public.held_orders', 'INSERT')
      AND has_table_privilege('authenticated', 'public.held_orders', 'DELETE')
      AND NOT has_table_privilege('authenticated', 'public.held_orders', 'UPDATE')
      AND NOT has_table_privilege('authenticated', 'public.held_orders', 'TRUNCATE')
      AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'held_orders' AND 'anon' = ANY (roles))
    THEN E'\nPASS T1 anon: no access, no policy; signed-in: select / insert / delete only'
    ELSE E'\nFAIL T1 privileges' END;

  -- T2 the public key cannot read, park or delete
  v_n := 0;
  BEGIN SET LOCAL ROLE anon; PERFORM 1 FROM public.held_orders; EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE anon; INSERT INTO public.held_orders (cart_items) VALUES ('[]'); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE anon; DELETE FROM public.held_orders; EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 3 AND EXISTS (SELECT 1 FROM public.held_orders WHERE id = v_held)
    THEN E'\nPASS T2 public key: read / park / delete all refused, the parked bill is still there'
    ELSE E'\nFAIL T2 only ' || v_n || ' of 3 refused' END;

  -- T3 a signed-in account that is not in the shop: sees nothing, cannot park, deletes nothing
  PERFORM pg_temp.t_as(gen_random_uuid());
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.held_orders;
  DELETE FROM public.held_orders WHERE id = v_held;
  RESET ROLE;
  report := report || CASE WHEN v_n = 0 AND EXISTS (SELECT 1 FROM public.held_orders WHERE id = v_held)
    THEN E'\nPASS T3a stranger: sees 0 bills, delete removes nothing' ELSE E'\nFAIL T3a stranger saw ' || v_n END;
  v_n := 0;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.held_orders (cart_items) VALUES ('[]'); EXCEPTION WHEN insufficient_privilege THEN v_n := 1; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 1 THEN E'\nPASS T3b stranger cannot park a bill' ELSE E'\nFAIL T3b stranger parked a bill' END;

  -- T4 the owner: sees the bill, parks one, takes it back (delete returns the row)
  PERFORM pg_temp.t_as(c_owner);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.held_orders WHERE id = v_held;
  INSERT INTO public.held_orders (table_number, cart_items, total_lak) VALUES ('__076 owner', '[]', 5000);
  WITH d AS (DELETE FROM public.held_orders WHERE table_number = '__076 owner' RETURNING id) SELECT v_n + 10 * count(*) INTO v_n FROM d;
  RESET ROLE;
  report := report || CASE WHEN v_n = 11 THEN E'\nPASS T4 owner: sees the old bill, parks one and takes it back' ELSE E'\nFAIL T4 owner ' || v_n END;

  -- T5 a cashier can park and take back too
  PERFORM pg_temp.t_as(c_cashier);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.held_orders (table_number, cart_items, total_lak) VALUES ('__076 cashier', '[]', 5000);
  WITH d AS (DELETE FROM public.held_orders WHERE table_number = '__076 cashier' RETURNING id) SELECT count(*) INTO v_n FROM d;
  RESET ROLE;
  report := report || CASE WHEN v_n = 1 THEN E'\nPASS T5 cashier: parks and takes back' ELSE E'\nFAIL T5 cashier ' || v_n END;

  -- T6 a viewer can read but not park or delete
  PERFORM pg_temp.t_as(c_viewer);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.held_orders WHERE id = v_held;
  DELETE FROM public.held_orders WHERE id = v_held;
  RESET ROLE;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.held_orders (cart_items) VALUES ('[]'); v_n := v_n + 10; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 1 AND EXISTS (SELECT 1 FROM public.held_orders WHERE id = v_held)
    THEN E'\nPASS T6 viewer: sees the bill, cannot delete or park' ELSE E'\nFAIL T6 viewer ' || v_n END;

  -- T7 an inactive cashier is a stranger
  UPDATE public.shop_users SET active = false WHERE user_id = c_cashier;
  PERFORM pg_temp.t_as(c_cashier);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.held_orders;
  RESET ROLE;
  report := report || CASE WHEN v_n = 0 THEN E'\nPASS T7 inactive cashier sees nothing' ELSE E'\nFAIL T7 inactive cashier saw ' || v_n END;

  -- T8 running the migration again: no error, same policies
  PERFORM pg_temp.t_as(NULL);
  BEGIN
    EXECUTE v_body;
    report := report || CASE WHEN (SELECT count(*) FROM pg_policies WHERE tablename = 'held_orders') = 3
      THEN E'\nPASS T8 second run changes nothing' ELSE E'\nFAIL T8 second run changed the policies' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T8 second run: ' || SQLERRM;
  END;

  -- T9 the gate: an unexpected policy stops the migration before any change
  CREATE POLICY __076_extra ON public.held_orders FOR SELECT TO anon USING (true);
  v_n := 0;
  BEGIN EXECUTE v_body; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '076: held_orders policies are not the 031 ones%' THEN v_n := 1; END IF; END;
  report := report || CASE WHEN v_n = 1 AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'held_orders' AND policyname = '__076_extra')
    THEN E'\nPASS T9 an unexpected policy stops the migration, nothing changed' ELSE E'\nFAIL T9 gate did not refuse' END;

  RAISE EXCEPTION '076 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
