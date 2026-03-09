-- Alan Cafe OS — CRM, Purchase, Finance, Stock Audit
-- Migration: 024_crm_purchase.sql

-- ─── 1. customers ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT,
  nationality         TEXT,
  language_pref       TEXT DEFAULT 'lo',
  phone               TEXT UNIQUE,
  email               TEXT,
  allergies           TEXT[] DEFAULT '{}',
  loyalty_points      INTEGER DEFAULT 0,
  visit_count         INTEGER DEFAULT 0,
  lifetime_spend_lak  NUMERIC DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS name               TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nationality        TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS language_pref      TEXT DEFAULT 'lo';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone              TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email              TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS allergies          TEXT[] DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points     INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS visit_count        INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_spend_lak NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT now();

-- ─── 2. purchase_logs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id     UUID,
  staff_id         UUID,
  qty_purchased    NUMERIC NOT NULL DEFAULT 0,
  unit_price_lak   NUMERIC NOT NULL DEFAULT 0,
  market_price_lak NUMERIC,
  receipt_url      TEXT,
  weigh_image_url  TEXT,
  supplier         TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  flag_reason      TEXT,
  approved_by      UUID,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS inventory_id     UUID;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS staff_id         UUID;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS qty_purchased    NUMERIC;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS unit_price_lak   NUMERIC;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS market_price_lak NUMERIC;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS receipt_url      TEXT;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS weigh_image_url  TEXT;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS supplier         TEXT;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'pending';
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS flag_reason      TEXT;
ALTER TABLE purchase_logs ADD COLUMN IF NOT EXISTS approved_by      UUID;

-- ─── 3. cashflow_logs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cashflow_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  shift         TEXT NOT NULL DEFAULT 'morning',
  opening_cash  NUMERIC DEFAULT 0,
  system_sales  NUMERIC DEFAULT 0,
  actual_cash   NUMERIC DEFAULT 0,
  variance_lak  NUMERIC DEFAULT 0,
  staff_id      UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cashflow_logs ADD COLUMN IF NOT EXISTS log_date     DATE DEFAULT CURRENT_DATE;
ALTER TABLE cashflow_logs ADD COLUMN IF NOT EXISTS shift        TEXT DEFAULT 'morning';
ALTER TABLE cashflow_logs ADD COLUMN IF NOT EXISTS opening_cash NUMERIC DEFAULT 0;
ALTER TABLE cashflow_logs ADD COLUMN IF NOT EXISTS system_sales NUMERIC DEFAULT 0;
ALTER TABLE cashflow_logs ADD COLUMN IF NOT EXISTS actual_cash  NUMERIC DEFAULT 0;
ALTER TABLE cashflow_logs ADD COLUMN IF NOT EXISTS variance_lak NUMERIC DEFAULT 0;
ALTER TABLE cashflow_logs ADD COLUMN IF NOT EXISTS staff_id     UUID;

-- ─── 4. stock_audit ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID,
  staff_id     UUID,
  counted_qty  NUMERIC,
  system_qty   NUMERIC,
  variance     NUMERIC,
  audit_date   DATE DEFAULT CURRENT_DATE,
  shift        TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stock_audit ADD COLUMN IF NOT EXISTS inventory_id UUID;
ALTER TABLE stock_audit ADD COLUMN IF NOT EXISTS staff_id     UUID;
ALTER TABLE stock_audit ADD COLUMN IF NOT EXISTS counted_qty  NUMERIC;
ALTER TABLE stock_audit ADD COLUMN IF NOT EXISTS system_qty   NUMERIC;
ALTER TABLE stock_audit ADD COLUMN IF NOT EXISTS variance     NUMERIC;
ALTER TABLE stock_audit ADD COLUMN IF NOT EXISTS audit_date   DATE DEFAULT CURRENT_DATE;
ALTER TABLE stock_audit ADD COLUMN IF NOT EXISTS shift        TEXT;
ALTER TABLE stock_audit ADD COLUMN IF NOT EXISTS notes        TEXT;

-- ─── 5. RPCs ──────────────────────────────────────────────────────────────────

-- get_customers
CREATE OR REPLACE FUNCTION get_customers(p_search TEXT DEFAULT '')
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.visit_count DESC), '[]')
  FROM customers c
  WHERE p_search = ''
     OR c.phone ILIKE '%' || p_search || '%'
     OR c.name  ILIKE '%' || p_search || '%';
$$;

