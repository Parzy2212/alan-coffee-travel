-- Telegram deploy, step 1: create the secret, then show it once to copy into Edge Functions -> Secrets.
-- If the first statement says "already exists", run only the last line.
SELECT vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
                           'telegram_send_secret',
                           'telegram-send: messages from the database');
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_send_secret';
