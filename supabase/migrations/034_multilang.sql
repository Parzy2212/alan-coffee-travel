-- 034_multilang.sql
-- Adds Thai product name to recipes + language/currency preferences to shops

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS product_name_th TEXT;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS default_pos_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS display_currencies    TEXT[] NOT NULL DEFAULT ARRAY['LAK'],
  ADD COLUMN IF NOT EXISTS exchange_rates        JSONB  NOT NULL DEFAULT '{"USD":21800,"THB":620,"VND":1,"CNY":3000}'::jsonb;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS nationality        TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT;

CREATE INDEX IF NOT EXISTS idx_recipes_product_name_th ON recipes (product_name_th) WHERE product_name_th IS NOT NULL;
