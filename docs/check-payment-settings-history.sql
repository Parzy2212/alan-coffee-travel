-- READ-ONLY. Changes nothing. Run in the Supabase SQL Editor and send the 4 results.
-- Who/when last changed the shop's payment details (bank accounts / QR shown on the POS payment screen).

-- 1) When each payment key was last written (site_settings keeps the time only, not who)
SELECT key,
       to_char(updated_at AT TIME ZONE 'Asia/Vientiane', 'YYYY-MM-DD HH24:MI') AS last_changed_lao_time,
       length(value) AS value_length
FROM public.site_settings
WHERE key IN ('payment_banks', 'qr_payment_number', 'qr_payment_name')
ORDER BY updated_at DESC NULLS LAST;

-- 2) Any trace written by the travel-site admin page (it tries to log every change it makes)
SELECT to_jsonb(a) AS row
FROM public.audit_logs a
WHERE a.table_name = 'site_settings'
ORDER BY a.created_at DESC
LIMIT 20;

-- 3) Which columns audit_logs really has (the admin page writes record_id / payload)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_logs'
ORDER BY ordinal_position;

-- 4) Every way to write site_settings: table policies + functions callable from the app
SELECT 'policy' AS kind, policyname AS name, cmd AS detail, roles::text AS who
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_settings'
UNION ALL
SELECT 'function', p.proname, 'writes site_settings',
       concat_ws(',', CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'anon' END,
                      CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'authenticated' END)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) ~* '(insert\s+into|update)\s+(public\.)?site_settings'
  AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
