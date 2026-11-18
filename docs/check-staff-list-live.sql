-- Read-only: why is the staff list in /cafe (พนักงาน & ลงเวลา) empty?
-- ONE query, one row. Changes nothing. Numbers only, no names or personal data.
SELECT
  (SELECT count(*) FROM public.staff WHERE is_active)                       AS staff_active,
  (SELECT count(*) FROM public.staff)                                       AS staff_total,
  (SELECT count(*) FROM public.shop_users
    WHERE shop_id = '9afdd9eb-728d-4e36-8077-492c92dbef30'
      AND role IN ('owner', 'manager') AND active IS TRUE)                  AS owners_managers_active,
  has_function_privilege('authenticated', 'public.get_all_staff()', 'EXECUTE') AS signed_in_can_call,
  pg_get_functiondef('public.get_all_staff()'::regprocedure) LIKE '%require_real_shop_role%' AS has_owner_check;
