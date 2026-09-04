-- Fix for: 42P17 "infinite recursion detected in policy for relation shop_users"
--
-- Confirmed by reading all 7 actual policies on shop_users (screenshots from
-- Supabase Dashboard, 2026-09-04). Three are already safe:
--   shop_users_self_read    (SELECT, using: user_id = auth.uid())
--   shop_users_self_insert  (INSERT, with check: user_id = auth.uid())
--   shop_users_same_shop_read (SELECT, using: shop_id IN (SELECT user_shop_ids()))
--     -- proven non-recursive all session: every SELECT against shop_users
--     -- returned 200 with correct results, never 42P17. user_shop_ids()
--     -- is almost certainly SECURITY DEFINER already (confirm at
--     -- Database -> Functions -> user_shop_ids -> should show "Definer").
--
-- Four are recursive — each has a raw subquery back into shop_users:
--   shop_users_insert_owner   (INSERT, with check)
--   shop_users_manager_update (UPDATE, using)
--   shop_users_owner_delete   (DELETE, using)
--   shop_users_update_owner   (UPDATE, using)
--
-- FIX: one new helper function, mirroring user_shop_ids()'s own pattern
-- (SECURITY DEFINER breaks the recursion the same way it already does for
-- user_shop_ids()), parameterized by role since these 4 policies need
-- owner-only or owner-or-manager, not "any active member".

-- ── Step 1: new helper function (safe, additive — does not touch any
--    existing policy on its own) ──────────────────────────────────────────
create or replace function public.user_shop_ids_by_role(roles text[])
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select shop_id
  from shop_users
  where user_id = auth.uid()
    and active = true
    and role = any(roles);
$$;

-- ── Step 2: rewrite the 4 recursive policies ─────────────────────────────
-- Each keeps its original logic exactly (same role sets, same extra
-- conditions) — only the recursive subquery is replaced.

-- shop_users_insert_owner
-- was: shop_id IN (SELECT su.shop_id FROM shop_users su
--        WHERE su.user_id = auth.uid() AND su.role = ANY(['owner','manager']) AND su.active = true)
alter policy "shop_users_insert_owner"
on "public"."shop_users"
to authenticated
with check (
  shop_id in (select user_shop_ids_by_role(array['owner','manager']))
);

-- shop_users_manager_update
-- was: shop_id IN (SELECT su.shop_id FROM shop_users su
--        WHERE su.user_id = auth.uid() AND su.active = true AND su.role = ANY(['owner','manager']))
alter policy "shop_users_manager_update"
on "public"."shop_users"
to authenticated
using (
  shop_id in (select user_shop_ids_by_role(array['owner','manager']))
);

-- shop_users_owner_delete
-- was: (user_id <> auth.uid()) AND (shop_id IN (SELECT su.shop_id FROM shop_users su
--        WHERE su.user_id = auth.uid() AND su.active = true AND su.role = ANY(['owner','manager'])))
alter policy "shop_users_owner_delete"
on "public"."shop_users"
to authenticated
using (
  (user_id <> auth.uid())
  and shop_id in (select user_shop_ids_by_role(array['owner','manager']))
);

-- shop_users_update_owner
-- was: shop_id IN (SELECT su.shop_id FROM shop_users su
--        WHERE su.user_id = auth.uid() AND su.role = 'owner' AND su.active = true)
alter policy "shop_users_update_owner"
on "public"."shop_users"
to authenticated
using (
  shop_id in (select user_shop_ids_by_role(array['owner']))
);

-- ── After running ─────────────────────────────────────────────────────────
-- 1. Confirm no syntax errors reported by the SQL editor.
-- 2. Ask Claude to re-test: sign up a fresh account, complete onboarding —
--    the POST to /rest/v1/shop_users should return 200/201, not 500.
-- 3. Then Claude will check your real shop's Team page situation as planned.
