-- 067: POS customer lookup: miss limit, and only name / points / VIP tier come back
--
-- Before (065): pos_find_customer had no limit, so anyone with the public key could try
-- phone numbers one after another, and it returned phone, visits, last visit and birthday.
-- After (owner decision 2026-11-18):
--   * more than 20 lookups that find nobody within 60 s pause lookups from that address
--     (LOOKUP_PAUSED, seconds left in the message) until the minute has passed. A lookup that
--     finds a customer is not counted and does not clear earlier misses (otherwise one known
--     number would reset the count).
--   * counted per caller address: cf-connecting-ip, which Cloudflare (in front of Supabase)
--     sets itself, so a caller can't fake it. x-forwarded-for is not used: its first entry is
--     whatever the caller sent. Without the header every caller shares 'lookup:unknown'
--     (docs/check-lookup-scope-live.sql shows which one live uses). Lookups from one address
--     run one at a time, so parallel requests can't slip past the count.
--   * returns id (needed to attach the bill to the customer), name, loyalty_points, vip_tier.
-- Misses older than 1 hour (any address) are deleted whenever a new one is written.
-- Test first: docs/test-067-customer-lookup-limit.sql

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
