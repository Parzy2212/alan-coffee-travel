-- ───────────────────────────────────────────────────────────────
-- 035: Solo Operator Mode — user preferences + today stats view
-- ───────────────────────────────────────────────────────────────

-- User preferences (per-user, RLS enforced)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id               UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_advanced_features BOOLEAN NOT NULL DEFAULT false,
  favorite_menu_ids     UUID[]  NOT NULL DEFAULT '{}',
  pos_quick_keys        JSONB   NOT NULL DEFAULT '{}',
  dashboard_layout      TEXT    NOT NULL DEFAULT 'default',
  show_tips             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_prefs_own" ON user_preferences;
CREATE POLICY "user_prefs_own" ON user_preferences
  FOR ALL TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_user_prefs_updated_at ON user_preferences;
CREATE TRIGGER trg_user_prefs_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Today stats view (cached-friendly, timezone-aware)
CREATE OR REPLACE VIEW v_today_stats AS
SELECT
  shop_id,
  COUNT(*)                                         AS order_count,
  COALESCE(SUM(total_lak), 0)                      AS revenue_lak,
  MAX(created_at)                                  AS last_order_at,
  COALESCE(ROUND(AVG(total_lak)::NUMERIC, 0), 0)   AS avg_order_value
FROM orders
WHERE
  status  = 'paid'
  AND (is_test IS NULL OR is_test = false)
  AND (created_at AT TIME ZONE 'Asia/Vientiane')::DATE
      = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE
GROUP BY shop_id;

-- Yesterday stats view (for % comparison)
CREATE OR REPLACE VIEW v_yesterday_stats AS
SELECT
  shop_id,
  COUNT(*)                      AS order_count,
  COALESCE(SUM(total_lak), 0)   AS revenue_lak
FROM orders
WHERE
  status  = 'paid'
  AND (is_test IS NULL OR is_test = false)
  AND (created_at AT TIME ZONE 'Asia/Vientiane')::DATE
      = (NOW() AT TIME ZONE 'Asia/Vientiane')::DATE - INTERVAL '1 day'
GROUP BY shop_id;
