-- 065: customers are read and changed only through functions
--
-- Before: the screens read and wrote public.customers directly, but the live table has no
-- policy for anon, and its authenticated policies use get_my_role() (staff.id = auth.uid()),
-- which matches no one, not even the owner. So the POS customer picker and the /cafe
-- customer list were always empty, edits did nothing, and "redeem points" wrote a
-- loyalty_transactions row while the balance never went down. No screen showed an error.
-- Also: crm_upsert_customer (anon) overwrote the name of any existing customer whose phone
-- was typed, and returned that customer's whole record (email, birthday ...).
--
-- After:
--   * pos_find_customer(phone)  anon + signed-in. Full phone number only (owner decision
--     2026-11-18: no list, no partial search), returns name / tier / points; birthday only
--     when it is today (for the birthday badge).
--   * crm_list_customers, crm_update_customer, crm_redeem_points  owner/manager of the real
--     shop only. Redeem is one step with the row locked: positive, a multiple of 100, not
--     more than the balance; balance and history change together or not at all.
--   * crm_upsert_customer  creating a new customer works as before for everyone; an existing
--     phone is updated only for the owner/manager, anyone else gets CUSTOMER_EXISTS.
--   * phones are compared by digits (phone_digits: "020 1234 5678", "+856 20 1234 5678" and
--     "02012345678" are the same customer), so a differently written number can't create a
--     second record or hide the first one.
-- Not changed: the table policies (nothing reads the table directly any more); the points
-- value (100 pts = 5,000 LAK) stays on the screen, which only records the amount.
-- Test first: docs/test-065-customers-via-functions.sql

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
