-- ============================================================
--  Test for migration 067 (POS customer lookup limit)
--  CHANGES NOTHING: one DO block that always ends in an error
--  ("067 TEST RESULTS ..."), so everything rolls back, including the
--  test customer and the counted misses. Every line should start with PASS.
--  Run in Supabase SQL Editor as postgres, copy the error text back.
--  Section "body of 067" is a copy of supabase/migrations/067_customer_lookup_limit.sql.
-- ============================================================
DO $test$
DECLARE
  report text := '';
  r      text;
  v_ok   boolean;
BEGIN
  -- ---- body of 067 ----
  EXECUTE $body$
CREATE TABLE IF NOT EXISTS public.customer_lookup_misses (
  scope text        NOT NULL,
  at    timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS customer_lookup_misses_scope_at ON public.customer_lookup_misses (scope, at);
ALTER TABLE public.customer_lookup_misses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_lookup_misses FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.pos_find_customer(text);
CREATE FUNCTION public.pos_find_customer(p_phone text)
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
    'vip_tier', COALESCE(v_c.vip_tier, 'regular'), 'loyalty_points', COALESCE(v_c.loyalty_points, 0)
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.pos_find_customer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_find_customer(text) TO anon, authenticated, service_role;
  $body$;

  -- one lookup as anon from address p_ip; result as text, or 'ERR <state> <message>'
  EXECUTE $h$
  CREATE FUNCTION pg_temp.t067(p_ip text, p_phone text) RETURNS text LANGUAGE plpgsql AS $f$
  DECLARE v text;
  BEGIN
    PERFORM set_config('request.headers', json_build_object('cf-connecting-ip', p_ip)::text, true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('role', 'anon', true);
    BEGIN
      v := public.pos_find_customer(p_phone)::text;
    EXCEPTION WHEN OTHERS THEN
      v := 'ERR ' || SQLSTATE || ' ' || SQLERRM;
    END;
    RESET ROLE;
    RETURN COALESCE(v, 'NULL');
  END
  $f$
  $h$;

  INSERT INTO public.customers (phone, name, email, birthday, loyalty_points, vip_tier, visit_count)
  VALUES ('020-9999-0067', 'TEST067 customer', 'test067@example.invalid', DATE '1990-05-05', 300, 'silver', 4);

  -- T1 a found customer: only id, name, points, VIP tier
  r := pg_temp.t067('203.0.113.1', '02099990067');
  report := report || CASE WHEN r LIKE '%TEST067 customer%' AND r LIKE '%"loyalty_points": 300%' AND r LIKE '%"vip_tier": "silver"%'
      AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r::jsonb) k) = ARRAY['id', 'loyalty_points', 'name', 'vip_tier']
      THEN E'\nPASS T1 found: only id, name, points, VIP tier' ELSE E'\nFAIL T1 ' || r END;

  -- T2 20 misses in a minute are answered, the 21st lookup is paused
  v_ok := true;
  FOR i IN 1..20 LOOP
    IF pg_temp.t067('203.0.113.2', '0200000' || lpad(i::text, 4, '0')) <> 'NULL' THEN v_ok := false; END IF;
  END LOOP;
  r := pg_temp.t067('203.0.113.2', '02000009999');
  report := report || CASE WHEN v_ok AND r LIKE 'ERR P0001%LOOKUP_PAUSED%'
      THEN E'\nPASS T2 21st lookup after 20 misses is paused' ELSE E'\nFAIL T2 ' || r END;
  -- T3 while paused, that address cannot look up a real number either (no leaking hits)
  r := pg_temp.t067('203.0.113.2', '02099990067');
  report := report || CASE WHEN r LIKE 'ERR P0001%LOOKUP_PAUSED%' THEN E'\nPASS T3 paused address gets no customer' ELSE E'\nFAIL T3 ' || r END;
  -- T4 another address (the shop) is not affected
  r := pg_temp.t067('198.51.100.9', '02099990067');
  report := report || CASE WHEN r LIKE '%TEST067 customer%' THEN E'\nPASS T4 another address still finds customers' ELSE E'\nFAIL T4 ' || r END;

  -- T5 found lookups are not counted and do not clear misses: 19 misses, 5 finds, 1 miss = 20 misses
  FOR i IN 1..19 LOOP PERFORM pg_temp.t067('203.0.113.3', '0201111' || lpad(i::text, 4, '0')); END LOOP;
  v_ok := true;
  FOR i IN 1..5 LOOP
    IF pg_temp.t067('203.0.113.3', '02099990067') NOT LIKE '%TEST067%' THEN v_ok := false; END IF;
  END LOOP;
  r := pg_temp.t067('203.0.113.3', '02011119999');
  IF r <> 'NULL' THEN v_ok := false; END IF;
  r := pg_temp.t067('203.0.113.3', '02099990067');
  report := report || CASE WHEN v_ok AND r LIKE 'ERR P0001%LOOKUP_PAUSED%'
      THEN E'\nPASS T5 finds neither count nor reset the misses' ELSE E'\nFAIL T5 ' || r END;

  -- T6 misses older than a minute no longer count
  INSERT INTO public.customer_lookup_misses (scope, at)
  SELECT 'lookup:203.0.113.4', clock_timestamp() - interval '2 minutes' FROM generate_series(1, 30);
  r := pg_temp.t067('203.0.113.4', '02099990067');
  report := report || CASE WHEN r LIKE '%TEST067%' THEN E'\nPASS T6 old misses do not count' ELSE E'\nFAIL T6 ' || r END;

  -- T7 the app's roles cannot read or change the counter
  report := report || CASE WHEN NOT has_table_privilege('anon', 'public.customer_lookup_misses', 'SELECT')
      AND NOT has_table_privilege('anon', 'public.customer_lookup_misses', 'DELETE')
      AND NOT has_table_privilege('authenticated', 'public.customer_lookup_misses', 'DELETE')
      THEN E'\nPASS T7 anon / authenticated cannot touch the counter' ELSE E'\nFAIL T7 grants' END;

  -- T8 a caller-sent x-forwarded-for does not give a fresh counter (no cf-connecting-ip = one shared counter)
  v_ok := true;
  FOR i IN 1..20 LOOP
    PERFORM set_config('request.headers', json_build_object('x-forwarded-for', '192.0.2.' || i)::text, true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('role', 'anon', true);
    IF public.pos_find_customer('0202222' || lpad(i::text, 4, '0')) IS NOT NULL THEN v_ok := false; END IF;
    RESET ROLE;
  END LOOP;
  BEGIN
    PERFORM set_config('request.headers', json_build_object('x-forwarded-for', '192.0.2.99')::text, true);
    PERFORM set_config('role', 'anon', true);
    PERFORM public.pos_find_customer('02022229999');
    RESET ROLE;
    report := report || E'\nFAIL T8 a new x-forwarded-for got past the limit';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    report := report || CASE WHEN v_ok AND SQLERRM LIKE 'LOOKUP_PAUSED%'
        THEN E'\nPASS T8 faked x-forwarded-for does not dodge the limit' ELSE E'\nFAIL T8 ' || SQLERRM END;
  END;

  RAISE EXCEPTION '067 TEST RESULTS (all rolled back, nothing changed):%', report;
END
$test$;
