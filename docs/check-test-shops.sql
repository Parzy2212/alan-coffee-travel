-- Read-only. Run in the Supabase SQL Editor as one query; copy the result grid back.
-- Shows every shop with its login accounts and POS employees, to identify the
-- 3rd "owner" account and what belongs to the two TEST QA shops
-- (created 2026-09-03 / 09-04 during the test-account work).
SELECT s.name AS shop, left(s.id::text, 8) AS shop_id, s.created_at::date AS created,
       'login' AS kind, su.email AS who,
       format('role %s | active %s | accepted %s', su.role, su.active, su.accepted_at::date) AS detail
FROM public.shops s
JOIN public.shop_users su ON su.shop_id = s.id
UNION ALL
SELECT s.name, left(s.id::text, 8), s.created_at::date,
       'POS employee', e.name, format('role %s | active %s', e.role, e.is_active)
FROM public.shops s
JOIN public.employees e ON e.shop_id = s.id
UNION ALL
SELECT s.name, left(s.id::text, 8), s.created_at::date, 'shop (no people)', '-', format('status %s', s.status)
FROM public.shops s
WHERE NOT EXISTS (SELECT 1 FROM public.shop_users su WHERE su.shop_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.shop_id = s.id)
ORDER BY 3, 1, 4, 5;

-- PROPOSAL ONLY -- do not run until the owner has read the result above and agreed.
-- Switches the two test shops off without deleting anything (can be undone by
-- setting the same columns back to true):
--
-- UPDATE public.shop_users SET active = false
-- WHERE shop_id IN ('655df54f-3879-4b55-9076-f84ed94d36b5', 'df5fc75f-bf2a-48d6-bb95-7e48ce0ccb63');
-- UPDATE public.employees SET is_active = false
-- WHERE shop_id IN ('655df54f-3879-4b55-9076-f84ed94d36b5', 'df5fc75f-bf2a-48d6-bb95-7e48ce0ccb63');
--
-- The test login itself (Dashboard -> Authentication -> Users) can be banned there;
-- that is a dashboard action, not SQL.
