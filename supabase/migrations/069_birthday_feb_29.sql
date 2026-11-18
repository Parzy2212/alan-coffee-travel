-- 069: customers born on 29 February get the birthday badge on 28 February in other years
--
-- Before (068): the POS lookup compared month-day only, so a 29 Feb birthday never showed
-- in a year without 29 Feb. After (owner decision 2026-11-18): in those years it shows on
-- 28 Feb. The check moves into is_birthday_on(birthday, day) so it can be tested with fixed
-- dates; pos_find_customer is otherwise the same as 068.
-- Test first: docs/test-069-birthday-feb-29.sql

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
