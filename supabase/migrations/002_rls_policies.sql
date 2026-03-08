-- Alan Cafe OS v1.0 — Row Level Security Policies
-- Migration: 002_rls_policies.sql
--
-- Role hierarchy:
--   owner   → full access on all tables
--   manager → SELECT all rows; INSERT/UPDATE on operational tables
--   staff   → SELECT/UPDATE own rows only (where staff_id = auth.uid())
--             SELECT-only on shared reference tables (inventory, recipes, etc.)
--   audit_logs → INSERT only for all roles; UPDATE and DELETE blocked for everyone

-- ============================================================
-- Helper: resolve role of currently authenticated staff member
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff WHERE id = auth.uid()
$$;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE staff              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_audit        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STAFF
-- ============================================================
CREATE POLICY "owner: all on staff" ON staff
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select all staff" ON staff
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- manager can UPDATE (e.g. toggle is_active, update photo) but not INSERT/DELETE
CREATE POLICY "manager: update staff" ON staff
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

-- staff: SELECT and UPDATE their own row only
CREATE POLICY "staff: select own row" ON staff
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND id = auth.uid());

CREATE POLICY "staff: update own row" ON staff
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'staff' AND id = auth.uid())
  WITH CHECK(get_my_role() = 'staff' AND id = auth.uid());

-- ============================================================
-- INVENTORY  (reference data — staff read-only)
-- ============================================================
CREATE POLICY "owner: all on inventory" ON inventory
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: all on inventory" ON inventory
  FOR ALL TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

CREATE POLICY "staff: select inventory" ON inventory
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');

-- ============================================================
-- RECIPES  (reference data — staff read-only)
-- ============================================================
CREATE POLICY "owner: all on recipes" ON recipes
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: all on recipes" ON recipes
  FOR ALL TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

CREATE POLICY "staff: select recipes" ON recipes
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');

-- ============================================================
-- RECIPE_INGREDIENTS  (reference data — staff read-only)
-- ============================================================
CREATE POLICY "owner: all on recipe_ingredients" ON recipe_ingredients
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: all on recipe_ingredients" ON recipe_ingredients
  FOR ALL TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

CREATE POLICY "staff: select recipe_ingredients" ON recipe_ingredients
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE POLICY "owner: all on customers" ON customers
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: all on customers" ON customers
  FOR ALL TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

-- staff: SELECT and INSERT (create customer during order); no UPDATE/DELETE
CREATE POLICY "staff: select customers" ON customers
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');

CREATE POLICY "staff: insert customers" ON customers
  FOR INSERT TO authenticated
  WITH CHECK(get_my_role() = 'staff');

-- ============================================================
-- ORDERS
-- ============================================================
CREATE POLICY "owner: all on orders" ON orders
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select all orders" ON orders
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- manager can void orders (UPDATE status, void_reason, voided_by)
CREATE POLICY "manager: update orders" ON orders
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

-- staff: see and edit only orders they created
CREATE POLICY "staff: select own orders" ON orders
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY "staff: insert orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK(get_my_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY "staff: update own orders" ON orders
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'staff' AND staff_id = auth.uid())
  WITH CHECK(get_my_role() = 'staff' AND staff_id = auth.uid());

-- ============================================================
-- ORDER_ITEMS  (scoped via parent order's staff_id)
-- ============================================================
CREATE POLICY "owner: all on order_items" ON order_items
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select all order_items" ON order_items
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- staff: items belonging to their own orders
CREATE POLICY "staff: select own order_items" ON order_items
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'staff' AND
    order_id IN (SELECT id FROM orders WHERE staff_id = auth.uid())
  );

CREATE POLICY "staff: insert own order_items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK(
    get_my_role() = 'staff' AND
    order_id IN (SELECT id FROM orders WHERE staff_id = auth.uid())
  );

-- ============================================================
-- PURCHASE_LOGS
-- ============================================================
CREATE POLICY "owner: all on purchase_logs" ON purchase_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select all purchase_logs" ON purchase_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- manager can approve/flag purchases (UPDATE status, approved_by, flag_reason)
CREATE POLICY "manager: update purchase_logs" ON purchase_logs
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

