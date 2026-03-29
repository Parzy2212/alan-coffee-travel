-- ─── Recipe Cost Calculator Tables + Inventory Delete ─────────────────────────
-- RecipeCostTab uses these three tables (separate from recipe_ingredients which
-- links recipes to inventory for POS stock deduction).
-- Also adds delete_inventory_item() RPC.
-- migration 027

-- ─── 1. Cost Calculator Tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cost_ingredients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'g',
  package_size NUMERIC NOT NULL DEFAULT 1,
  package_cost NUMERIC NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_base_recipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'ml',
  total_yield NUMERIC NOT NULL DEFAULT 1,
  ingredients JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_formulas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name   TEXT NOT NULL,
  price_lak     NUMERIC NOT NULL DEFAULT 0,
  target_margin NUMERIC NOT NULL DEFAULT 60,
  components    JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cost_ingredients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_base_recipes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_formulas      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_cost_ingredients"
  ON cost_ingredients FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_cost_base_recipes"
  ON cost_base_recipes FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_cost_formulas"
  ON cost_formulas FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON cost_ingredients  TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_base_recipes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_formulas     TO anon;

-- ─── 2. delete_inventory_item RPC ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_inventory_item(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM inventory WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_inventory_item(UUID) TO anon;
