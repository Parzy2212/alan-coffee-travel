-- Telegram deploy, step 6b: the database sends one test message to the shop's chat.
SELECT public.notify_telegram('ทดสอบระบบ: ข้อความจากฐานข้อมูล', 'test');
