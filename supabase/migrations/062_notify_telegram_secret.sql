-- 062: Telegram messages from the database carry the system's secret
--
-- Before: notify_telegram called the telegram-send Edge Function with the public
-- anon key, and telegram-send checked nothing, so anyone with that key (every
-- browser has it) could post any text into the shop's Telegram chat.
-- After: telegram-send (deployed together with this) accepts only
--   * this function, sending the x-notify-secret header read from Vault
--     ("telegram_send_secret", same value as the function secret TELEGRAM_SEND_SECRET)
--   * a signed-in active member of the shop (their own session token).
-- Same signature and same callers as the live function (large-order and low-stock
-- triggers, cash_notify). A missing secret never blocks a sale: it raises a WARNING
-- (Postgres log) and sends nothing.
-- Before running: create the Vault secret (docs/deploy-telegram-send-secret.md, step 1).
-- Test first: docs/test-062-notify-telegram-secret.sql

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
    body    := jsonb_build_object('message', p_message, 'type', p_type)
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.notify_telegram(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_telegram(text, text) TO service_role;
