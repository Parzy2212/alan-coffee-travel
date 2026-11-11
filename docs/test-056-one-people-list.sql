-- ============================================================
--  Test for migration 056 (one people list + shop-wide settings keys)
--
--  CHANGES NOTHING. The whole file is ONE DO block that always ends in
--  an error ("056 TEST RESULTS ..."), so Postgres rolls everything back:
--  the new column, the links, the trigger, the functions and the test
--  rows. The error message IS the report: every line should start with
--  PASS or SKIP. No BEGIN/ROLLBACK needed (the SQL Editor does not keep
--  a BEGIN open).
--
--  It makes no sale and writes no order, so no order trigger fires.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor) as postgres:
--  paste the whole file, Run, copy the error text back.
--  The body is a generated copy of
--  supabase/migrations/056_one_people_list.sql -- keep in sync.
-- ============================================================

DO $test$
DECLARE
  c_shop constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  report text := '';
  r text;
  n int; n2 int; n3 int;
  b_staff int; b_emp int; b_emp_other int; b_orders int; b_att int;
  b_keys text[]; v_keys text[];
  v_owner uuid; v_emp uuid; v_emp2 uuid; v_staff uuid; v_unlinked uuid; v_other uuid;
BEGIN
  SELECT count(*) INTO b_staff FROM public.staff;
  SELECT count(*) INTO b_emp FROM public.employees WHERE shop_id = c_shop;
  SELECT count(*) INTO b_emp_other FROM public.employees WHERE shop_id <> c_shop;
  SELECT count(*) INTO b_orders FROM public.orders WHERE staff_id IS NOT NULL;
  SELECT count(*) INTO b_att FROM public.attendance;
  b_keys := public.site_settings_public_keys();

  -- ---- 056 body (generated copy) ----
  -- 1) staff.employee_id: one HR row per POS employee
  ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS employee_id uuid;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_employee_id_fkey' AND conrelid = 'public.staff'::regclass
  ) THEN
    ALTER TABLE public.staff
      ADD CONSTRAINT staff_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS staff_employee_id_key ON public.staff (employee_id);
  -- 049: a new staff column is unreadable until granted
  GRANT SELECT (employee_id) ON public.staff TO anon, authenticated;

  -- 2) link the existing people (owner decisions 2026-11-11)
  --    (the sync trigger is dropped first so a re-run cannot create a second HR row)
  DROP TRIGGER IF EXISTS employees_sync_staff ON public.employees;
  DECLARE
    c_shop  constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
    v_owner uuid;
    v_owner_name text;
    v_pasy  uuid;
    v_eaom  uuid;
    v_hash  text;
    v_linked uuid;
    v_new   uuid;
    n       int;
  BEGIN
    SELECT count(*) INTO n FROM public.employees WHERE shop_id = c_shop AND name = 'Owner';
    IF n <> 1 THEN RAISE EXCEPTION '056: expected 1 employee named Owner in the real shop, found %', n; END IF;
    SELECT id, name INTO v_owner, v_owner_name FROM public.employees WHERE shop_id = c_shop AND name = 'Owner';

    -- pasy (HR) is the same person as Owner (POS)
    SELECT count(*) INTO n FROM public.staff WHERE name = 'pasy' OR employee_id = v_owner;
    IF n <> 1 THEN RAISE EXCEPTION '056: expected 1 staff row for pasy/Owner, found %', n; END IF;
    SELECT id INTO v_pasy FROM public.staff WHERE name = 'pasy' OR employee_id = v_owner;
    UPDATE public.staff SET employee_id = v_owner, name = v_owner_name WHERE id = v_pasy;

    -- EAOM (test person): moved into employees, switched off, history kept
    SELECT count(*) INTO n FROM public.staff WHERE name = 'EAOM';
    IF n <> 1 THEN RAISE EXCEPTION '056: expected 1 staff row named EAOM, found %', n; END IF;
    SELECT id, pin_hash, employee_id INTO v_eaom, v_hash, v_linked FROM public.staff WHERE name = 'EAOM';
    IF v_linked IS NULL THEN
      IF v_hash IS NULL THEN RAISE EXCEPTION '056: EAOM has no PIN hash to carry over'; END IF;
      INSERT INTO public.employees (shop_id, name, pin_hash, role, is_active, notes)
      VALUES (c_shop, 'EAOM', v_hash, 'cashier', false, 'ย้ายจากรายชื่อ HR เดิม (คนทดสอบ ปิดใช้งาน)')
      RETURNING id INTO v_new;
      UPDATE public.staff SET employee_id = v_new, is_active = false WHERE id = v_eaom;
    END IF;
    -- "POS Terminal" stays as it is (unlinked, inactive): the old bills point at it
  END;

  -- 3) from now on employees is the one list: a new employee gets its HR row,
  --    name and on/off follow the employee. Real shop only (HR screens have no shop filter).
  CREATE OR REPLACE FUNCTION public.employees_sync_staff()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $f$
  BEGIN
    IF NEW.shop_id <> '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.staff (name, role, is_active, shop_id, employee_id)
      VALUES (NEW.name, NEW.role, NEW.is_active, NEW.shop_id, NEW.id);
    ELSE
      UPDATE public.staff
      SET name = NEW.name, is_active = NEW.is_active
      WHERE employee_id = NEW.id
        AND (name IS DISTINCT FROM NEW.name OR is_active IS DISTINCT FROM NEW.is_active);
    END IF;
    RETURN NEW;
  END;
  $f$;
  REVOKE EXECUTE ON FUNCTION public.employees_sync_staff() FROM PUBLIC, anon, authenticated;
  CREATE TRIGGER employees_sync_staff
    AFTER INSERT OR UPDATE OF name, is_active ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.employees_sync_staff();

  -- 4) one PIN: clock-in checks the linked employee's PIN (047 body, source of the hash changed)
  CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_staff_id uuid, p_pin text)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public, extensions, pg_temp
  AS $f$
  DECLARE
    v_scope text := 'staff:' || p_staff_id::text;
    v_wait int;
    v_ok boolean;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM staff WHERE id = p_staff_id) THEN
      RETURN false;
    END IF;
    IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
      RETURN false;
    END IF;

    v_wait := pin_attempt_wait(v_scope);
    IF v_wait > 0 THEN
      RAISE EXCEPTION 'PIN_LOCKED'
        USING DETAIL = v_wait::text,
              HINT = 'retry after ' || v_wait || ' seconds';
    END IF;

    SELECT e.pin_hash = crypt(p_pin, e.pin_hash)
           AND e.is_active IS TRUE
           AND s.is_active IS TRUE
    INTO v_ok
    FROM staff s
    JOIN employees e ON e.id = s.employee_id
                    AND e.shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30'::uuid
    WHERE s.id = p_staff_id;
    v_ok := COALESCE(v_ok, false);

    PERFORM pin_attempt_record(v_scope, v_ok, 5, 60, 1800);
    RETURN v_ok;
  END;
  $f$;

  -- 5) shop-wide receipt layout + exchange rates: add the keys to the live whitelist
  --    (built from the live list, so keys added outside the repo are kept; STABLE, not
  --    IMMUTABLE, so open connections cannot keep an old copy of the list)
  DECLARE
    v_keys text[];
  BEGIN
    SELECT array_agg(DISTINCT k ORDER BY k) INTO v_keys
    FROM unnest(public.site_settings_public_keys() || ARRAY[
      'receipt_show_logo', 'receipt_show_receipt_num', 'receipt_show_staff',
      'receipt_show_queue_large', 'receipt_show_item_price',
      'receipt_extra_line_1', 'receipt_extra_line_2', 'receipt_blank_lines',
      'exchange_rates', 'display_currencies'
    ]) AS k;
    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.site_settings_public_keys() RETURNS text[] LANGUAGE sql STABLE AS %L',
      format('SELECT %L::text[]', v_keys::text));
  END;

  -- ---- tests ----
  PERFORM set_config('search_path', 'public, extensions, pg_temp', true);

  SELECT id INTO v_owner FROM public.employees WHERE shop_id = c_shop AND name = 'Owner';

  SELECT CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END INTO r FROM public.staff
    WHERE employee_id = v_owner AND name = 'Owner';
  report := report || r || ' T1 pasy is linked to Owner and shows the same name' || E'\n';

  SELECT CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END INTO r
  FROM public.staff s JOIN public.employees e ON e.id = s.employee_id
  WHERE e.name = 'EAOM' AND e.shop_id = c_shop AND e.is_active IS FALSE
    AND s.is_active IS FALSE AND e.pin_hash = s.pin_hash;
  report := report || r || ' T2 EAOM is in employees, switched off, linked to its HR row' || E'\n';

  SELECT count(*) INTO n FROM public.orders WHERE staff_id IS NOT NULL;
  SELECT count(*) INTO n2 FROM public.attendance;
  report := report || CASE WHEN n = b_orders AND n2 = b_att THEN 'PASS' ELSE 'FAIL' END
    || format(' T3 old data untouched (orders with staff %s -> %s, attendance %s -> %s)', b_orders, n, b_att, n2) || E'\n';

  SELECT count(*) INTO n FROM public.staff;
  SELECT count(*) INTO n2 FROM public.employees WHERE shop_id = c_shop;
  SELECT count(*) INTO n3 FROM public.employees WHERE shop_id <> c_shop;
  report := report || CASE WHEN n = b_staff AND n2 = b_emp + 1 AND n3 = b_emp_other THEN 'PASS' ELSE 'FAIL' END
    || format(' T4 counts: staff %s -> %s (same), real-shop employees %s -> %s (+1 EAOM), other shops %s -> %s (same)',
              b_staff, n, b_emp, n2, b_emp_other, n3) || E'\n';

  INSERT INTO public.employees (shop_id, name, pin_hash, role)
  VALUES (c_shop, 'T056 temp', crypt('4821', gen_salt('bf', 4)), 'cashier') RETURNING id INTO v_emp;
  SELECT id INTO v_staff FROM public.staff WHERE employee_id = v_emp AND name = 'T056 temp' AND is_active IS TRUE;
  report := report || CASE WHEN v_staff IS NOT NULL THEN 'PASS' ELSE 'FAIL' END
    || ' T5 a new employee gets an HR row automatically' || E'\n';

  report := report || CASE WHEN public.verify_staff_pin(v_staff, '0000') IS FALSE THEN 'PASS' ELSE 'FAIL' END
    || ' T6 clock-in PIN: wrong PIN refused' || E'\n';
  report := report || CASE WHEN public.verify_staff_pin(v_staff, '4821') IS TRUE THEN 'PASS' ELSE 'FAIL' END
    || ' T7 clock-in PIN: the POS PIN is accepted' || E'\n';

  UPDATE public.employees SET name = 'T056 renamed', is_active = false WHERE id = v_emp;
  SELECT CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END INTO r FROM public.staff
    WHERE id = v_staff AND name = 'T056 renamed' AND is_active IS FALSE;
  report := report || r || ' T8 rename / switch off in employees follows into HR' || E'\n';
  report := report || CASE WHEN public.verify_staff_pin(v_staff, '4821') IS FALSE THEN 'PASS' ELSE 'FAIL' END
    || ' T9 a switched-off employee cannot clock in' || E'\n';

  SELECT id INTO v_unlinked FROM public.staff WHERE employee_id IS NULL LIMIT 1;
  IF v_unlinked IS NULL THEN
    report := report || 'SKIP T10 no unlinked HR row (POS Terminal) to test' || E'\n';
  ELSE
    report := report || CASE WHEN public.verify_staff_pin(v_unlinked, '1234') IS FALSE THEN 'PASS' ELSE 'FAIL' END
      || ' T10 an HR row without an employee (POS Terminal) cannot clock in' || E'\n';
  END IF;

  BEGIN
    DELETE FROM public.employees WHERE id = v_emp;
    report := report || 'FAIL T11 a linked employee could be deleted' || E'\n';
  EXCEPTION WHEN foreign_key_violation THEN
    report := report || 'PASS T11 a linked employee cannot be deleted (history kept; the app switches it off instead)' || E'\n';
  END;

  SELECT id INTO v_other FROM public.shops WHERE id <> c_shop LIMIT 1;
  IF v_other IS NULL THEN
    report := report || 'SKIP T12 no other shop to test' || E'\n';
  ELSE
    INSERT INTO public.employees (shop_id, name, pin_hash, role)
    VALUES (v_other, 'T056 other shop', crypt('7313', gen_salt('bf', 4)), 'cashier') RETURNING id INTO v_emp2;
    SELECT CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END INTO r FROM public.staff WHERE employee_id = v_emp2;
    report := report || r || ' T12 an employee of another (test) shop does not appear in HR' || E'\n';
  END IF;

  v_keys := public.site_settings_public_keys();
  report := report || CASE WHEN b_keys <@ v_keys AND ARRAY[
      'receipt_show_logo', 'receipt_show_receipt_num', 'receipt_show_staff', 'receipt_show_queue_large',
      'receipt_show_item_price', 'receipt_extra_line_1', 'receipt_extra_line_2', 'receipt_blank_lines',
      'exchange_rates', 'display_currencies'] <@ v_keys THEN 'PASS' ELSE 'FAIL' END
    || format(' T13 settings whitelist: %s old keys kept, now %s', cardinality(b_keys), cardinality(v_keys)) || E'\n';

  INSERT INTO public.site_settings (key, value, updated_at) VALUES ('exchange_rates', '{"THB":620}', now())
    ON CONFLICT (key) DO NOTHING;
  report := report || CASE WHEN public.get_site_settings() ? 'exchange_rates' THEN 'PASS' ELSE 'FAIL' END
    || ' T14 the POS can read the shop-wide exchange rates' || E'\n';

  report := report || CASE WHEN has_column_privilege('anon', 'public.staff', 'employee_id', 'SELECT')
      AND NOT has_column_privilege('anon', 'public.staff', 'pin_hash', 'SELECT')
      AND NOT has_function_privilege('anon', 'public.employees_sync_staff()', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.employees_sync_staff()', 'EXECUTE')
      AND has_function_privilege('anon', 'public.verify_staff_pin(uuid, text)', 'EXECUTE')
    THEN 'PASS' ELSE 'FAIL' END
    || ' T15 permissions: link readable, PIN hash still hidden, clock-in check still callable' || E'\n';

  RAISE EXCEPTION E'056 TEST RESULTS (everything rolled back, nothing changed):\n%', report;
END
$test$;
