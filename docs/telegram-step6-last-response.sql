-- Telegram deploy, step 6b if no message arrived: the last answer from telegram-send (holds no secret).
SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 1;