-- staff: see and INSERT their own purchase logs
CREATE POLICY "staff: select own purchase_logs" ON purchase_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY "staff: insert purchase_logs" ON purchase_logs
  FOR INSERT TO authenticated
  WITH CHECK(get_my_role() = 'staff' AND staff_id = auth.uid());

-- ============================================================
-- STOCK_AUDIT
-- ============================================================
CREATE POLICY "owner: all on stock_audit" ON stock_audit
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select all stock_audit" ON stock_audit
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- staff: see and INSERT their own audit entries
CREATE POLICY "staff: select own stock_audit" ON stock_audit
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY "staff: insert stock_audit" ON stock_audit
  FOR INSERT TO authenticated
  WITH CHECK(get_my_role() = 'staff' AND staff_id = auth.uid());

-- ============================================================
-- AUDIT_LOGS  — INSERT only; UPDATE and DELETE blocked for ALL roles
-- ============================================================
CREATE POLICY "all roles: insert audit_logs" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK(auth.uid() IS NOT NULL);

-- No SELECT policy for staff (managers/owners can query via Supabase dashboard
-- or a dedicated service role — add SELECT policies below if needed)
CREATE POLICY "owner: select audit_logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'owner');

CREATE POLICY "manager: select audit_logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- UPDATE and DELETE are intentionally absent → blocked by RLS for all roles

-- ============================================================
-- ANOMALY_ALERTS
-- ============================================================
CREATE POLICY "owner: all on anomaly_alerts" ON anomaly_alerts
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select anomaly_alerts" ON anomaly_alerts
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- manager can resolve alerts (UPDATE is_resolved, resolved_by)
CREATE POLICY "manager: update anomaly_alerts" ON anomaly_alerts
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

-- system / triggers insert alerts; staff have no direct access

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE POLICY "owner: all on attendance" ON attendance
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select all attendance" ON attendance
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- staff: see and INSERT their own clock-in/out records
CREATE POLICY "staff: select own attendance" ON attendance
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY "staff: insert attendance" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK(get_my_role() = 'staff' AND staff_id = auth.uid());

-- ============================================================
-- LEAVE_REQUESTS
-- ============================================================
CREATE POLICY "owner: all on leave_requests" ON leave_requests
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select all leave_requests" ON leave_requests
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- manager can approve/reject (UPDATE status)
CREATE POLICY "manager: update leave_requests" ON leave_requests
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

-- staff: see and INSERT their own leave requests; can UPDATE if still pending
CREATE POLICY "staff: select own leave_requests" ON leave_requests
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY "staff: insert leave_requests" ON leave_requests
  FOR INSERT TO authenticated
  WITH CHECK(get_my_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY "staff: update own pending leave_requests" ON leave_requests
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'staff' AND staff_id = auth.uid() AND status = 'pending')
  WITH CHECK(get_my_role() = 'staff' AND staff_id = auth.uid());

-- ============================================================
-- BUDGETS  (financial — staff read-only)
-- ============================================================
CREATE POLICY "owner: all on budgets" ON budgets
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select budgets" ON budgets
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- manager can update spent_lak as purchases are logged
CREATE POLICY "manager: update budgets" ON budgets
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

CREATE POLICY "staff: select budgets" ON budgets
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');

-- ============================================================
-- CASHFLOW_LOGS
-- ============================================================
CREATE POLICY "owner: all on cashflow_logs" ON cashflow_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: select all cashflow_logs" ON cashflow_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

-- staff: INSERT their shift cash reconciliation; SELECT their own entries
CREATE POLICY "staff: select own cashflow_logs" ON cashflow_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND staff_id = auth.uid());

CREATE POLICY "staff: insert cashflow_logs" ON cashflow_logs
  FOR INSERT TO authenticated
  WITH CHECK(get_my_role() = 'staff' AND staff_id = auth.uid());

-- ============================================================
-- MARKETING_CAMPAIGNS  (admin-only; staff read-only)
-- ============================================================
CREATE POLICY "owner: all on marketing_campaigns" ON marketing_campaigns
  FOR ALL TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY "manager: all on marketing_campaigns" ON marketing_campaigns
  FOR ALL TO authenticated
  USING     (get_my_role() = 'manager')
  WITH CHECK(get_my_role() = 'manager');

CREATE POLICY "staff: select marketing_campaigns" ON marketing_campaigns
  FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