-- upsert_customer
CREATE OR REPLACE FUNCTION upsert_customer(
  p_phone        TEXT,
  p_name         TEXT,
  p_nationality  TEXT    DEFAULT NULL,
  p_language_pref TEXT   DEFAULT 'lo',
  p_allergies    TEXT[]  DEFAULT '{}'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row customers;
BEGIN
  INSERT INTO customers (phone, name, nationality, language_pref, allergies)
  VALUES (p_phone, p_name, p_nationality, p_language_pref, p_allergies)
  ON CONFLICT (phone) DO UPDATE SET
    name          = EXCLUDED.name,
    nationality   = EXCLUDED.nationality,
    language_pref = EXCLUDED.language_pref,
    allergies     = EXCLUDED.allergies,
    updated_at    = now()
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row);
END;
$$;

-- add_loyalty_points: 1 point per 10,000 LAK
CREATE OR REPLACE FUNCTION add_loyalty_points(p_customer_id UUID, p_order_total NUMERIC)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_points INTEGER := floor(p_order_total / 10000)::INTEGER;
BEGIN
  UPDATE customers SET
    loyalty_points     = loyalty_points + v_points,
    visit_count        = visit_count + 1,
    lifetime_spend_lak = lifetime_spend_lak + p_order_total,
    updated_at         = now()
  WHERE id = p_customer_id;
  RETURN v_points;
END;
$$;

-- submit_purchase_request: auto-flag if price >15% above cost_per_unit
CREATE OR REPLACE FUNCTION submit_purchase_request(
  p_inventory_id    UUID,
  p_staff_id        UUID,
  p_qty             NUMERIC,
  p_unit_price      NUMERIC,
  p_supplier        TEXT    DEFAULT NULL,
  p_receipt_url     TEXT    DEFAULT NULL,
  p_weigh_image_url TEXT    DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_market   NUMERIC;
  v_flag     TEXT;
  v_row      purchase_logs;
BEGIN
  SELECT cost_per_unit INTO v_market FROM inventory WHERE id = p_inventory_id;

  IF v_market IS NOT NULL AND v_market > 0 AND p_unit_price > v_market * 1.15 THEN
    v_flag := 'ราคาสูงกว่าราคาตลาด ' || round(((p_unit_price / v_market) - 1) * 100) || '%';
  END IF;

  INSERT INTO purchase_logs
    (inventory_id, staff_id, qty_purchased, unit_price_lak, market_price_lak,
     supplier, receipt_url, weigh_image_url, flag_reason, status)
  VALUES
    (p_inventory_id, p_staff_id, p_qty, p_unit_price, v_market,
     p_supplier, p_receipt_url, p_weigh_image_url, v_flag,
     CASE WHEN v_flag IS NOT NULL THEN 'flagged' ELSE 'pending' END)
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;

-- get_pending_purchases
CREATE OR REPLACE FUNCTION get_pending_purchases()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',               pl.id,
      'inventory_id',     pl.inventory_id,
      'inventory_name',   i.name,
      'unit',             i.unit,
      'staff_id',         pl.staff_id,
      'staff_name',       s.name,
      'qty_purchased',    pl.qty_purchased,
      'unit_price_lak',   pl.unit_price_lak,
      'market_price_lak', pl.market_price_lak,
      'supplier',         pl.supplier,
      'status',           pl.status,
      'flag_reason',      pl.flag_reason,
      'receipt_url',      pl.receipt_url,
      'weigh_image_url',  pl.weigh_image_url,
      'created_at',       pl.created_at
    ) ORDER BY pl.created_at DESC
  ), '[]')
  FROM purchase_logs pl
  LEFT JOIN inventory i ON pl.inventory_id = i.id
  LEFT JOIN staff     s ON pl.staff_id     = s.id
  WHERE pl.status IN ('pending', 'flagged');
$$;

-- get_all_purchases
CREATE OR REPLACE FUNCTION get_all_purchases(p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',               pl.id,
      'inventory_name',   i.name,
      'unit',             i.unit,
      'staff_name',       s.name,
      'qty_purchased',    pl.qty_purchased,
      'unit_price_lak',   pl.unit_price_lak,
      'market_price_lak', pl.market_price_lak,
      'supplier',         pl.supplier,
      'status',           pl.status,
      'flag_reason',      pl.flag_reason,
      'created_at',       pl.created_at
    ) ORDER BY pl.created_at DESC
  ), '[]')
  FROM (SELECT * FROM purchase_logs ORDER BY created_at DESC LIMIT p_limit) pl
  LEFT JOIN inventory i ON pl.inventory_id = i.id
  LEFT JOIN staff     s ON pl.staff_id     = s.id;
