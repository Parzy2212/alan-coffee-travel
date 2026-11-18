-- ============================================================
--  Test for migration 064 (notify_telegram waits up to 15 s)
--  CHANGES NOTHING and SENDS NOTHING: one DO block that always ends in an error
--  ("064 TEST RESULTS ..."), so Postgres rolls back the new function and the
--  queued web requests (pg_net only sends after a commit). Every line should
--  start with PASS. Run in Supabase SQL Editor as postgres, copy the error text back.
--  The migration part is a generated copy of
--  supabase/migrations/064_notify_telegram_timeout.sql -- keep in sync.
-- ============================================================

DO $test$
DECLARE
  report   text := '';
  v_secret text;
  v_max    bigint;
  v_req    record;
  v_n      int;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_send_secret';
  IF COALESCE(length(v_secret), 0) < 32 THEN
    RAISE EXCEPTION '064 TEST: create the Vault secret first (deploy-telegram-send-secret.md step 1)';
  END IF;
  INSERT INTO public.site_settings (key, value) VALUES ('telegram_enabled', 'true')
  ON CONFLICT (key) DO UPDATE SET value = 'true';

  -- ---- body of 064 ----

  CREATE OR REPLACE FUNCTION public.notify_telegram(p_message text, p_type text DEFAULT 'general'::text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  DECLARE
    v_enabled text;
    v_secret  text;
  BEGIN
    SELECT value INTO v_enabled FROM public.site_settings WHERE key = 'telegram_enabled';
    IF v_enabled IS DISTINCT FROM 'true' THEN RETURN; END IF;

    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_send_secret';
    IF COALESCE(length(v_secret), 0) < 32 THEN
      -- a notification must never stop the sale or shift close that triggered it
      RAISE WARNING 'notify_telegram: Vault secret telegram_send_secret missing or too short, message not sent';
      RETURN;
    END IF;

    PERFORM net.http_post(
      url     := 'https://fmsdfcsqdpdlppucuptn.supabase.co/functions/v1/telegram-send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
      body    := jsonb_build_object('message', p_message, 'type', p_type),
      timeout_milliseconds := 15000
    );
  END
  $fn$;
  REVOKE ALL ON FUNCTION public.notify_telegram(text, text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.notify_telegram(text, text) TO service_role;

  -- ---- tests ----
  SELECT COALESCE(max(id), 0) INTO v_max FROM net.http_request_queue;

  -- T1 the queued request carries the secret and no public key
  PERFORM public.notify_telegram('TEST064 (rolled back, never sent)', 'test');
  SELECT * INTO v_req FROM net.http_request_queue WHERE id > v_max ORDER BY id DESC LIMIT 1;
  report := report || CASE WHEN v_req.id IS NOT NULL AND v_req.headers->>'x-notify-secret' = v_secret
      AND NOT (v_req.headers ? 'Authorization') AND v_req.url LIKE '%/functions/v1/telegram-send'
      AND v_req.timeout_milliseconds = 15000
      THEN E'\nPASS T1 request carries the secret, no anon key, waits 15 s'
      ELSE E'\nFAIL T1 ' || COALESCE(v_req.url, 'no request queued') END;

  -- T2 Telegram switched off in the shop settings: nothing queued
  SELECT COALESCE(max(id), 0) INTO v_max FROM net.http_request_queue;
  UPDATE public.site_settings SET value = 'false' WHERE key = 'telegram_enabled';
  PERFORM public.notify_telegram('TEST064 off', 'test');
  SELECT count(*) INTO v_n FROM net.http_request_queue WHERE id > v_max;
  report := report || CASE WHEN v_n = 0 THEN E'\nPASS T2 nothing sent when Telegram is off' ELSE E'\nFAIL T2 queued while off' END;
  UPDATE public.site_settings SET value = 'true' WHERE key = 'telegram_enabled';

  -- T3 no secret in Vault: nothing queued and no error (a sale must not fail)
  DELETE FROM vault.secrets WHERE name = 'telegram_send_secret';
  BEGIN
    PERFORM public.notify_telegram('TEST064 no secret', 'test');
    SELECT count(*) INTO v_n FROM net.http_request_queue WHERE id > v_max;
    report := report || CASE WHEN v_n = 0 THEN E'\nPASS T3 no secret: nothing sent, no error' ELSE E'\nFAIL T3 sent without a secret' END;
  EXCEPTION WHEN OTHERS THEN
    report := report || E'\nFAIL T3 raised: ' || SQLERRM;
  END;

  -- T4 the app's roles cannot call it directly
  report := report || CASE WHEN NOT has_function_privilege('anon', 'public.notify_telegram(text,text)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.notify_telegram(text,text)', 'EXECUTE')
      THEN E'\nPASS T4 anon / authenticated cannot call notify_telegram' ELSE E'\nFAIL T4 grants' END;

  RAISE EXCEPTION '064 TEST RESULTS (all rolled back, nothing sent):%', report;
END
$test$;
