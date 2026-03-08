-- Alan Cafe OS — Categories Detail
-- Migration: 016_categories_detail.sql

-- ─── 1. New columns on categories ────────────────────────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS icon           TEXT,
  ADD COLUMN IF NOT EXISTS color          TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_th TEXT,
  ADD COLUMN IF NOT EXISTS description_lo TEXT;

-- ─── 2. get_categories_tree() — tree + menu count ────────────────────────────

DROP FUNCTION IF EXISTS get_categories_tree();

CREATE OR REPLACE FUNCTION get_categories_tree()
RETURNS TABLE (
  id             UUID,
  name           TEXT,
  name_th        TEXT,
  name_lo        TEXT,
  description_en TEXT,
  description_th TEXT,
  description_lo TEXT,
  icon           TEXT,
  color          TEXT,
  parent_id      UUID,
  sort_order     INTEGER,
  is_active      BOOLEAN,
  menu_count     BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      c.id,
      c.name,
      c.name_th,
      c.name_lo,
      c.description_en,
      c.description_th,
      c.description_lo,
      c.icon,
      c.color,
      c.parent_id,
      COALESCE(c.sort_order, 0) AS sort_order,
      c.is_active,
      COUNT(r.id)::BIGINT        AS menu_count
    FROM categories c
    LEFT JOIN recipes r ON r.category_id = c.id
    GROUP BY c.id, c.name, c.name_th, c.name_lo,
             c.description_en, c.description_th, c.description_lo,
             c.icon, c.color, c.parent_id, c.sort_order, c.is_active
    ORDER BY COALESCE(c.sort_order, 0), c.name;
END;
$$;

-- ─── 3. create_category(…) ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS create_category(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION create_category(
  p_name       TEXT,
  p_name_th    TEXT    DEFAULT NULL,
  p_name_lo    TEXT    DEFAULT NULL,
  p_icon       TEXT    DEFAULT NULL,
  p_color      TEXT    DEFAULT NULL,
  p_parent_id  TEXT    DEFAULT NULL,
  p_sort_order INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO categories (name, name_th, name_lo, icon, color, parent_id, sort_order, is_active)
  VALUES (
    p_name,
    NULLIF(p_name_th, ''),
    NULLIF(p_name_lo, ''),
    NULLIF(p_icon,    ''),
    NULLIF(p_color,   ''),
    NULLIF(p_parent_id, '')::UUID,
    COALESCE(p_sort_order, 0),
    TRUE
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─── 4. update_category(…) ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS update_category(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION update_category(
  p_id         UUID,
  p_name       TEXT    DEFAULT NULL,
  p_name_th    TEXT    DEFAULT NULL,
  p_name_lo    TEXT    DEFAULT NULL,
  p_icon       TEXT    DEFAULT NULL,
  p_color      TEXT    DEFAULT NULL,
  p_sort_order INTEGER DEFAULT NULL,
  p_is_active  BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE categories SET
    name       = COALESCE(NULLIF(p_name, ''),    name),
    name_th    = CASE WHEN p_name_th  IS NULL THEN name_th    ELSE NULLIF(p_name_th,  '') END,
    name_lo    = CASE WHEN p_name_lo  IS NULL THEN name_lo    ELSE NULLIF(p_name_lo,  '') END,
    icon       = CASE WHEN p_icon     IS NULL THEN icon       ELSE NULLIF(p_icon,     '') END,
    color      = CASE WHEN p_color    IS NULL THEN color      ELSE NULLIF(p_color,    '') END,
    sort_order = COALESCE(p_sort_order, sort_order),
    is_active  = COALESCE(p_is_active,  is_active),
    updated_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ─── 5. delete_category(id) — safe delete only ───────────────────────────────

DROP FUNCTION IF EXISTS delete_category(UUID);

CREATE OR REPLACE FUNCTION delete_category(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_menu_count   BIGINT;
  v_child_count  BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_menu_count  FROM recipes    WHERE category_id = p_id;
  SELECT COUNT(*) INTO v_child_count FROM categories WHERE parent_id   = p_id;

  IF v_menu_count > 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'มีเมนูอยู่ในหมวดนี้ ' || v_menu_count || ' รายการ');
  END IF;
  IF v_child_count > 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'มีหมวดย่อยอยู่ ' || v_child_count || ' หมวด');
  END IF;

  DELETE FROM categories WHERE id = p_id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- ─── 6. swap_category_sort(id_a, id_b) — swap sort_order ─────────────────────

DROP FUNCTION IF EXISTS swap_category_sort(UUID, UUID);

CREATE OR REPLACE FUNCTION swap_category_sort(p_id_a UUID, p_id_b UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sort_a INTEGER;
  v_sort_b INTEGER;
BEGIN
  SELECT sort_order INTO v_sort_a FROM categories WHERE id = p_id_a;
  SELECT sort_order INTO v_sort_b FROM categories WHERE id = p_id_b;
  UPDATE categories SET sort_order = v_sort_b WHERE id = p_id_a;
  UPDATE categories SET sort_order = v_sort_a WHERE id = p_id_b;
END;
$$;

-- ─── 7. GRANT TO anon ─────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_categories_tree()                                           TO anon;
GRANT EXECUTE ON FUNCTION create_category(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER)    TO anon;
GRANT EXECUTE ON FUNCTION update_category(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION delete_category(UUID)                                           TO anon;
GRANT EXECUTE ON FUNCTION swap_category_sort(UUID, UUID)                                  TO anon;
