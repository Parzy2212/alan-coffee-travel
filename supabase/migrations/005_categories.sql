-- Alan Cafe OS v1.0 — Categories
-- Migration: 005_categories.sql

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  name_lo    TEXT,
  name_th    TEXT,
  parent_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Seed ─────────────────────────────────────────────────────────────────────

-- L1 parents
INSERT INTO categories (id, name, name_lo, name_th, parent_id, sort_order) VALUES
  ('ca000000-0000-0000-0000-000000000001', 'Coffee', 'ກາເຟ',     'กาแฟ',     NULL, 10),
  ('ca000000-0000-0000-0000-000000000002', 'Food',   'ອາຫານ',    'อาหาร',    NULL, 20);

-- L2 children of Coffee
INSERT INTO categories (id, name, name_lo, name_th, parent_id, sort_order) VALUES
  ('ca000000-0000-0000-0000-000000000003', 'Hot',    'ຮ້ອນ',     'ร้อน',     'ca000000-0000-0000-0000-000000000001', 11),
  ('ca000000-0000-0000-0000-000000000004', 'Iced',   'ເຢັນ',     'เย็น',     'ca000000-0000-0000-0000-000000000001', 12);

-- L2 children of Food
INSERT INTO categories (id, name, name_lo, name_th, parent_id, sort_order) VALUES
  ('ca000000-0000-0000-0000-000000000005', 'Bakery', 'ເຂົ້າໜົມ', 'เบเกอรี่', 'ca000000-0000-0000-0000-000000000002', 21);

-- ─── Add category_id to recipes (keep existing category TEXT column) ──────────

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Map existing coffee recipes → Coffee (parent)
UPDATE recipes
  SET category_id = 'ca000000-0000-0000-0000-000000000001'
  WHERE LOWER(category) = 'coffee';

-- Map existing food recipes → Bakery (child of Food, since all seed items are baked goods)
UPDATE recipes
  SET category_id = 'ca000000-0000-0000-0000-000000000005'
  WHERE LOWER(category) = 'food';

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_public_read"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);
