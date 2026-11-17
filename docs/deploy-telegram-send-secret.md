# Deploy: telegram-send accepts only the database and signed-in shop members

After this, the public key every browser has can no longer post into the shop's
Telegram chat. Two callers still work:

- the database (`notify_telegram`, used by the large-order / low-stock alerts and
  the cash drawer messages), which sends a secret that is kept in Vault
- someone signed in whose account is an active member of the shop (`shop_users`);
  this is the leave-request page in `/cafe`

Do steps 1 to 5 in order, in one sitting. Between step 4 and step 5, alerts from
the database are refused, so don't leave a long gap there.

## 1. Create the secret (SQL Editor)

Paste and Run:

```sql
SELECT vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
                           'telegram_send_secret',
                           'telegram-send: messages from the database');
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_send_secret';
```

The second result is 64 letters and digits. Copy it for step 2. Don't paste it in
chat, a file or a screenshot.
If the first line says the name already exists, skip it and just run the second line.

## 2. Give the same secret to the function

Supabase Dashboard → Edge Functions → **Secrets** → Add new secret:

- Name: `TELEGRAM_SEND_SECRET`
- Value: the 64 characters from step 1

Save.

## 3. Test the migration (SQL Editor)

Paste the whole of `docs/test-062-notify-telegram-secret.sql` and Run. The result is an
error message that begins `062 TEST RESULTS`, followed by 4 lines. Every line must start
with PASS. It sends nothing. If any line says FAIL, stop and send the message to Claude.

## 4. Run the migration (SQL Editor)

Paste the whole of `supabase/migrations/062_notify_telegram_secret.sql` and Run.

## 5. Deploy the new function

In a terminal, in `D:\alan-coffee-travel`:

```
npx supabase functions deploy telegram-send --no-verify-jwt --project-ref fmsdfcsqdpdlppucuptn
```

(If it asks you to log in, run `npx supabase login` first.)

`--no-verify-jwt` is required. The database call carries the secret, not a login,
and the function does the checking itself. Without this flag, alerts from the
database are refused.

Dashboard alternative: Edge Functions → telegram-send → Code → paste the whole of
`supabase/functions/telegram-send/index.ts` → Deploy. Then in the function's
Details/Settings, switch **off** "Enforce JWT Verification".

## 6. Test

**A. The public key is refused (the main check).** Run this in this session as
`! <command>`, or ask Claude to run it. It uses only the public key:

```
curl -s -i -X POST https://fmsdfcsqdpdlppucuptn.supabase.co/functions/v1/telegram-send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local>" \
  -d '{"message":"TEST anon — this must NOT arrive"}'
```

Expected:
- `HTTP/2 401` and `{"ok":false,"error":"sign in required"}`
- nothing arrives in the shop's Telegram chat

Also try it without the `Authorization` line. That must also give 401.

Then try a made-up secret, as someone guessing it would. This must also give 401,
and nothing may arrive:

```
curl -s -i -X POST https://fmsdfcsqdpdlppucuptn.supabase.co/functions/v1/telegram-send   -H "Content-Type: application/json"   -H "x-notify-secret: 0000000000000000000000000000000000000000000000000000000000000000"   -d '{"message":"TEST wrong secret — this must NOT arrive"}'
```

**B. The database can send (SQL Editor):**

```sql
SELECT public.notify_telegram('ทดสอบระบบ: ข้อความจากฐานข้อมูล', 'test');
```

Expected:
- the message arrives in the shop's Telegram chat within a few seconds
- if it does not, run the next query and send the result to Claude:

```sql
SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 1;
```

`200` with `"ok":true` = sent. `401` = steps 1 and 2 hold different values, or
`--no-verify-jwt` was not used.

**C. A signed-in shop member can send (the leave page):**

1. Sign in to `/cafe` with the owner account.
2. Go to พนักงาน → ลา → "+ ขอลาใหม่".
3. Choose any employee, set reason "ทดสอบ Telegram ลบได้", and save.

Expected:
- a "คำขอลาใหม่" message arrives in Telegram
- no orange "ส่งแจ้งเตือน Telegram ไม่สำเร็จ" line appears
- then press ปฏิเสธ on that request (this one sends no message)

Note: this test adds one leave-request row to the real database.

## What else changes

- The three AI functions (`alan-insights`, `alan-quests`, `anomaly-detector`) sent
  with the public key, so their Telegram messages are now refused. They read data
  with the public key and can't see real data anyway (set 6, question 1 suggests
  undeploying them).
- If the Vault secret is missing, the database sends nothing and writes a WARNING
  to the Postgres log. A sale or shift close is never blocked by Telegram.

## Undo

Redeploy the previous function from git (`git show 9383a18:supabase/functions/telegram-send/index.ts`).
The anon hole then comes back. Leave 062 in place: it keeps working with either function
version as long as `--no-verify-jwt` is set.