$$;

-- approve_purchase: update status + restock inventory
CREATE OR REPLACE FUNCTION approve_purchase(p_purchase_id UUID, p_approve BOOLEAN DEFAULT TRUE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pl purchase_logs;
BEGIN
  SELECT * INTO v_pl FROM purchase_logs WHERE id = p_purchase_id;
  UPDATE purchase_logs
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE id = p_purchase_id;
  IF p_approve THEN
    UPDATE inventory
    SET current_stock = current_stock + v_pl.qty_purchased
    WHERE id = v_pl.inventory_id;
  END IF;
END;
$$;

-- start_stock_audit: pick 3 random inventory items, insert audit rows
CREATE OR REPLACE FUNCTION start_stock_audit(p_staff_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_results JSONB := '[]';
  v_item    RECORD;
  v_audit_id UUID;
BEGIN
  FOR v_item IN
    SELECT id, name, unit, current_stock FROM inventory ORDER BY RANDOM() LIMIT 3
  LOOP
    INSERT INTO stock_audit (inventory_id, staff_id, system_qty, audit_date)
    VALUES (v_item.id, p_staff_id, v_item.current_stock, CURRENT_DATE)
    RETURNING id INTO v_audit_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'audit_id',       v_audit_id,
      'inventory_id',   v_item.id,
      'inventory_name', v_item.name,
      'unit',           v_item.unit
    ));
  END LOOP;
  RETURN v_results;
END;
$$;

-- submit_stock_audit: record counted qty, compute variance
CREATE OR REPLACE FUNCTION submit_stock_audit(p_audit_id UUID, p_counted_qty NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row stock_audit;
BEGIN
  UPDATE stock_audit
  SET counted_qty = p_counted_qty,
      variance    = p_counted_qty - system_qty
  WHERE id = p_audit_id
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row);
END;
$$;

-- close_shift
CREATE OR REPLACE FUNCTION close_shift(
  p_staff_id    UUID,
  p_shift       TEXT,
  p_opening_cash NUMERIC,
  p_actual_cash  NUMERIC,
  p_system_sales NUMERIC DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_variance NUMERIC;
  v_row      cashflow_logs;
BEGIN
  v_variance := p_actual_cash - (p_opening_cash + p_system_sales);
  INSERT INTO cashflow_logs (log_date, shift, opening_cash, system_sales, actual_cash, variance_lak, staff_id)
  VALUES (CURRENT_DATE, p_shift, p_opening_cash, p_system_sales, p_actual_cash, v_variance, p_staff_id)
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row);
END;
$$;

-- get_cashflow_summary
CREATE OR REPLACE FUNCTION get_cashflow_summary(p_days INTEGER DEFAULT 7)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'log_date',     log_date,
      'shift',        shift,
      'system_sales', system_sales,
      'actual_cash',  actual_cash,
      'variance_lak', variance_lak
    ) ORDER BY log_date DESC, shift
  ), '[]')
  FROM cashflow_logs
  WHERE log_date >= CURRENT_DATE - p_days;
$$;

-- ─── 6. GRANT ─────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON TABLE customers     TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE purchase_logs TO anon;
GRANT SELECT, INSERT         ON TABLE cashflow_logs TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE stock_audit   TO anon;

GRANT EXECUTE ON FUNCTION get_customers(TEXT)                                                         TO anon;
GRANT EXECUTE ON FUNCTION upsert_customer(TEXT, TEXT, TEXT, TEXT, TEXT[])                             TO anon;
GRANT EXECUTE ON FUNCTION add_loyalty_points(UUID, NUMERIC)                                           TO anon;
GRANT EXECUTE ON FUNCTION submit_purchase_request(UUID, UUID, NUMERIC, NUMERIC, TEXT, TEXT, TEXT)     TO anon;
GRANT EXECUTE ON FUNCTION get_pending_purchases()                                                     TO anon;
GRANT EXECUTE ON FUNCTION get_all_purchases(INTEGER)                                                  TO anon;
GRANT EXECUTE ON FUNCTION approve_purchase(UUID, BOOLEAN)                                             TO anon;
GRANT EXECUTE ON FUNCTION start_stock_audit(UUID)                                                     TO anon;
GRANT EXECUTE ON FUNCTION submit_stock_audit(UUID, NUMERIC)                                           TO anon;
GRANT EXECUTE ON FUNCTION close_shift(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC)                          TO anon;
GRANT EXECUTE ON FUNCTION get_cashflow_summary(INTEGER)                                               TO anon;
