-- ============================================================
-- BACKFILL customer_preferences.setup_completed_at
-- ============================================================
-- Existing customers who completed their address preferences
-- before setup_completed_at was introduced have a null value.
-- Mark them as complete so they bypass the onboarding gate.
-- ============================================================

update public.customer_preferences
set setup_completed_at = coalesce(updated_at, created_at, now())
where setup_completed_at is null
  and address_line_1 is not null
  and city is not null
  and postcode is not null;
