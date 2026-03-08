-- Alan Cafe OS v1.0 — Initial Schema
-- Migration: 001_cafe_os_schema.sql

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT UNIQUE,
  photo_url TEXT,
  pin_hash TEXT,
  hourly_rate_lak NUMERIC(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  performance_score NUMERIC(5,2) DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_lo TEXT,
  name_th TEXT,
  unit TEXT NOT NULL,
  current_qty NUMERIC(10,3) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(10,3),
  cost_per_unit NUMERIC(10,2),
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  product_name_lo TEXT,
  product_name_th TEXT,
  price_lak NUMERIC(10,2) NOT NULL,
  price_thb NUMERIC(10,2),
  price_usd NUMERIC(10,2),
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id),
  qty_required NUMERIC(10,4) NOT NULL,
  unit TEXT NOT NULL
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  nationality TEXT,
  language_pref TEXT DEFAULT 'en',
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  allergies TEXT[],
  loyalty_points INTEGER DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  lifetime_spend_lak NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  staff_id UUID REFERENCES staff(id) NOT NULL,
  status TEXT DEFAULT 'open',
  subtotal_lak NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_lak NUMERIC(10,2) DEFAULT 0,
  discount_reason TEXT,
  total_lak NUMERIC(10,2),
  payment_method TEXT,
  payment_currency TEXT DEFAULT 'LAK',
  void_reason TEXT,
  voided_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  recipe_id UUID REFERENCES recipes(id),
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price_lak NUMERIC(10,2) NOT NULL,
  line_total_lak NUMERIC(10,2) GENERATED ALWAYS AS (qty * unit_price_lak) STORED,
  customization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id),
  staff_id UUID REFERENCES staff(id),
  qty_purchased NUMERIC(10,3) NOT NULL,
  unit_price_lak NUMERIC(10,2) NOT NULL,
  total_lak NUMERIC(10,2) GENERATED ALWAYS AS (qty_purchased * unit_price_lak) STORED,
  market_price_lak NUMERIC(10,2),
  receipt_url TEXT NOT NULL,
  weigh_image_url TEXT,
  supplier TEXT,
  status TEXT DEFAULT 'pending',
  flag_reason TEXT,
  approved_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id),
  staff_id UUID REFERENCES staff(id),
  counted_qty NUMERIC(10,3) NOT NULL,
  system_qty NUMERIC(10,3) NOT NULL,
  variance NUMERIC(10,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  variance_pct NUMERIC(6,2),
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  action TEXT NOT NULL,
  table_name TEXT,
  row_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT,
  description TEXT,
  related_id UUID,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  action TEXT NOT NULL,
  gps_lat NUMERIC(9,6),
  gps_lng NUMERIC(9,6),
  photo_url TEXT NOT NULL,
  is_late BOOLEAN DEFAULT FALSE,
  late_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  leave_date DATE NOT NULL,
  leave_type TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  coverage_staff_id UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  category TEXT NOT NULL,
  budget_lak NUMERIC(12,2) NOT NULL,
  spent_lak NUMERIC(12,2) DEFAULT 0,
  remaining_lak NUMERIC(12,2) GENERATED ALWAYS AS (budget_lak - spent_lak) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cashflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT,
  opening_cash NUMERIC(10,2),
  system_sales NUMERIC(10,2),
  actual_cash NUMERIC(10,2),
  variance_lak NUMERIC(10,2) GENERATED ALWAYS AS (actual_cash - (opening_cash + system_sales)) STORED,
  staff_id UUID REFERENCES staff(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT,
  target_language TEXT,
  target_nationality TEXT,
  budget_lak NUMERIC(10,2),
  revenue_attributed NUMERIC(12,2) DEFAULT 0,
  roi_pct NUMERIC(6,2),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
