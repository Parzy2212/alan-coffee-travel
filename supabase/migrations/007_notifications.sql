-- ============================================================
--  Alan Cafe OS -- Phase 7: Notification Preferences
--  Migration 007: notification_preferences table
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor)
--  Safe to run multiple times (IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ── Notification Preferences ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,

  -- Email notifications
  email_daily_report   BOOLEAN DEFAULT true,
  email_weekly_report  BOOLEAN DEFAULT true,
  email_low_stock      BOOLEAN DEFAULT true,
  email_large_order    BOOLEAN DEFAULT false,
  email_new_member     BOOLEAN DEFAULT true,
  email_security_alerts BOOLEAN DEFAULT true,
  email_marketing      BOOLEAN DEFAULT false,

  -- Telegram notifications (per-user override)
  telegram_enabled  BOOLEAN DEFAULT false,
  telegram_chat_id  TEXT,

  -- Frequency / schedule
  daily_report_time  TIME    DEFAULT '22:00',
  weekly_report_day  TEXT    DEFAULT 'monday'
    CHECK (weekly_report_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),

  -- Language for notifications
  notification_language TEXT DEFAULT 'th'
    CHECK (notification_language IN ('th','lo','en')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique indexes to handle nullable shop_id correctly
CREATE UNIQUE INDEX IF NOT EXISTS notif_prefs_user_shop_idx
  ON notification_preferences (user_id, shop_id)
  WHERE shop_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notif_prefs_user_null_idx
  ON notification_preferences (user_id)
  WHERE shop_id IS NULL;

CREATE INDEX IF NOT EXISTS notif_prefs_user_idx ON notification_preferences(user_id);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_own_all" ON notification_preferences;
CREATE POLICY "notif_prefs_own_all" ON notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Auto-update timestamp ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _notif_prefs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_prefs_updated ON notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION _notif_prefs_updated_at();

-- ── account_events: add missing event types (columns already exist from 003) ───
-- The account_events table already has ip_address and user_agent columns.
-- This comment documents additional event_type values used in Phase 7:
--   'shop_settings_updated'     shop settings changed
--   'team_invitation_sent'      invitation link created
--   'team_invitation_accepted'  invitation accepted

-- ============================================================
--  DONE
--  Next: go to /account/notifications to configure preferences
--  and /account/activity to view full activity log.
-- ============================================================
