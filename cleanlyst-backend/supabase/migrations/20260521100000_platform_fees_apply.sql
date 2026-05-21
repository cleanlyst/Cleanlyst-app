-- ============================================================
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Adds cleaner_commission_percent to platform_settings and
-- opens read access to all authenticated users (needed for
-- pricing engine called during booking flow).
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- 1. Add column (idempotent)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS cleaner_commission_percent numeric(5,2) NOT NULL DEFAULT 15.00;

-- 2. Populate the existing singleton row with the default
UPDATE public.platform_settings
SET cleaner_commission_percent = 15.00
WHERE cleaner_commission_percent IS NULL OR cleaner_commission_percent = 0;

-- 3. Extend booking_financials with snapshot columns (idempotent)
ALTER TABLE public.booking_financials
  ADD COLUMN IF NOT EXISTS service_price_cents       integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleaner_commission_cents  integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_revenue_cents    integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_fee_percent       numeric(5,2) NOT NULL DEFAULT 7.00,
  ADD COLUMN IF NOT EXISTS cleaner_commission_percent numeric(5,2) NOT NULL DEFAULT 15.00;

-- 4. Drop any conflicting old policies so we can cleanly recreate them
DROP POLICY IF EXISTS "authenticated_read_platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "admin_update_platform_settings"       ON public.platform_settings;
DROP POLICY IF EXISTS "admin_insert_platform_settings"       ON public.platform_settings;

-- 5. Allow ALL authenticated users to read platform_settings
--    (pricing engine needs this during customer/cleaner booking flows)
CREATE POLICY "authenticated_read_platform_settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- 6. Admins can update and insert (existing "Admin manages platform settings"
--    policy covers FOR ALL, so these are belt-and-suspenders — harmless)
CREATE POLICY "admin_update_platform_settings"
  ON public.platform_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Done. Verify with:
-- SELECT id, booking_fee_percent, cleaner_commission_percent FROM public.platform_settings;
