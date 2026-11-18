-- Read-only: the 5 "check on the real database" items of the 2026-11-17 audit. ONE query, one row.
-- Changes nothing. Counts and true/false only, no customer or staff data.
SELECT
  (SELECT prosrc ~ 'current_stock' FROM pg_proc WHERE proname = 'approve_purchase' LIMIT 1)   AS approve_purchase_uses_missing_column,
  (SELECT prosrc ~ 'current_stock' FROM pg_proc WHERE proname = 'start_stock_audit' LIMIT 1)  AS stock_audit_uses_missing_column,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'current_stock') AS inventory_has_current_stock,
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND 'anon' = ANY(roles))  AS leave_anon_can_write,
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND 'anon' = ANY(roles))       AS customers_anon_policy,
  (SELECT count(*) FROM public.staff WHERE id IN (SELECT user_id FROM public.shop_users))          AS staff_rows_matching_a_login,
  (SELECT count(*) FROM public.loyalty_transactions WHERE type = 'redeem')                         AS redeem_records,
  (SELECT count(*) FROM public.cashflow_logs)                                                      AS old_cashflow_logs_rows,
  (SELECT count(*) FROM public.audit_logs WHERE table_name IN ('destinations', 'guides', 'guide_destinations', 'site_settings')) AS admin_audit_rows;
