-- Read-only: why is the staff list in /cafe (พนักงาน & ลงเวลา) empty?
-- Run in Supabase SQL Editor. Changes nothing. Shows counts only, no names or personal data.

-- 1) staff rows (the list in /cafe reads this table through get_all_staff)
SELECT 'staff' AS t, count(*) FILTER (WHERE is_active) AS active, count(*) AS total FROM public.staff;

-- 2) who may read the list: get_all_staff answers only an active owner/manager of the real shop
SELECT 'shop_users owner/manager' AS t, count(*) FILTER (WHERE active IS TRUE) AS active, count(*) AS total
FROM public.shop_users
WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30' AND role IN ('owner', 'manager');

-- 3) the function is still callable by signed-in users and still has the owner/manager check
SELECT has_function_privilege('authenticated', 'public.get_all_staff()', 'EXECUTE') AS signed_in_can_call,
       pg_get_functiondef('public.get_all_staff()'::regprocedure) LIKE '%require_real_shop_role%' AS has_owner_check;
