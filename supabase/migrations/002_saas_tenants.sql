-- ============================================================
--  Alan Cafe OS — SaaS Multi-Tenant Foundation
--  Migration 002: shops, shop_users, shop_id columns, RLS
--
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--  Safe to run multiple times (uses IF NOT EXISTS / DO blocks)
-- ============================================================


-- ──────────────────────────────────────────────────────────────
--  1. SHOPS TABLE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shops (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  owner_email   TEXT,
  owner_phone   TEXT,
  logo_url      TEXT,
  cover_url     TEXT,
  address       TEXT,
  city          TEXT,
  country       TEXT        DEFAULT 'LA',
  timezone      TEXT        DEFAULT 'Asia/Vientiane',
  currency      TEXT        DEFAULT 'LAK',
  language      TEXT        DEFAULT 'th',
  plan          TEXT        DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  status        TEXT        DEFAULT 'active',
  trial_ends_at DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
--  2. SHOP_USERS TABLE (invite-based access control)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shop_users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID        REFERENCES shops(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('owner','manager','cashier','viewer')),
  full_name   TEXT,
  invited_at  TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  active      BOOLEAN     DEFAULT TRUE,
  UNIQUE(shop_id, email)
);

CREATE INDEX IF NOT EXISTS shop_users_shop_id_idx  ON shop_users(shop_id);
CREATE INDEX IF NOT EXISTS shop_users_user_id_idx  ON shop_users(user_id);
CREATE INDEX IF NOT EXISTS shop_users_email_idx    ON shop_users(email);


-- ──────────────────────────────────────────────────────────────
--  3. ADD shop_id TO EXISTING OPERATIONAL TABLES
-- ──────────────────────────────────────────────────────────────

ALTER TABLE recipes       ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);
ALTER TABLE inventory     ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);
ALTER TABLE orders        ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);
ALTER TABLE staff         ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);
ALTER TABLE cash_flow     ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);
ALTER TABLE budgets       ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);

-- Indexes for common shop_id lookups
CREATE INDEX IF NOT EXISTS recipes_shop_id_idx       ON recipes(shop_id);
CREATE INDEX IF NOT EXISTS inventory_shop_id_idx     ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS orders_shop_id_idx        ON orders(shop_id);
CREATE INDEX IF NOT EXISTS staff_shop_id_idx         ON staff(shop_id);
CREATE INDEX IF NOT EXISTS cash_flow_shop_id_idx     ON cash_flow(shop_id);


-- ──────────────────────────────────────────────────────────────
--  4. SEED: ALAN CAFE AS FIRST SHOP
-- ──────────────────────────────────────────────────────────────

INSERT INTO shops (slug, name, owner_email, owner_phone, address, city, country, timezone, currency, language, plan, status)
VALUES (
  'alan-cafe',
  'Alan Coffee & Travel',
  'admin@alancoffeetravel.com',
  NULL,
  'Attapeu, Laos',
  'Attapeu',
  'LA',
  'Asia/Vientiane',
  'LAK',
  'th',
  'free',
  'active'
)
ON CONFLICT (slug) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
--  5. BACKFILL: ASSIGN ALL EXISTING DATA TO ALAN CAFE
-- ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  alan_id UUID;
BEGIN
  SELECT id INTO alan_id FROM shops WHERE slug = 'alan-cafe';

  IF alan_id IS NOT NULL THEN
    UPDATE recipes       SET shop_id = alan_id WHERE shop_id IS NULL;
    UPDATE inventory     SET shop_id = alan_id WHERE shop_id IS NULL;
    UPDATE orders        SET shop_id = alan_id WHERE shop_id IS NULL;
    UPDATE staff         SET shop_id = alan_id WHERE shop_id IS NULL;
    UPDATE site_settings SET shop_id = alan_id WHERE shop_id IS NULL;
    UPDATE cash_flow     SET shop_id = alan_id WHERE shop_id IS NULL;
    UPDATE budgets       SET shop_id = alan_id WHERE shop_id IS NULL;
  END IF;
END;
$$;


-- ──────────────────────────────────────────────────────────────
--  6. RLS POLICIES — shops
-- ──────────────────────────────────────────────────────────────

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Anyone can read shop info (needed for public profile pages)
DROP POLICY IF EXISTS "shops_public_read" ON shops;
CREATE POLICY "shops_public_read" ON shops
  FOR SELECT USING (true);

-- Authenticated users can create a shop
DROP POLICY IF EXISTS "shops_insert_auth" ON shops;
CREATE POLICY "shops_insert_auth" ON shops
  FOR INSERT TO authenticated WITH CHECK (true);

-- Only shop owner/manager can update
DROP POLICY IF EXISTS "shops_update_member" ON shops;
CREATE POLICY "shops_update_member" ON shops
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT shop_id FROM shop_users
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager')
        AND active = true
    )
  );


