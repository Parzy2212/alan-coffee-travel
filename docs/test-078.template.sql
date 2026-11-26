-- ============================================================
--  Test for migration 078 (shop_users: an account adds itself only as first owner of an empty shop)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("078 TEST RESULTS ..."), so everything rolls back, including the test people, shops and sign-ins.
--  Every line should start with PASS. Run as postgres, copy the error text back.
--  Section "body of 078" is a copy of supabase/migrations/078_shop_users_self_insert_first_owner_only.sql
--  (this file is built from docs/test-078.template.sql by scripts/build-migration-test.sh).
-- ============================================================
DO $test$
DECLARE
  c_shop     constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_fresh    uuid := gen_random_uuid();
  c_fresh2   uuid := gen_random_uuid();
  c_staff    uuid := gen_random_uuid();
  report     text := '';
  v_body     text;
  v_members  int;
  v_new_shop uuid;
  v_empty    uuid;
  v_role     text;
  v_n        int;
BEGIN
  SELECT count(*) INTO v_members FROM public.shop_users WHERE shop_id = c_shop;
  IF v_members = 0 THEN RAISE EXCEPTION '078 TEST: the real shop has no members'; END IF;

  -- ---- body of 078 ----
  v_body := $body$
__BODY__
$body$;
  EXECUTE v_body;

  CREATE FUNCTION pg_temp.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $f$
    SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
           set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $f$;
  -- throw-away sign-ins (no email, no password, nobody can log in with them), rolled back with the rest
  INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at) VALUES
    ('00000000-0000-0000-0000-000000000000', c_fresh, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-0000-0000-000000000000', c_fresh2, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-0000-0000-000000000000', c_staff, 'authenticated', 'authenticated', now(), now());

  -- T1 old policy gone, helper locked down
  report := report || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shop_users' AND policyname = 'shop_users_self_insert')
      AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shop_users' AND policyname = 'shop_users_self_insert_first_owner')
      AND NOT has_function_privilege('anon', 'public.shop_has_members(uuid)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.shop_has_members(uuid)', 'EXECUTE')
      AND (SELECT prosecdef AND 'search_path=public, pg_temp' = ANY (proconfig) FROM pg_proc WHERE oid = 'public.shop_has_members(uuid)'::regprocedure)
    THEN E'\nPASS T1 old self-insert policy gone; helper SECURITY DEFINER, pg_temp last, not for anon'
    ELSE E'\nFAIL T1 policies / helper privileges' END;

  -- T2 a fresh account cannot add itself to the real shop as owner, manager or cashier
  PERFORM pg_temp.t_as(c_fresh);
  v_n := 0;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (c_shop, c_fresh, '__078a@test.invalid', 'owner', true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (c_shop, c_fresh, '__078b@test.invalid', 'manager', true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (c_shop, c_fresh, '__078c@test.invalid', 'cashier', true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 3 AND (SELECT count(*) FROM public.shop_users WHERE shop_id = c_shop) = v_members
    THEN E'\nPASS T2 fresh account into the real shop: owner, manager, cashier all refused' ELSE E'\nFAIL T2 only ' || v_n || ' of 3 refused' END;

  -- T3 a fresh account creates its own shop; it cannot join it as cashier (the first member must be the owner),
  --    for another account, or with no shop
  SET LOCAL ROLE authenticated;
  INSERT INTO public.shops (slug, name, owner_email, plan, status) VALUES ('__078-' || c_fresh, '__078 shop', '__078@test.invalid', 'free', 'active') RETURNING id INTO v_new_shop;
  RESET ROLE;
  v_n := 0;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (v_new_shop, c_fresh, '__078@test.invalid', 'cashier', true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (v_new_shop, c_fresh2, '__078x@test.invalid', 'owner', true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (NULL, c_fresh, '__078n@test.invalid', 'owner', true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 3 AND NOT EXISTS (SELECT 1 FROM public.shop_users WHERE shop_id = v_new_shop OR email = '__078n@test.invalid')
    THEN E'\nPASS T3 own new shop: cashier, someone else''s user id, no shop all refused' ELSE E'\nFAIL T3 only ' || v_n || ' of 3 refused' END;

  -- T4 the onboarding wizard: upsert itself as owner of its new empty shop (same statement shape as app/onboarding)
  SET LOCAL ROLE authenticated;
  INSERT INTO public.shop_users (shop_id, user_id, email, role, accepted_at, active) VALUES (v_new_shop, c_fresh, '__078@test.invalid', 'owner', now(), true)
    ON CONFLICT (shop_id, email) DO UPDATE SET user_id = EXCLUDED.user_id, role = EXCLUDED.role, accepted_at = EXCLUDED.accepted_at, active = EXCLUDED.active;
  RESET ROLE;
  report := report || CASE WHEN (SELECT count(*) FROM public.shop_users WHERE shop_id = v_new_shop AND user_id = c_fresh AND role = 'owner') = 1
    THEN E'\nPASS T4 onboarding: first owner of its own new shop' ELSE E'\nFAIL T4 onboarding insert' END;

  -- T5 the wizard run again (refresh mid-wizard): same upsert works, still one owner row
  v_n := 0;
  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.shop_users (shop_id, user_id, email, role, accepted_at, active) VALUES (v_new_shop, c_fresh, '__078@test.invalid', 'owner', now(), true)
      ON CONFLICT (shop_id, email) DO UPDATE SET user_id = EXCLUDED.user_id, role = EXCLUDED.role, accepted_at = EXCLUDED.accepted_at, active = EXCLUDED.active;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN RESET ROLE; v_n := 1; report := report || E'\nFAIL T5 re-run: ' || SQLERRM;
  END;
  IF v_n = 0 THEN
    report := report || CASE WHEN (SELECT count(*) FROM public.shop_users WHERE shop_id = v_new_shop) = 1
      THEN E'\nPASS T5 onboarding again: upsert still works, one row' ELSE E'\nFAIL T5 rows changed' END;
  END IF;

  -- T6 another fresh account cannot add itself to that shop now (as owner or cashier)
  PERFORM pg_temp.t_as(c_fresh2);
  v_n := 0;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (v_new_shop, c_fresh2, '__078y@test.invalid', 'owner', true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (v_new_shop, c_fresh2, '__078z@test.invalid', 'cashier', true); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 2 THEN E'\nPASS T6 second account into a shop that has a member: refused' ELSE E'\nFAIL T6 only ' || v_n || ' of 2 refused' END;

  -- T7 a shop whose only member is switched off still counts as taken
  PERFORM pg_temp.t_as(NULL);
  INSERT INTO public.shops (slug, name, plan, status) VALUES ('__078e-' || c_fresh, '__078 off', 'free', 'active') RETURNING id INTO v_empty;
  INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (v_empty, c_staff, '__078off@test.invalid', 'owner', false);
  PERFORM pg_temp.t_as(c_fresh2);
  v_n := 0;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (v_empty, c_fresh2, '__078w@test.invalid', 'owner', true); EXCEPTION WHEN insufficient_privilege THEN v_n := 1; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 1 THEN E'\nPASS T7 shop with only an inactive member cannot be claimed' ELSE E'\nFAIL T7 claimed a shop with an inactive member' END;

  -- T8 the owner still adds staff to its shop (shop_users_insert_owner)
  PERFORM pg_temp.t_as(c_fresh);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES (v_new_shop, c_staff, '__078staff@test.invalid', 'cashier', true);
  RESET ROLE;
  SELECT role INTO v_role FROM public.shop_users WHERE shop_id = v_new_shop AND user_id = c_staff;
  report := report || CASE WHEN v_role = 'cashier' THEN E'\nPASS T8 owner adds a cashier to its shop' ELSE E'\nFAIL T8 owner could not add staff' END;

  -- T9 running the migration again: no error, same policies
  PERFORM pg_temp.t_as(NULL);
  BEGIN
    EXECUTE v_body;
    report := report || CASE WHEN (SELECT count(*) FROM pg_policies WHERE tablename = 'shop_users') = 7
      THEN E'\nPASS T9 second run changes nothing' ELSE E'\nFAIL T9 second run changed the policies' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T9 second run: ' || SQLERRM;
  END;

  -- T10 the gate: an unexpected policy stops the migration before any change
  CREATE POLICY __078_extra ON public.shop_users FOR SELECT TO anon USING (true);
  v_n := 0;
  BEGIN EXECUTE v_body; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '078: shop_users policies are not the expected ones%' THEN v_n := 1; END IF; END;
  report := report || CASE WHEN v_n = 1 AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shop_users' AND policyname = '__078_extra')
    THEN E'\nPASS T10 an unexpected policy stops the migration, nothing changed' ELSE E'\nFAIL T10 gate did not refuse' END;

  RAISE EXCEPTION '078 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
