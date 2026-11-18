-- ============================================================
--  Test for migration 068 (POS lookup says "birthday today", not the date)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("068 TEST RESULTS ..."), so everything rolls back, including the test
--  customers. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres AFTER 067, copy the error text back.
--  Section "body of 068" is a copy of supabase/migrations/068_lookup_birthday_flag.sql.
-- ============================================================
DO $test$
DECLARE
  report  text := '';
  v_today date := (now() AT TIME ZONE 'Asia/Vientiane')::date;
  r       jsonb;
BEGIN
  -- ---- body of 068 ----
  EXECUTE $body$
CREATE OR REPLACE FUNCTION public.pos_find_customer(p_phone text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_digits  text := public.phone_digits(p_phone);
  v_headers json := NULLIF(current_setting('request.headers', true), '')::json;
  v_scope   text;
  v_misses  int;
  v_oldest  timestamptz;
  v_c       public.customers;
BEGIN
  IF length(v_digits) < 8 THEN
    RAISE EXCEPTION 'PHONE_TOO_SHORT: type the full phone number' USING ERRCODE = '22023';
  END IF;
  v_scope := 'lookup:' || COALESCE(NULLIF(btrim(v_headers->>'cf-connecting-ip'), ''), 'unknown');
  PERFORM pg_advisory_xact_lock(hashtext(v_scope));
  SELECT count(*), min(at) INTO v_misses, v_oldest FROM public.customer_lookup_misses
  WHERE scope = v_scope AND at > clock_timestamp() - interval '60 seconds';
  IF v_misses >= 20 THEN
    RAISE EXCEPTION 'LOOKUP_PAUSED: wait % s',
      GREATEST(1, ceil(extract(epoch FROM v_oldest + interval '60 seconds' - clock_timestamp())))::int
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_c FROM public.customers
  WHERE public.phone_digits(phone) = v_digits ORDER BY created_at LIMIT 1;
  IF v_c.id IS NULL THEN
    DELETE FROM public.customer_lookup_misses WHERE at < clock_timestamp() - interval '1 hour';
    INSERT INTO public.customer_lookup_misses (scope) VALUES (v_scope);
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', v_c.id, 'name', v_c.name,
    'vip_tier', COALESCE(v_c.vip_tier, 'regular'), 'loyalty_points', COALESCE(v_c.loyalty_points, 0),
    'is_birthday_today', COALESCE(to_char(v_c.birthday, 'MM-DD') = to_char(now() AT TIME ZONE 'Asia/Vientiane', 'MM-DD'), false)
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.pos_find_customer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_find_customer(text) TO anon, authenticated, service_role;
  $body$;

  INSERT INTO public.customers (phone, name, birthday) VALUES
    ('020-9999-0681', 'TEST068 birthday today', (v_today - interval '30 years')::date),
    ('020-9999-0682', 'TEST068 birthday tomorrow', (v_today + 1 - interval '30 years')::date),
    ('020-9999-0683', 'TEST068 no birthday', NULL);

  PERFORM set_config('request.headers', '{"cf-connecting-ip":"203.0.113.68"}', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);

  r := public.pos_find_customer('02099990681');
  report := report || CASE WHEN (r->>'is_birthday_today')::boolean IS TRUE THEN E'\nPASS T1 birthday today = true' ELSE E'\nFAIL T1 ' || r::text END;
  report := report || CASE WHEN (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r) k) = ARRAY['id', 'is_birthday_today', 'loyalty_points', 'name', 'vip_tier']
      THEN E'\nPASS T2 no birthday date or other data sent' ELSE E'\nFAIL T2 ' || r::text END;
  r := public.pos_find_customer('02099990682');
  report := report || CASE WHEN (r->>'is_birthday_today')::boolean IS FALSE THEN E'\nPASS T3 birthday tomorrow = false' ELSE E'\nFAIL T3 ' || r::text END;
  r := public.pos_find_customer('02099990683');
  report := report || CASE WHEN (r->>'is_birthday_today')::boolean IS FALSE THEN E'\nPASS T4 no birthday = false' ELSE E'\nFAIL T4 ' || r::text END;
  RESET ROLE;
  -- T5 "today" is the Lao date, not the UTC date (they differ 00:00-07:00 Lao time)
  report := report || CASE WHEN pg_get_functiondef('public.pos_find_customer(text)'::regprocedure) LIKE '%now() AT TIME ZONE ''Asia/Vientiane''%'
      THEN E'
PASS T5 today = Lao date' ELSE E'
FAIL T5 not using Lao time' END;

  RAISE EXCEPTION '068 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
