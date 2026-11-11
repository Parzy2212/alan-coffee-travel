-- ============================================================
--  Alan Cafe OS -- Migration 056: one people list + shop-wide
--  receipt layout / exchange-rate settings
--
--  STATUS: DRAFT -- not run on production yet.
--  Run docs/test-056-one-people-list.sql first (changes nothing,
--  ends in an error that is the report). Then run this file.
--
--  Owner decisions (2026-11-11):
--  - employees (POS PIN list) is the one staff list.
--  - pasy (HR) = Owner (POS): one person.
--  - EAOM = a test person: moved into employees, switched off,
--    never deleted (history kept).
--  - "POS Terminal" (HR, inactive) stays: the old test bills
--    (orders.staff_id) and audit_logs point at it.
--  - receipt layout and exchange rates become shop settings.
--
--  What it does:
--  1) staff.employee_id (unique, FK to employees). The HR table
--     staff stays as the HR detail of an employee (salary,
--     schedule, attendance, leave, face photo). No HR row and no
--     history row is moved or deleted; all old foreign keys stay.
--  2) links pasy -> Owner (HR name becomes the employee name),
--     creates the employee EAOM (inactive, same PIN hash) and
--     switches its HR row off.
--  3) trigger employees_sync_staff: a new employee of the real
--     shop gets an HR row; name and on/off follow the employee.
--     Real shop only (9afdd9eb-...), like 051/052: the HR screens
--     have no shop filter and anyone can sign up a shop.
--  4) verify_staff_pin (clock-in at /staff) checks the linked
--     employee's PIN. Attempt limits unchanged (047).
--     EFFECT: pasy/Owner clocks in with the POS PIN from now on;
--     the old HR PIN stops working. staff.pin_hash / pin_code are
--     no longer read by anything; they are dropped in a later
--     migration, after the owner has checked the new list.
--  5) ONLY allows 10 new keys in site_settings_public_keys()
--     (no value is written; the app starts using them in the UI
--     commit that ships with this migration), built from
--     the live list: receipt_show_logo, receipt_show_receipt_num,
--     receipt_show_staff, receipt_show_queue_large,
--     receipt_show_item_price, receipt_extra_line_1,
--     receipt_extra_line_2, receipt_blank_lines, exchange_rates,
--     display_currencies. Writing them is owner-only (052).
--
--  UNTIL THE UI COMMIT IS LIVE, do not add staff, change a PIN,
--  rename or switch people on/off in /cafe -> staff tab: that
--  screen still writes the HR table only (the PIN it sets is no
--  longer read, names/on-off there do not reach employees).
--  Run this migration together with that push.
--
--  Known trade-off: /staff clock-in now tests the POS PIN, with
--  its own attempt counter (staff:<id>), next to shop:<id> (047)
--  and void:<shop> (053). Closed properly when POS stops calling
--  as anon.
--  Re-running 049 after this needs employee_id in its ok list.
--
--  Safe to run twice while the names Owner / EAOM are unchanged
--  (otherwise it stops with an error and changes nothing).
--  The whole change is one DO block: an error anywhere rolls all
--  of it back.
--
--  Rollback:
--    DROP TRIGGER employees_sync_staff ON public.employees;
--    DROP FUNCTION public.employees_sync_staff();
--    re-run verify_staff_pin from 047_pin_attempt_limits.sql;
--    UPDATE public.staff SET name = 'pasy' WHERE employee_id =
--      (SELECT id FROM public.employees WHERE name = 'Owner'
--       AND shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30');
--    UPDATE public.staff SET is_active = true WHERE name = 'EAOM';
--    ALTER TABLE public.staff DROP COLUMN employee_id;
--    DELETE FROM public.employees WHERE name = 'EAOM' AND
--      shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30';
--    (the 10 extra whitelist keys are harmless if left)
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor).
-- ============================================================

DO $mig$
BEGIN
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
END
$mig$;

NOTIFY pgrst, 'reload schema';

-- Post-run check (read-only). Expected: Owner and EAOM each linked to 1 HR row,
-- EAOM off, POS Terminal unlinked, trigger enabled (O), 10 new keys = true.
SELECT 'employee' AS what, e.name AS item,
       format('active %s | HR row %s | HR active %s | HR Thai name %s', e.is_active, s.name, s.is_active, coalesce(s.name_th, '-')) AS detail
FROM public.employees e
LEFT JOIN public.staff s ON s.employee_id = e.id
WHERE e.shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30'
UNION ALL
SELECT 'HR row without employee', s.name, format('active %s', s.is_active)
FROM public.staff s WHERE s.employee_id IS NULL
UNION ALL
SELECT 'trigger', tgname, tgenabled::text FROM pg_trigger
WHERE tgrelid = 'public.employees'::regclass AND tgname = 'employees_sync_staff'
UNION ALL
SELECT 'whitelist', 'new keys present',
       (ARRAY['receipt_show_logo', 'receipt_show_receipt_num', 'receipt_show_staff', 'receipt_show_queue_large',
              'receipt_show_item_price', 'receipt_extra_line_1', 'receipt_extra_line_2', 'receipt_blank_lines',
              'exchange_rates', 'display_currencies'] <@ public.site_settings_public_keys())::text
ORDER BY 1, 2;
