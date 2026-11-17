-- ============================================================
--  Check: who can write the payment account / QR in site_settings
--
--  CHANGES NOTHING. One DO block that always ends in an error
--  ("SITE SETTINGS GUARD RESULTS ..."), so Postgres rolls everything back,
--  including the test writes it tries. Every line should start with PASS.
--
--  It calls the two write functions the way the app does, as:
--    * the real owner account (sulutxai@gmail.com, read from shop_users)
--    * a signed-in account that is not an owner of the shop
--    * anon (the public key every browser has)
--  and tries a direct table write as anon / authenticated.
--
--  Run in Supabase SQL Editor as postgres: paste the whole file, Run, copy
--  the error text back.
-- ============================================================

DO $check$
DECLARE
  c_shop  constant uuid := '9afdd9eb-728d-4e36-8077-492c92dbef30';
  c_owner uuid;
  c_other constant uuid := '00000000-0000-0000-0000-0000000000aa';
  report  text := '';
  v_after  text;
  v_n int;
BEGIN
  SELECT user_id INTO c_owner FROM public.shop_users
   WHERE shop_id = c_shop AND role = 'owner' AND active IS TRUE AND email = 'sulutxai@gmail.com';
  IF c_owner IS NULL THEN RAISE EXCEPTION 'CHECK: owner row not found in shop_users'; END IF;

  -- C1 the owner cannot change a payment key through update_site_setting
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_owner, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.update_site_setting('qr_payment_number', 'CHECK-C1');
    report := report || E'\nFAIL C1 update_site_setting accepted qr_payment_number';
  EXCEPTION WHEN insufficient_privilege THEN
    report := report || E'\nPASS C1 update_site_setting refuses payment keys (' || SQLERRM || ')';
  END;
  BEGIN
    PERFORM public.update_site_setting('payment_banks', '[]');
    report := report || E'\nFAIL C2 update_site_setting accepted payment_banks';
  EXCEPTION WHEN insufficient_privilege THEN
    report := report || E'\nPASS C2 payment_banks refused too';
  END;
  BEGIN
    PERFORM public.update_site_setting('qr_payment_name', 'CHECK-C3');
    report := report || E'\nFAIL C3 update_site_setting accepted qr_payment_name';
  EXCEPTION WHEN insufficient_privilege THEN
    report := report || E'\nPASS C3 qr_payment_name refused too';
  END;

  -- C4 the owner CAN change it through update_payment_setting (rolled back at the end)
  BEGIN
    PERFORM public.update_payment_setting('qr_payment_number', 'CHECK-C4');
    report := report || E'\nPASS C4 owner can save through update_payment_setting';
  EXCEPTION WHEN OTHERS THEN
    report := report || E'\nFAIL C4 owner refused: ' || SQLERRM;
  END;

  -- C5 a signed-in account that is not the owner is refused by update_payment_setting
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_other, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.update_payment_setting('qr_payment_number', 'CHECK-C5');
    report := report || E'\nFAIL C5 non-owner changed the payment number';
  EXCEPTION WHEN insufficient_privilege THEN
    report := report || E'\nPASS C5 non-owner refused inside update_payment_setting (' || SQLERRM || ')';
  END;

  -- C6 a non-owner cannot write the table directly (RLS)
  UPDATE public.site_settings SET value = 'CHECK-C6' WHERE key = 'qr_payment_number';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  report := report || CASE WHEN v_n = 0 THEN E'\nPASS C6 direct table write as authenticated changes nothing' ELSE E'\nFAIL C6 direct write changed ' || v_n || ' row(s)' END;

  -- C7 anon cannot call either function / C8 nor write the table
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  BEGIN
    PERFORM public.update_payment_setting('qr_payment_number', 'CHECK-C7');
    report := report || E'\nFAIL C7 anon called update_payment_setting';
  EXCEPTION WHEN insufficient_privilege THEN
    report := report || E'\nPASS C7 anon cannot call update_payment_setting';
  END;
  BEGIN
    PERFORM public.update_site_setting('shop_name', 'CHECK-C7b');
    report := report || E'\nFAIL C7b anon called update_site_setting';
  EXCEPTION WHEN insufficient_privilege THEN
    report := report || E'\nPASS C7b anon cannot call update_site_setting';
  END;
  UPDATE public.site_settings SET value = 'CHECK-C8' WHERE key = 'qr_payment_number';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  report := report || CASE WHEN v_n = 0 THEN E'\nPASS C8 direct table write as anon changes nothing' ELSE E'\nFAIL C8 anon changed ' || v_n || ' row(s)' END;

  PERFORM set_config('role', 'postgres', true);
  SELECT value INTO v_after FROM public.site_settings WHERE key = 'qr_payment_number';
  report := report || E'\n(info) value now in this check: ' || COALESCE(v_after, 'null') || ' -- the real value comes back after the rollback';

  RAISE EXCEPTION 'SITE SETTINGS GUARD RESULTS (all rolled back, nothing changed):%', report;
END
$check$;
