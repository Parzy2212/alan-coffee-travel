-- ============================================================
--  Alan Cafe OS -- Phase 6: Dashboard Team Invitations
--  Migration 006: shop_invitations table + helper functions
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor)
--  Safe to run multiple times (IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- pgcrypto needed for gen_random_bytes (may already exist)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Shop Invitations ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shop_invitations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invited_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  email               TEXT        NOT NULL,
  role                TEXT        NOT NULL CHECK (role IN ('manager','cashier','viewer')),
  message             TEXT,
  token               TEXT        UNIQUE NOT NULL
                                  DEFAULT encode(gen_random_bytes(24), 'base64'),
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shop_invitations_shop_idx   ON shop_invitations(shop_id);
CREATE INDEX IF NOT EXISTS shop_invitations_token_idx  ON shop_invitations(token);
CREATE INDEX IF NOT EXISTS shop_invitations_email_idx  ON shop_invitations(email);

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE shop_invitations ENABLE ROW LEVEL SECURITY;

-- Owner/manager of the shop can read their invitations
DROP POLICY IF EXISTS "invitations_shop_owner_read" ON shop_invitations;
CREATE POLICY "invitations_shop_owner_read" ON shop_invitations
  FOR SELECT TO authenticated
  USING (shop_id IN (
    SELECT shop_id FROM shop_users
    WHERE user_id = auth.uid() AND active = true AND role IN ('owner','manager')
  ));

-- Owner/manager can create invitations
DROP POLICY IF EXISTS "invitations_shop_owner_insert" ON shop_invitations;
CREATE POLICY "invitations_shop_owner_insert" ON shop_invitations
  FOR INSERT TO authenticated
  WITH CHECK (shop_id IN (
    SELECT shop_id FROM shop_users
    WHERE user_id = auth.uid() AND active = true AND role IN ('owner','manager')
  ));

-- Owner/manager can update (revoke, extend expiry)
DROP POLICY IF EXISTS "invitations_shop_owner_update" ON shop_invitations;
CREATE POLICY "invitations_shop_owner_update" ON shop_invitations
  FOR UPDATE TO authenticated
  USING (shop_id IN (
    SELECT shop_id FROM shop_users
    WHERE user_id = auth.uid() AND active = true AND role IN ('owner','manager')
  ));

-- ── Public read by token (invitee landing page) ────────────────────────────

DROP POLICY IF EXISTS "invitations_anon_read_by_token" ON shop_invitations;
CREATE POLICY "invitations_anon_read_by_token" ON shop_invitations
  FOR SELECT TO anon, authenticated
  USING (true);

-- ── get_invitation_details (public — no auth required) ────────────────────

CREATE OR REPLACE FUNCTION get_invitation_details(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv        shop_invitations%ROWTYPE;
  v_shop_name  TEXT;
  v_inviter    TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM shop_invitations WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT name INTO v_shop_name FROM shops WHERE id = v_inv.shop_id;

  SELECT COALESCE(su.display_name, su.full_name, su.email) INTO v_inviter
  FROM shop_users su
  WHERE su.user_id = v_inv.invited_by_user_id
    AND su.shop_id = v_inv.shop_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'found',        true,
    'email',        v_inv.email,
    'role',         v_inv.role,
    'status',       v_inv.status,
    'expires_at',   v_inv.expires_at,
    'shop_name',    COALESCE(v_shop_name, 'ร้านค้า'),
    'inviter_name', COALESCE(v_inviter, 'เจ้าของร้าน'),
    'message',      v_inv.message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_invitation_details(TEXT) TO anon, authenticated;

-- ── accept_shop_invitation (authenticated) ─────────────────────────────────

CREATE OR REPLACE FUNCTION accept_shop_invitation(p_token TEXT, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv        shop_invitations%ROWTYPE;
  v_user_email TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM shop_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or expired');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;

  IF LOWER(v_user_email) != LOWER(v_inv.email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email mismatch');
  END IF;

  -- Upsert into shop_users (handles both new members and role updates)
  INSERT INTO shop_users (shop_id, user_id, email, role, active, accepted_at)
  VALUES (v_inv.shop_id, p_user_id, v_user_email, v_inv.role, true, NOW())
  ON CONFLICT (shop_id, email) DO UPDATE
    SET user_id     = EXCLUDED.user_id,
        role        = EXCLUDED.role,
        active      = true,
        accepted_at = NOW();

  -- Mark invitation accepted
  UPDATE shop_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'shop_id', v_inv.shop_id);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_shop_invitation(TEXT, UUID) TO authenticated;

-- ── shop_users: allow owner/manager to update members ─────────────────────

DROP POLICY IF EXISTS "shop_users_manager_update" ON shop_users;
CREATE POLICY "shop_users_manager_update" ON shop_users
  FOR UPDATE TO authenticated
  USING (shop_id IN (
    SELECT shop_id FROM shop_users su
    WHERE su.user_id = auth.uid() AND su.active = true AND su.role IN ('owner','manager')
  ));

-- Owner/manager can remove members (delete) except themselves
DROP POLICY IF EXISTS "shop_users_owner_delete" ON shop_users;
CREATE POLICY "shop_users_owner_delete" ON shop_users
  FOR DELETE TO authenticated
  USING (
    user_id != auth.uid()
    AND shop_id IN (
      SELECT shop_id FROM shop_users su
      WHERE su.user_id = auth.uid() AND su.active = true AND su.role IN ('owner','manager')
    )
  );

-- ============================================================
--  DONE
--  Next: go to /shop/team to manage dashboard team members
--  and send invitation links via copy-and-paste.
-- ============================================================
