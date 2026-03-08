-- Alan Cafe OS — Settings Detail
-- Migration: 018_settings_detail.sql

-- ─── Seed all new site_settings keys with defaults ────────────────────────────

INSERT INTO site_settings (key, value) VALUES
  -- Shop info
  ('shop_address',                ''),
  ('shop_lat',                    ''),
  ('shop_lng',                    ''),
  ('shop_phone',                  ''),
  ('shop_email',                  ''),
  ('shop_facebook',               ''),
  ('shop_instagram',              ''),
  ('shop_line',                   ''),
  ('open_time',                   '07:00'),
  ('close_time',                  '22:00'),
  ('open_days',                   '["mon","tue","wed","thu","fri","sat","sun"]'),
  -- Finance
  ('currency_primary',            'LAK'),
  ('currency_secondary',          'THB'),
  ('vat_percent',                 '0'),
  ('service_charge_percent',      '0'),
  ('receipt_auto_print',          'false'),
  -- TV / Queue
  ('queue_ticker_text',           ''),
  ('queue_display_mode',          'standard'),
  -- Notifications
  ('low_stock_alert_line_token',  ''),
  ('daily_report_line_token',     ''),
  ('low_stock_alert_enabled',     'false'),
  ('daily_report_enabled',        'false'),
  -- AI
  ('ai_analyst_enabled',          'false')
ON CONFLICT (key) DO NOTHING;

-- ─── Allow anon to INSERT into site_settings (for upsert via update_site_setting RPC) ──
-- The existing update_site_setting(TEXT, TEXT) RPC already handles upserts, no changes needed.
-- GRANT already exists from migration 012.
