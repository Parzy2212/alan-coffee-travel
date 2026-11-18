-- ============================================================
--  Test for migration 069 (29 Feb birthdays show on 28 Feb in other years)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("069 TEST RESULTS ..."), so everything rolls back. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres AFTER 068, copy the error text back.
--  Section "body of 069" is a copy of supabase/migrations/069_birthday_feb_29.sql.
-- ============================================================
DO $test$
DECLARE
  report text := '';
  v_today date := (now() AT TIME ZONE 'Asia/Vientiane')::date;
  r jsonb;
BEGIN
  EXECUTE $body$
CREATE OR REPLACE FUNCTION public.is_birthday_on(p_birthday date, p_day date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $f$
  SELECT COALESCE(
    to_char(p_birthday, 'MM-DD') = to_char(p_day, 'MM-DD')
    OR (to_char(p_birthday, 'MM-DD') = '02-29' AND to_char(p_day, 'MM-DD') = '02-28'
        AND extract(day FROM make_date(extract(year FROM p_day)::int, 3, 1) - 1) = 28),
    false)
$f$;
REVOKE ALL ON FUNCTION public.is_birthday_on(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_birthday_on(date, date) TO service_role;

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
    'is_birthday_today', public.is_birthday_on(v_c.birthday, (now() AT TIME ZONE 'Asia/Vientiane')::date)
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.pos_find_customer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_find_customer(text) TO anon, authenticated, service_role;
  $body$;

  report := report || CASE WHEN public.is_birthday_on(DATE '2000-02-29', DATE '2027-02-28') THEN E'\nPASS T1 29 Feb -> 28 Feb in 2027' ELSE E'\nFAIL T1' END;
  report := report || CASE WHEN NOT public.is_birthday_on(DATE '2000-02-29', DATE '2028-02-28') THEN E'\nPASS T2 not 28 Feb in leap 2028' ELSE E'\nFAIL T2' END;
  report := report || CASE WHEN public.is_birthday_on(DATE '2000-02-29', DATE '2028-02-29') THEN E'\nPASS T3 29 Feb in leap 2028' ELSE E'\nFAIL T3' END;
  report := report || CASE WHEN NOT public.is_birthday_on(DATE '2000-02-29', DATE '2027-03-01') THEN E'\nPASS T4 not 1 Mar' ELSE E'\nFAIL T4' END;
  report := report || CASE WHEN public.is_birthday_on(DATE '1990-02-28', DATE '2027-02-28')
      AND NOT public.is_birthday_on(DATE '1990-02-28', DATE '2028-02-29') THEN E'\nPASS T5 28 Feb birthdays unchanged' ELSE E'\nFAIL T5' END;
  report := report || CASE WHEN public.is_birthday_on(DATE '1990-11-18', DATE '2026-11-18')
      AND NOT public.is_birthday_on(NULL, DATE '2026-11-18') THEN E'\nPASS T6 normal day, no birthday = false' ELSE E'\nFAIL T6' END;

  INSERT INTO public.customers (phone, name, birthday) VALUES ('020-9999-0691', 'TEST069 today', (v_today - interval '30 years')::date);
  PERFORM set_config('request.headers', '{"cf-connecting-ip":"203.0.113.69"}', true);
  PERFORM set_config('role', 'anon', true);
  r := public.pos_find_customer('02099990691');
  RESET ROLE;
  report := report || CASE WHEN (r->>'is_birthday_today')::boolean IS TRUE
      AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r) k) = ARRAY['id', 'is_birthday_today', 'loyalty_points', 'name', 'vip_tier']
      THEN E'\nPASS T7 POS lookup still works, same fields' ELSE E'\nFAIL T7 ' || COALESCE(r::text, 'NULL') END;
  report := report || CASE WHEN pg_get_functiondef('public.pos_find_customer(text)'::regprocedure) LIKE '%now() AT TIME ZONE ''Asia/Vientiane''%'
      AND NOT has_function_privilege('anon', 'public.is_birthday_on(date,date)', 'EXECUTE')
      THEN E'\nPASS T8 Lao date; helper not callable by anon' ELSE E'\nFAIL T8' END;

  RAISE EXCEPTION '069 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
