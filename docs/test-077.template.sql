-- ============================================================
--  Test for migration 077 (POS staff list: only owner/manager can add, edit or remove; no public read)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("077 TEST RESULTS ..."), so everything rolls back, including the test people and sign-ins.
--  Every line should start with PASS. Run as postgres, copy the error text back.
--  Section "body of 077" is a copy of supabase/migrations/077_employees_write_owner_manager_only.sql
--  (this file is built from docs/test-077.template.sql by scripts/build-migration-test.sh).
-- ============================================================
DO $test$
DECLARE
  c_shop    constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_owner   uuid;
  c_cashier uuid := gen_random_uuid();
  c_viewer  uuid := gen_random_uuid();
  c_manager uuid := gen_random_uuid();
  report    text := '';
  v_body    text;
  v_emp     uuid;
  v_new     uuid;
  v_hash    text;
  v_n       int;
BEGIN
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active ORDER BY id LIMIT 1;
  IF c_owner IS NULL THEN RAISE EXCEPTION '077 TEST: the shop has no active owner'; END IF;
  SELECT id, pin_hash INTO v_emp, v_hash FROM public.employees WHERE shop_id = c_shop ORDER BY id LIMIT 1;
  IF v_emp IS NULL THEN RAISE EXCEPTION '077 TEST: the shop has no employee'; END IF;

  -- ---- body of 077 ----
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
    ('00000000-0000-0000-0000-000000000000', c_viewer, 'authenticated', 'authenticated', now(), now()),
    ('00000000-0000-0000-0000-000000000000', c_manager, 'authenticated', 'authenticated', now(), now());
  INSERT INTO public.shop_users (shop_id, user_id, email, role, active) VALUES
    (c_shop, c_cashier, '__077cashier@test.invalid', 'cashier', true),
    (c_shop, c_viewer, '__077viewer@test.invalid', 'viewer', true),
    (c_shop, c_manager, '__077manager@test.invalid', 'manager', true);

  -- T1 privileges: anon nothing at all (no column either); signed-in can still read and write (policies decide)
  report := report || CASE WHEN NOT has_table_privilege('anon', 'public.employees', 'INSERT')
      AND NOT has_table_privilege('anon', 'public.employees', 'UPDATE')
      AND NOT has_table_privilege('anon', 'public.employees', 'DELETE')
      AND NOT has_table_privilege('anon', 'public.employees', 'TRUNCATE')
      AND NOT has_table_privilege('anon', 'public.employees', 'SELECT')
      AND NOT has_column_privilege('anon', 'public.employees', 'name', 'SELECT')
      AND NOT has_column_privilege('anon', 'public.employees', 'pin_hash', 'SELECT')
      AND has_column_privilege('authenticated', 'public.employees', 'name', 'SELECT')
      AND has_column_privilege('authenticated', 'public.employees', 'pin_hash', 'UPDATE')
      AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND 'anon' = ANY (roles))
      AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'employees_shop_member')
    THEN E'\nPASS T1 anon: no read, no write, no policy; old ALL policy gone'
    ELSE E'\nFAIL T1 privileges' END;

  -- T2 the public key cannot read the list, change a PIN or add a person
  v_n := 0;
  BEGIN SET LOCAL ROLE anon; PERFORM count(id) FROM public.employees; EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE anon; UPDATE public.employees SET pin_hash = 'x' WHERE id = v_emp; EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  BEGIN SET LOCAL ROLE anon; INSERT INTO public.employees (shop_id, name, pin_hash, role) VALUES (c_shop, '__077', 'x', 'cashier'); EXCEPTION WHEN insufficient_privilege THEN v_n := v_n + 1; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 3 AND (SELECT pin_hash FROM public.employees WHERE id = v_emp) = v_hash
    THEN E'\nPASS T2 public key: read, PIN change and add all refused' ELSE E'\nFAIL T2 only ' || v_n || ' of 3 refused' END;

  -- T3 a cashier account: still sees the list, but cannot change a PIN, add or remove anyone
  PERFORM pg_temp.t_as(c_cashier);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.employees WHERE shop_id = c_shop;
  WITH u AS (UPDATE public.employees SET pin_hash = '__077 cashier', role = 'manager' WHERE id = v_emp RETURNING id) SELECT v_n * 100 + count(*) INTO v_n FROM u;
  WITH d AS (DELETE FROM public.employees WHERE id = v_emp RETURNING id) SELECT v_n * 10 + count(*) INTO v_n FROM d;
  RESET ROLE;
  report := report || CASE WHEN v_n >= 1000 AND v_n % 1000 = 0 AND (SELECT pin_hash FROM public.employees WHERE id = v_emp) = v_hash
    THEN E'\nPASS T3a cashier: sees the list, PIN/role change and delete change nothing' ELSE E'\nFAIL T3a cashier ' || v_n END;
  v_n := 0;
  BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.employees (shop_id, name, pin_hash, role) VALUES (c_shop, '__077 c', '__077 c', 'manager'); EXCEPTION WHEN insufficient_privilege THEN v_n := 1; END;
  RESET ROLE;
  report := report || CASE WHEN v_n = 1 THEN E'\nPASS T3b cashier cannot add a person' ELSE E'\nFAIL T3b cashier added a person' END;

  -- T4 a viewer account: same as cashier
  PERFORM pg_temp.t_as(c_viewer);
  SET LOCAL ROLE authenticated;
  WITH u AS (UPDATE public.employees SET pin_hash = '__077 viewer' WHERE id = v_emp RETURNING id) SELECT count(*) INTO v_n FROM u;
  RESET ROLE;
  report := report || CASE WHEN v_n = 0 THEN E'\nPASS T4 viewer cannot change a PIN' ELSE E'\nFAIL T4 viewer changed a PIN' END;

  -- T5 the owner: changes a PIN and adds a person (the app switches people off, never deletes:
  -- staff.employee_id points at them)
  PERFORM pg_temp.t_as(c_owner);
  SET LOCAL ROLE authenticated;
  WITH u AS (UPDATE public.employees SET pin_hash = '__077 owner' WHERE id = v_emp RETURNING id) SELECT count(*) INTO v_n FROM u;
  INSERT INTO public.employees (shop_id, name, pin_hash, role) VALUES (c_shop, '__077 new', '__077 new', 'cashier') RETURNING id INTO v_new;
  RESET ROLE;
  report := report || CASE WHEN v_n = 1 AND v_new IS NOT NULL AND (SELECT pin_hash FROM public.employees WHERE id = v_emp) = '__077 owner'
    THEN E'\nPASS T5 owner: changes a PIN and adds a person' ELSE E'\nFAIL T5 owner ' || v_n END;

  -- T6 a manager account can change a PIN too
  PERFORM pg_temp.t_as(c_manager);
  SET LOCAL ROLE authenticated;
  WITH u AS (UPDATE public.employees SET pin_hash = '__077 manager' WHERE id = v_emp RETURNING id) SELECT count(*) INTO v_n FROM u;
  RESET ROLE;
  report := report || CASE WHEN v_n = 1 THEN E'\nPASS T6 manager account changes a PIN' ELSE E'\nFAIL T6 manager ' || v_n END;

  -- T7 an inactive manager and a stranger: see nothing, change nothing
  UPDATE public.shop_users SET active = false WHERE user_id = c_manager;
  PERFORM pg_temp.t_as(c_manager);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.employees;
  WITH u AS (UPDATE public.employees SET pin_hash = '__077 inactive' WHERE id = v_emp RETURNING id) SELECT v_n + count(*) INTO v_n FROM u;
  RESET ROLE;
  PERFORM pg_temp.t_as(gen_random_uuid());
  SET LOCAL ROLE authenticated;
  WITH u AS (UPDATE public.employees SET pin_hash = '__077 stranger' WHERE id = v_emp RETURNING id) SELECT v_n + count(*) INTO v_n FROM u;
  RESET ROLE;
  report := report || CASE WHEN v_n = 0 THEN E'\nPASS T7 inactive manager / stranger: see nothing, change nothing' ELSE E'\nFAIL T7 ' || v_n END;

  -- T8 running the migration again: no error, same policies
  PERFORM pg_temp.t_as(NULL);
  BEGIN
    EXECUTE v_body;
    report := report || CASE WHEN (SELECT count(*) FROM pg_policies WHERE tablename = 'employees') = 4
      THEN E'\nPASS T8 second run changes nothing' ELSE E'\nFAIL T8 second run changed the policies' END;
  EXCEPTION WHEN OTHERS THEN report := report || E'\nFAIL T8 second run: ' || SQLERRM;
  END;

  -- T9 the gate: an unexpected policy stops the migration before any change
  CREATE POLICY __077_extra ON public.employees FOR SELECT TO anon USING (true);
  v_n := 0;
  BEGIN EXECUTE v_body; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '077: employees policies are not the expected ones%' THEN v_n := 1; END IF; END;
  report := report || CASE WHEN v_n = 1 AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = '__077_extra')
    THEN E'\nPASS T9 an unexpected policy stops the migration, nothing changed' ELSE E'\nFAIL T9 gate did not refuse' END;

  RAISE EXCEPTION '077 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
