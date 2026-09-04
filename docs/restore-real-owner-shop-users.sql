-- Restore missing owner row for the real account.
--
-- Every value below is pinned to its column with an inline comment so
-- there is no risk of column/value drift — read down the two columns
-- and confirm each pair yourself before running.

insert into shop_users (
  shop_id,
  user_id,
  email,
  role,
  active,
  accepted_at,
  full_name
)
values (
  '9afdd9eb-728d-4e36-8077-492c92dbef30',  -- shop_id      (Alan Cafe / Alan Coffee & Travel, slug: alan-cafe)
  'e103ceaf-ced6-4bba-a54f-887f6e2c15e7',  -- user_id      (sulutxai@gmail.com)
  'sulutxai@gmail.com',                    -- email
  'owner',                                 -- role
  true,                                    -- active
  now(),                                   -- accepted_at
  null                                     -- full_name    (left blank, fill in later if you want)
);

-- ── After running ─────────────────────────────────────────────────────────
-- Reload /shop/team with the real account — it should load normally
-- instead of showing "ไม่พบร้านที่คุณเป็นเจ้าของ". Tell Claude once confirmed
-- and it will do the actual stray-account check on the real Team list
-- that this whole investigation was originally for.
