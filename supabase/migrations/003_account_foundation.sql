-- ============================================================
--  Alan Cafe OS — Account Foundation
--  Migration 003: shop_users profile columns, account_events,
--                 last_seen_at auto-update trigger
--
--  Run in Supabase SQL Editor (Dashboard → SQL Editor)
--  Safe to run multiple times (IF NOT EXISTS throughout)
-- ============================================================


-- ──────────────────────────────────────────────────────────────
--  1. PROFILE COLUMNS ON shop_users
-- ──────────────────────────────────────────────────────────────

ALTER TABLE shop_users
  ADD COLUMN IF NOT EXISTS display_name  TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url    TEXT,
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS language      TEXT        DEFAULT 'th',
  ADD COLUMN IF NOT EXISTS timezone      TEXT        DEFAULT 'Asia/Vientiane',
  ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;


-- ──────────────────────────────────────────────────────────────
--  2. ACCOUNT EVENTS — AUDIT LOG
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id      UUID        REFERENCES shops(id) ON DELETE SET NULL,
  event_type   TEXT        NOT NULL,
  -- Common event_type values:
  --   'login'            successful sign-in
  --   'logout'           explicit sign-out
  --   'password_change'  password updated
  --   'profile_update'   name/email/phone changed
  --   'member_invited'   shop member invited
  --   'member_removed'   shop member removed
  --   'employee_added'   POS employee created
  --   'employee_removed' POS employee deleted
  description  TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_events_user_id_idx    ON account_events(user_id);
CREATE INDEX IF NOT EXISTS account_events_created_at_idx ON account_events(created_at DESC);

-- RLS: users can only read and insert their own events
ALTER TABLE account_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_events_own_read"   ON account_events;
CREATE POLICY "account_events_own_read" ON account_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "account_events_own_insert" ON account_events;
CREATE POLICY "account_events_own_insert" ON account_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
--  3. TRIGGER: AUTO-UPDATE last_seen_at ON LOGIN
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _update_last_seen()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE shop_users
     SET last_seen_at = now()
   WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_last_seen ON account_events;
CREATE TRIGGER trg_last_seen
  AFTER INSERT ON account_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'login')
  EXECUTE FUNCTION _update_last_seen();


-- ──────────────────────────────────────────────────────────────
--  DONE
--  After running this migration:
--  1. Avatar dropdown in /cafe dashboard will show user info
--  2. Login/logout events will be logged to account_events
--  3. last_seen_at on shop_users updates automatically on login
-- ──────────────────────────────────────────────────────────────
