-- Platform fees refactor: add cleaner_commission_percent to platform_settings
-- and extend booking_financials with full snapshot columns

-- ── platform_settings ────────────────────────────────────────────────────────

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS cleaner_commission_percent numeric(5,2) NOT NULL DEFAULT 15.00;

-- Ensure there is always exactly one row (singleton pattern)
-- If the table is empty, seed it with sensible defaults
INSERT INTO platform_settings (booking_fee_percent, booking_fee_fixed_cents, cleaner_commission_percent)
SELECT 7.00, 0, 15.00
WHERE NOT EXISTS (SELECT 1 FROM platform_settings);

-- ── booking_financials ───────────────────────────────────────────────────────

-- Add missing columns if they don't already exist
ALTER TABLE booking_financials
  ADD COLUMN IF NOT EXISTS service_price_cents     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleaner_commission_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_revenue_cents  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_fee_percent      numeric(5,2) NOT NULL DEFAULT 7.00,
  ADD COLUMN IF NOT EXISTS cleaner_commission_percent numeric(5,2) NOT NULL DEFAULT 15.00;

-- Back-fill existing rows from the bookings table where possible
UPDATE booking_financials bf
SET
  service_price_cents       = COALESCE(b.cleaner_payout_cents, 0),
  cleaner_commission_cents  = GREATEST(0, COALESCE(b.quote_cents, 0) - COALESCE(b.cleaner_payout_cents, 0) - COALESCE(bf.booking_fee_cents, 0)),
  platform_revenue_cents    = COALESCE(bf.platform_fee_cents, 0) + GREATEST(0, COALESCE(b.quote_cents, 0) - COALESCE(b.cleaner_payout_cents, 0) - COALESCE(bf.booking_fee_cents, 0))
FROM bookings b
WHERE bf.booking_id = b.id
  AND bf.service_price_cents = 0;

-- ── RLS: allow admin to update platform_settings ─────────────────────────────

-- Drop existing policies if they exist and recreate cleanly
DROP POLICY IF EXISTS "admin_update_platform_settings" ON platform_settings;
DROP POLICY IF EXISTS "admin_read_platform_settings" ON platform_settings;
DROP POLICY IF EXISTS "authenticated_read_platform_settings" ON platform_settings;

-- All authenticated users can read (needed for pricing engine on frontend)
CREATE POLICY "authenticated_read_platform_settings"
  ON platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update
CREATE POLICY "admin_update_platform_settings"
  ON platform_settings FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "admin_insert_platform_settings"
  ON platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