-- ──────────────────────────────────────────────────────────────
--  7. RLS POLICIES — shop_users
-- ──────────────────────────────────────────────────────────────

ALTER TABLE shop_users ENABLE ROW LEVEL SECURITY;

-- Members can read their own shop's user list
DROP POLICY IF EXISTS "shop_users_read_members" ON shop_users;
CREATE POLICY "shop_users_read_members" ON shop_users
  FOR SELECT TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM shop_users su
      WHERE su.user_id = auth.uid() AND su.active = true
    )
  );

-- Owners/managers can invite new members
DROP POLICY IF EXISTS "shop_users_insert_owner" ON shop_users;
CREATE POLICY "shop_users_insert_owner" ON shop_users
  FOR INSERT TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM shop_users su
      WHERE su.user_id = auth.uid()
        AND su.role IN ('owner', 'manager')
        AND su.active = true
    )
  );

-- Allow first-time self-join (when creating account + shop simultaneously)
DROP POLICY IF EXISTS "shop_users_self_insert" ON shop_users;
CREATE POLICY "shop_users_self_insert" ON shop_users
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Owners can update member roles
DROP POLICY IF EXISTS "shop_users_update_owner" ON shop_users;
CREATE POLICY "shop_users_update_owner" ON shop_users
  FOR UPDATE TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM shop_users su
      WHERE su.user_id = auth.uid()
        AND su.role = 'owner'
        AND su.active = true
    )
  );


-- ──────────────────────────────────────────────────────────────
--  8. RLS POLICIES — operational tables (shop-scoped)
--
--  NOTE: These add authenticated access scoped to shop_id.
--        Existing anon policies (if any) are kept for backward
--        compatibility. Enable these when auth is fully wired.
-- ──────────────────────────────────────────────────────────────

-- Helper: is the authenticated user a member of the given shop?
CREATE OR REPLACE FUNCTION is_shop_member(sid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM shop_users
    WHERE shop_id = sid
      AND user_id = auth.uid()
      AND active = true
  );
$$;

-- recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipes_shop_member_all" ON recipes;
CREATE POLICY "recipes_shop_member_all" ON recipes
  FOR ALL TO authenticated
  USING (is_shop_member(shop_id))
  WITH CHECK (is_shop_member(shop_id));

-- Allow anon read (POS terminal works without login during transition)
DROP POLICY IF EXISTS "recipes_anon_read" ON recipes;
CREATE POLICY "recipes_anon_read" ON recipes
  FOR SELECT TO anon USING (true);

-- inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_shop_member_all" ON inventory;
CREATE POLICY "inventory_shop_member_all" ON inventory
  FOR ALL TO authenticated
  USING (is_shop_member(shop_id))
  WITH CHECK (is_shop_member(shop_id));

DROP POLICY IF EXISTS "inventory_anon_read" ON inventory;
CREATE POLICY "inventory_anon_read" ON inventory
  FOR SELECT TO anon USING (true);

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_shop_member_all" ON orders;
CREATE POLICY "orders_shop_member_all" ON orders
  FOR ALL TO authenticated
  USING (is_shop_member(shop_id))
  WITH CHECK (is_shop_member(shop_id));

DROP POLICY IF EXISTS "orders_anon_all" ON orders;
CREATE POLICY "orders_anon_all" ON orders
  FOR ALL TO anon USING (true);

-- staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_shop_member_all" ON staff;
CREATE POLICY "staff_shop_member_all" ON staff
  FOR ALL TO authenticated
  USING (is_shop_member(shop_id))
  WITH CHECK (is_shop_member(shop_id));

DROP POLICY IF EXISTS "staff_anon_read" ON staff;
CREATE POLICY "staff_anon_read" ON staff
  FOR SELECT TO anon USING (true);

-- cash_flow
ALTER TABLE cash_flow ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_flow_shop_member_all" ON cash_flow;
CREATE POLICY "cash_flow_shop_member_all" ON cash_flow
  FOR ALL TO authenticated
  USING (is_shop_member(shop_id))
  WITH CHECK (is_shop_member(shop_id));

DROP POLICY IF EXISTS "cash_flow_anon_read" ON cash_flow;
CREATE POLICY "cash_flow_anon_read" ON cash_flow
  FOR SELECT TO anon USING (true);


-- ──────────────────────────────────────────────────────────────
--  9. INQUIRIES TABLE (for AlanGuide — already may exist)
-- ──────────────────────────────────────────────────────────────

-- Ensure inquiries table is accessible to authenticated users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inquiries') THEN
    ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
  END IF;
END;
$$;


-- ──────────────────────────────────────────────────────────────
--  DONE
--  After running this migration:
--  1. Go to Supabase Dashboard → Authentication → Settings
--  2. Set Site URL to your production domain
--  3. Enable Email provider (usually on by default)
--  4. Optional: enable Google OAuth and add Client ID/Secret
-- ──────────────────────────────────────────────────────────────
