-- 032_crm_loyalty.sql
-- Customer CRM Phase A: loyalty points, VIP tiers, loyalty_transactions, loyalty_settings

-- ─── 1. Extend customers table ────────────────────────────────────────────────

ALTER TABLE customers ADD COLUMN IF NOT EXISTS shop_id    UUID REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday   DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes      TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vip_tier   TEXT DEFAULT 'regular'
  CHECK (vip_tier IN ('regular','silver','gold','platinum'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags       TEXT[] DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ;

-- Per-shop phone uniqueness (only when shop_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_phone_idx
  ON customers(shop_id, phone)
  WHERE shop_id IS NOT NULL AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_shop_idx     ON customers(shop_id);
CREATE INDEX IF NOT EXISTS customers_vip_idx      ON customers(vip_tier);
CREATE INDEX IF NOT EXISTS customers_birthday_idx ON customers(birthday) WHERE birthday IS NOT NULL;

-- ─── 2. loyalty_transactions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('earn','redeem','adjust','expire')),
  points      INTEGER NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loyalty_tx_customer_idx ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS loyalty_tx_shop_idx     ON loyalty_transactions(shop_id);
CREATE INDEX IF NOT EXISTS loyalty_tx_order_idx    ON loyalty_transactions(order_id);

-- ─── 3. loyalty_settings ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_settings (
  shop_id                   UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  enabled                   BOOLEAN DEFAULT true,
  points_per_lak            DECIMAL(10,4) DEFAULT 0.0001,
  vip_silver_threshold      INTEGER DEFAULT 500,
  vip_gold_threshold        INTEGER DEFAULT 2000,
  vip_platinum_threshold    INTEGER DEFAULT 5000,
  silver_discount_percent   INTEGER DEFAULT 0,
  gold_discount_percent     INTEGER DEFAULT 5,
  platinum_discount_percent INTEGER DEFAULT 10,
  birthday_discount_percent INTEGER DEFAULT 20,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults for alan-cafe
INSERT INTO loyalty_settings (shop_id)
SELECT id FROM shops WHERE slug = 'alan-cafe'
ON CONFLICT (shop_id) DO NOTHING;

-- ─── 4. Auto-award trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_settings loyalty_settings%ROWTYPE;
  v_points   INTEGER;
  v_new_pts  INTEGER;
  v_new_tier TEXT;
BEGIN
  -- Only fire when status transitions to 'paid' and customer is linked
  IF NEW.status = 'paid'
     AND (OLD.status IS NULL OR OLD.status <> 'paid')
     AND NEW.customer_id IS NOT NULL
     AND NEW.shop_id IS NOT NULL
  THEN
    SELECT * INTO v_settings FROM loyalty_settings WHERE shop_id = NEW.shop_id;

    IF FOUND AND v_settings.enabled THEN
      v_points := GREATEST(0, FLOOR(
        COALESCE(NEW.total_lak, 0) * COALESCE(v_settings.points_per_lak, 0.0001)
      )::INTEGER);

      IF v_points > 0 THEN
        UPDATE customers
        SET loyalty_points     = COALESCE(loyalty_points, 0) + v_points,
            lifetime_spend_lak = COALESCE(lifetime_spend_lak, 0) + COALESCE(NEW.total_lak, 0),
            visit_count        = COALESCE(visit_count, 0) + 1,
            last_visit         = NOW(),
            updated_at         = NOW()
        WHERE id = NEW.customer_id
        RETURNING loyalty_points INTO v_new_pts;

        INSERT INTO loyalty_transactions
          (shop_id, customer_id, order_id, type, points, description)
        VALUES
          (NEW.shop_id, NEW.customer_id, NEW.id, 'earn', v_points,
           'Earned from order #' || COALESCE(NEW.queue_number::TEXT, '?'));

        -- Auto-upgrade VIP tier
        v_new_tier := CASE
          WHEN v_new_pts >= COALESCE(v_settings.vip_platinum_threshold, 5000) THEN 'platinum'
          WHEN v_new_pts >= COALESCE(v_settings.vip_gold_threshold, 2000)     THEN 'gold'
          WHEN v_new_pts >= COALESCE(v_settings.vip_silver_threshold, 500)    THEN 'silver'
          ELSE 'regular'
        END;

        UPDATE customers SET vip_tier = v_new_tier WHERE id = NEW.customer_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_loyalty ON orders;
CREATE TRIGGER trg_award_loyalty
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION award_loyalty_points();

-- ─── 5. Updated RPCs ──────────────────────────────────────────────────────────

-- Enhanced get_customers with tier + birthday flag
CREATE OR REPLACE FUNCTION get_customers(p_search TEXT DEFAULT '')
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.visit_count DESC), '[]')
  FROM customers c
  WHERE p_search = ''
     OR c.phone ILIKE '%' || p_search || '%'
     OR c.name  ILIKE '%' || p_search || '%';
$$;

-- Full upsert with CRM fields
CREATE OR REPLACE FUNCTION crm_upsert_customer(
  p_phone       TEXT,
  p_name        TEXT,
  p_email       TEXT    DEFAULT NULL,
  p_birthday    DATE    DEFAULT NULL,
  p_notes       TEXT    DEFAULT NULL,
  p_tags        TEXT[]  DEFAULT '{}',
  p_nationality TEXT    DEFAULT NULL,
  p_shop_id     UUID    DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row customers;
BEGIN
  INSERT INTO customers (phone, name, email, birthday, notes, tags, nationality, shop_id)
  VALUES (p_phone, p_name, p_email, p_birthday, p_notes, p_tags, p_nationality, p_shop_id)
  ON CONFLICT (phone) DO UPDATE SET
    name        = EXCLUDED.name,
    email       = COALESCE(EXCLUDED.email, customers.email),
    birthday    = COALESCE(EXCLUDED.birthday, customers.birthday),
    notes       = COALESCE(EXCLUDED.notes, customers.notes),
    tags        = COALESCE(EXCLUDED.tags, customers.tags),
    nationality = COALESCE(EXCLUDED.nationality, customers.nationality),
    updated_at  = NOW()
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row);
END;
$$;

-- ─── 6. Grants ────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON TABLE loyalty_transactions TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE loyalty_settings      TO anon;
GRANT EXECUTE ON FUNCTION crm_upsert_customer(TEXT,TEXT,TEXT,DATE,TEXT,TEXT[],TEXT,UUID) TO anon;
GRANT EXECUTE ON FUNCTION award_loyalty_points() TO anon;
