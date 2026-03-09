-- Alan Cafe OS — Payment Banks
-- Migration: 020_payment_banks.sql

-- Add payment_banks key to site_settings (JSON array of bank objects)
INSERT INTO site_settings (key, value)
VALUES ('payment_banks', '[]')
ON CONFLICT (key) DO NOTHING;
