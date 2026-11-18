-- ============================================================
--  Test for migration 065 (customers only through functions)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("065 TEST RESULTS ..."), so everything rolls back, including the test
--  customers it creates. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres, copy the error text back.
--  Section "body of 065" is a copy of supabase/migrations/065_customers_via_functions.sql.
-- ============================================================
DO $test$
DECLARE
  report   text := '';
  v_owner  uuid;
  v_out    uuid := '00000000-0000-0000-0000-0000000065bb';
  v_cust   uuid;
  r        text;
  v_n      int;
BEGIN
  SELECT user_id INTO v_owner FROM public.shop_users
  WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30' AND role = 'owner' AND active IS TRUE LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION '065 TEST: no active owner in shop_users'; END IF;

  -- ---- body of 065 ----
  EXECUTE $body$
CREATE OR REPLACE FUNCTION public.phone_digits(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  SELECT CASE WHEN d LIKE '856%' THEN '0' || substr(d, 4) ELSE d END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '\D', '', 'g') AS d) x
$fn$;

CREATE OR REPLACE FUNCTION public.pos_find_customer(p_phone text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_digits text := public.phone_digits(p_phone);
  v_c      public.customers;
BEGIN
  IF length(v_digits) < 8 THEN
    RAISE EXCEPTION 'PHONE_TOO_SHORT: type the full phone number' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_c FROM public.customers
  WHERE public.phone_digits(phone) = v_digits
  ORDER BY created_at LIMIT 1;
  IF v_c.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', v_c.id, 'name', v_c.name, 'phone', v_c.phone,
    'vip_tier', COALESCE(v_c.vip_tier, 'regular'), 'loyalty_points', COALESCE(v_c.loyalty_points, 0),
    'visit_count', COALESCE(v_c.visit_count, 0), 'last_visit', v_c.last_visit,
    'birthday', CASE WHEN to_char(v_c.birthday, 'MM-DD') = to_char(now() AT TIME ZONE 'Asia/Vientiane', 'MM-DD')
                     THEN v_c.birthday END
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.pos_find_customer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_find_customer(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.crm_list_customers(p_q text DEFAULT '', p_limit int DEFAULT 100)
RETURNS SETOF public.customers LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_q text := btrim(COALESCE(p_q, ''));
BEGIN
  PERFORM public.require_real_shop_role(ARRAY['owner', 'manager']);
  RETURN QUERY
    SELECT * FROM public.customers c
    WHERE v_q = '' OR c.phone ILIKE '%' || v_q || '%' OR c.name ILIKE '%' || v_q || '%'
    ORDER BY c.visit_count DESC NULLS LAST, c.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END
$fn$;
REVOKE ALL ON FUNCTION public.crm_list_customers(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_list_customers(text, int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.crm_update_customer(p_id uuid, p_fields jsonb)
RETURNS public.customers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_c public.customers;
BEGIN
  PERFORM public.require_real_shop_role(ARRAY['owner', 'manager']);
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(COALESCE(p_fields, '{}'::jsonb)) k
             WHERE k NOT IN ('name', 'phone', 'email', 'birthday', 'notes')) THEN
    RAISE EXCEPTION 'only name, phone, email, birthday and notes can be changed here' USING ERRCODE = '22023';
  END IF;
  IF p_fields ? 'phone' AND EXISTS (SELECT 1 FROM public.customers
      WHERE id <> p_id AND public.phone_digits(phone) = public.phone_digits(p_fields->>'phone')) THEN
    RAISE EXCEPTION 'CUSTOMER_EXISTS: this phone number is already a customer' USING ERRCODE = '23505';
  END IF;
  UPDATE public.customers SET
    name       = CASE WHEN p_fields ? 'name'     THEN NULLIF(btrim(p_fields->>'name'), '')  ELSE name END,
    phone      = CASE WHEN p_fields ? 'phone'    THEN NULLIF(btrim(p_fields->>'phone'), '') ELSE phone END,
    email      = CASE WHEN p_fields ? 'email'    THEN NULLIF(btrim(p_fields->>'email'), '') ELSE email END,
    birthday   = CASE WHEN p_fields ? 'birthday' THEN NULLIF(p_fields->>'birthday', '')::date ELSE birthday END,
    notes      = CASE WHEN p_fields ? 'notes'    THEN NULLIF(p_fields->>'notes', '')        ELSE notes END,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_c;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN v_c;
END
$fn$;
REVOKE ALL ON FUNCTION public.crm_update_customer(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_update_customer(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.crm_redeem_points(p_customer uuid, p_points int, p_description text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_balance int;
BEGIN
  PERFORM public.require_real_shop_role(ARRAY['owner', 'manager']);
  IF p_points IS NULL OR p_points <= 0 OR p_points % 100 <> 0 THEN
    RAISE EXCEPTION 'POINTS_INVALID: points must be a positive multiple of 100' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(loyalty_points, 0) INTO v_balance FROM public.customers WHERE id = p_customer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF p_points > v_balance THEN
    RAISE EXCEPTION 'POINTS_NOT_ENOUGH: has %, asked %', v_balance, p_points USING ERRCODE = '22023';
  END IF;
  UPDATE public.customers SET loyalty_points = v_balance - p_points, updated_at = now() WHERE id = p_customer;
  INSERT INTO public.loyalty_transactions (shop_id, customer_id, order_id, type, points, description)
  VALUES ('9afdd9eb-728d-4e36-8077-492c92dbef30', p_customer, NULL, 'redeem', -p_points,
          COALESCE(NULLIF(btrim(p_description), ''), 'Points redeemed'));
  RETURN v_balance - p_points;
END
$fn$;
REVOKE ALL ON FUNCTION public.crm_redeem_points(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_redeem_points(uuid, int, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.crm_upsert_customer(p_phone text, p_name text, p_email text DEFAULT NULL::text,
  p_birthday date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_tags text[] DEFAULT '{}'::text[],
  p_nationality text DEFAULT NULL::text, p_shop_id uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_row      public.customers;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM public.customers
  WHERE public.phone_digits(phone) = public.phone_digits(p_phone) ORDER BY created_at LIMIT 1;
  IF v_existing IS NULL THEN
    INSERT INTO public.customers (phone, name, email, birthday, notes, tags, nationality, shop_id)
    VALUES (p_phone, p_name, p_email, p_birthday, p_notes, p_tags, p_nationality, p_shop_id)
    ON CONFLICT (phone) DO NOTHING
    RETURNING * INTO v_row;
    IF v_row.id IS NOT NULL THEN RETURN to_jsonb(v_row); END IF;
    SELECT id INTO v_existing FROM public.customers WHERE phone = p_phone;
  END IF;

  IF NOT public.real_shop_role_in(ARRAY['owner', 'manager']) THEN
    RAISE EXCEPTION 'CUSTOMER_EXISTS: this phone number is already a customer' USING ERRCODE = '23505';
  END IF;
  UPDATE public.customers SET
    name        = p_name,
    email       = COALESCE(p_email, email),
    birthday    = COALESCE(p_birthday, birthday),
    notes       = COALESCE(p_notes, notes),
    tags        = COALESCE(p_tags, tags),
    nationality = COALESCE(p_nationality, nationality),
    updated_at  = now()
  WHERE id = v_existing
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END
$fn$;
  $body$;

  -- runs one SQL expression as p_role (auth.uid() = p_sub); result as text, or 'ERR <state> <message>'
  EXECUTE $h$
  CREATE FUNCTION pg_temp.t065(p_role text, p_sub uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
  DECLARE v text;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_sub, 'role', p_role)::text, true);
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub::text, ''), true);
    PERFORM set_config('role', p_role, true);
    BEGIN
      EXECUTE 'SELECT (' || p_sql || ')::text' INTO v;
    EXCEPTION WHEN OTHERS THEN
      v := 'ERR ' || SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    RETURN COALESCE(v, 'NULL');
  END
  $f$
  $h$;

  INSERT INTO public.customers (phone, name, email, birthday, loyalty_points, vip_tier)
  VALUES ('020-9999-0065', 'TEST065 customer', 'test065@example.invalid', ((now() AT TIME ZONE 'Asia/Vientiane')::date - 1 - interval '30 years')::date, 250, 'gold')
  RETURNING id INTO v_cust;

  -- T1 POS finds by full phone (other formatting), gets name/tier/points, no email
  r := pg_temp.t065('anon', NULL, $$public.pos_find_customer('02099990065')$$);
  report := report || CASE WHEN r LIKE '%TEST065 customer%' AND r LIKE '%"vip_tier": "gold"%' AND r LIKE '%"loyalty_points": 250%'
      AND r NOT LIKE '%test065@%' THEN E'\nPASS T1 POS finds the customer by full phone, no email'
      ELSE E'\nFAIL T1 ' || r END;
  -- T2 birthday hidden when it is not today
  report := report || CASE WHEN r LIKE '%"birthday": null%' THEN E'\nPASS T2 birthday hidden when not today' ELSE E'\nFAIL T2 ' || r END;
  -- T3 part of a number is refused
  r := pg_temp.t065('anon', NULL, $$public.pos_find_customer('0065')$$);
  report := report || CASE WHEN r LIKE 'ERR 22023%' THEN E'\nPASS T3 partial number refused' ELSE E'\nFAIL T3 ' || r END;
  -- T4 unknown number: nothing
  r := pg_temp.t065('anon', NULL, $$public.pos_find_customer('02000000001')$$);
  report := report || CASE WHEN r = 'NULL' THEN E'\nPASS T4 unknown number returns nothing' ELSE E'\nFAIL T4 ' || r END;
  -- T5 anon / outsider cannot list customers
  r := pg_temp.t065('anon', NULL, $$(SELECT count(*) FROM public.crm_list_customers('', 10))$$);
  report := report || CASE WHEN r LIKE 'ERR 42501%' THEN E'\nPASS T5 anon cannot list customers' ELSE E'\nFAIL T5 ' || r END;
  r := pg_temp.t065('authenticated', v_out, $$(SELECT count(*) FROM public.crm_list_customers('', 10))$$);
  report := report || CASE WHEN r LIKE 'ERR 42501%' THEN E'\nPASS T6 non-member cannot list customers' ELSE E'\nFAIL T6 ' || r END;
  -- T7 owner lists and searches
  r := pg_temp.t065('authenticated', v_owner, $$(SELECT count(*) FROM public.crm_list_customers('TEST065', 10))$$);
  report := report || CASE WHEN r = '1' THEN E'\nPASS T7 owner finds the customer in the list' ELSE E'\nFAIL T7 ' || r END;
  -- T8 owner redeems 100 of 250: balance 150 and one history row, together
  r := pg_temp.t065('authenticated', v_owner, format('public.crm_redeem_points(%L, 100, %L)', v_cust, 'TEST065'));
  SELECT count(*) INTO v_n FROM public.loyalty_transactions WHERE customer_id = v_cust AND type = 'redeem' AND points = -100;
  report := report || CASE WHEN r = '150' AND v_n = 1 AND (SELECT loyalty_points FROM public.customers WHERE id = v_cust) = 150
      THEN E'\nPASS T8 redeem lowers the balance and records it' ELSE E'\nFAIL T8 ' || r || ' rows=' || v_n END;
  -- T9 not a multiple of 100
  r := pg_temp.t065('authenticated', v_owner, format('public.crm_redeem_points(%L, 150)', v_cust));
  report := report || CASE WHEN r LIKE 'ERR 22023%POINTS_INVALID%' THEN E'\nPASS T9 150 points refused (multiples of 100)' ELSE E'\nFAIL T9 ' || r END;
  -- T10 more than the balance: refused, nothing changes
  r := pg_temp.t065('authenticated', v_owner, format('public.crm_redeem_points(%L, 200)', v_cust));
  SELECT count(*) INTO v_n FROM public.loyalty_transactions WHERE customer_id = v_cust;
  report := report || CASE WHEN r LIKE 'ERR 22023%POINTS_NOT_ENOUGH%' AND v_n = 1
      AND (SELECT loyalty_points FROM public.customers WHERE id = v_cust) = 150
      THEN E'\nPASS T10 more than the balance refused, nothing recorded' ELSE E'\nFAIL T10 ' || r END;
  -- T11 anon cannot redeem
  r := pg_temp.t065('anon', NULL, format('public.crm_redeem_points(%L, 100)', v_cust));
  report := report || CASE WHEN r LIKE 'ERR 42501%' THEN E'\nPASS T11 anon cannot redeem' ELSE E'\nFAIL T11 ' || r END;
  -- T12 owner edits the name; points cannot be edited this way
  r := pg_temp.t065('authenticated', v_owner, format($$(public.crm_update_customer(%L, '{"name":"TEST065 renamed"}')).name$$, v_cust));
  report := report || CASE WHEN r = 'TEST065 renamed' THEN E'\nPASS T12 owner edits the customer' ELSE E'\nFAIL T12 ' || r END;
  r := pg_temp.t065('authenticated', v_owner, format($$(public.crm_update_customer(%L, '{"loyalty_points":99999}')).name$$, v_cust));
  report := report || CASE WHEN r LIKE 'ERR 22023%' THEN E'\nPASS T13 points cannot be edited directly' ELSE E'\nFAIL T13 ' || r END;
  -- T14 anon "add customer" with an existing phone: refused, name kept, record not returned
  r := pg_temp.t065('anon', NULL, $$public.crm_upsert_customer('020-9999-0065', 'hijack')$$);
  report := report || CASE WHEN r LIKE 'ERR 23505%CUSTOMER_EXISTS%'
      AND (SELECT name FROM public.customers WHERE id = v_cust) = 'TEST065 renamed'
      THEN E'\nPASS T14 anon cannot overwrite an existing customer' ELSE E'\nFAIL T14 ' || r END;
  -- T15 anon adds a new customer as before
  r := pg_temp.t065('anon', NULL, $$public.crm_upsert_customer('020-9999-0066', 'TEST065 new')$$);
  report := report || CASE WHEN r LIKE '%TEST065 new%' THEN E'\nPASS T15 adding a new customer still works' ELSE E'\nFAIL T15 ' || r END;
  -- T16 owner "add" with an existing phone updates it, as before
  r := pg_temp.t065('authenticated', v_owner, $$public.crm_upsert_customer('020-9999-0065', 'TEST065 by owner')$$);
  report := report || CASE WHEN r LIKE '%TEST065 by owner%' THEN E'\nPASS T16 owner can still update by phone' ELSE E'\nFAIL T16 ' || r END;

  -- T17 a differently written number is the same customer
  r := pg_temp.t065('anon', NULL, $$public.pos_find_customer('+856 20 9999 0065')$$);
  report := report || CASE WHEN r LIKE '%TEST065 by owner%' THEN E'\nPASS T17 +856 format finds the same customer' ELSE E'\nFAIL T17 ' || r END;
  r := pg_temp.t065('anon', NULL, $$public.crm_upsert_customer('+856 20 9999 0065', 'dup')$$);
  SELECT count(*) INTO v_n FROM public.customers WHERE public.phone_digits(phone) = '02099990065';
  report := report || CASE WHEN r LIKE 'ERR 23505%CUSTOMER_EXISTS%' AND v_n = 1
      THEN E'\nPASS T18 no second record from a differently written number' ELSE E'\nFAIL T18 ' || r || ' n=' || v_n END;
  -- T19 changing a phone to another customer's number is refused
  r := pg_temp.t065('authenticated', v_owner, format($$(public.crm_update_customer(%L, '{"phone":"020 9999 0066"}')).phone$$, v_cust));
  report := report || CASE WHEN r LIKE 'ERR 23505%CUSTOMER_EXISTS%' THEN E'\nPASS T19 phone already used by another customer refused' ELSE E'\nFAIL T19 ' || r END;

  RAISE EXCEPTION '065 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
