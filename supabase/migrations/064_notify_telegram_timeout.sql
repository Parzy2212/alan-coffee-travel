-- 064: notify_telegram waits up to 15 s for telegram-send (pg_net default: 5 s)
--
-- Before: a cold start of telegram-send (member check, settings read, Telegram API)
-- can take longer than pg_net's default 5 s; the database then gives up and records
-- a timeout instead of the result, so a failed send is not visible in net._http_response.
-- After: same function as 062 (secret from Vault, same callers, same grants), only the
-- wait is 15 s. pg_net sends in the background after the commit, so a sale or shift
-- close never waits for this.
-- Test first: docs/test-064-notify-telegram-timeout.sql

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
