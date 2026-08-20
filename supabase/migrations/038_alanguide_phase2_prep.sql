-- ============================================================
--  AlanGuide -- Migration 038: Phase 2 prep (inert columns/tables)
--
--  Phase 1 (now, single guide) ships as a plain directory: browse
--  guides/destinations/experiences, contact via WhatsApp/Messenger,
--  no in-app booking or payment. This migration does NOT change any
--  behavior -- it only adds nullable columns / empty tables so that
--  Phase 2 (multi-guide matching + in-app chat + payment) can be
--  built later WITHOUT restructuring the existing guides,
--  experiences, and inquiries tables.
--
--  Nothing here is read or written by the app yet.
--
--  Run in Supabase SQL Editor (Dashboard -> SQL Editor)
--  Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
--  1. guides -- future self-serve login + availability toggle
-- ──────────────────────────────────────────────────────────────

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS accepting_bookings boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN guides.user_id IS
  'Phase 2: links a guide row to a Supabase auth user so the guide can log in and edit their own profile. NULL in phase 1 (admin manages all guides).';
COMMENT ON COLUMN guides.accepting_bookings IS
  'Phase 2: toggle used by the future matching flow to know if a guide is currently available. Unused in phase 1.';


-- ──────────────────────────────────────────────────────────────
--  2. experiences -- per-listing booking mode switch
-- ──────────────────────────────────────────────────────────────

ALTER TABLE experiences
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'contact_only'
    CHECK (booking_mode IN ('contact_only', 'requestable', 'instant'));

COMMENT ON COLUMN experiences.booking_mode IS
  'Phase 2: lets individual experiences switch from contact-only to in-app requestable/instant booking without a schema change. All rows are contact_only in phase 1.';


-- ──────────────────────────────────────────────────────────────
--  3. inquiries -- grows into the booking record in phase 2
-- ──────────────────────────────────────────────────────────────

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS assigned_guide_id uuid REFERENCES guides(id) ON DELETE SET NULL;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS total_price_lak numeric;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded'));

COMMENT ON COLUMN inquiries.assigned_guide_id IS
  'Phase 2: the guide matched to this inquiry by the future auto-matching flow. NULL in phase 1 -- inquiries already carry guide_id when a traveler contacts a specific guide directly.';
COMMENT ON COLUMN inquiries.matched_at IS
  'Phase 2: timestamp when assigned_guide_id was set.';
COMMENT ON COLUMN inquiries.total_price_lak IS
  'Phase 2: agreed price once the future escrow/payment flow is wired up.';
COMMENT ON COLUMN inquiries.payment_status IS
  'Phase 2: not_required in phase 1 (no in-app payment exists yet).';


-- ──────────────────────────────────────────────────────────────
--  4. conversations / messages -- empty scaffolding for phase 2 chat
--     No UI reads/writes these yet. RLS enabled with service_role only
--     for now (locked down until phase 2 defines real access rules).
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type      text NOT NULL CHECK (sender_type IN ('guide', 'traveler', 'admin')),
  body             text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_inquiry_id ON conversations(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies on purpose -- these tables are unused
-- placeholders. Only the service-role key (server-side) can touch them
-- until phase 2 defines who's allowed to read/write.

COMMENT ON TABLE conversations IS
  'Phase 2: one conversation thread per inquiry. Empty/unused in phase 1.';
COMMENT ON TABLE messages IS
  'Phase 2: chat messages within a conversation. Empty/unused in phase 1.';

-- ============================================================
--  DONE. Verify with:
--   select column_name from information_schema.columns
--   where table_name in ('guides','experiences','inquiries')
--   and column_name in ('user_id','accepting_bookings','booking_mode',
--     'assigned_guide_id','matched_at','total_price_lak','payment_status');
-- ============================================================
