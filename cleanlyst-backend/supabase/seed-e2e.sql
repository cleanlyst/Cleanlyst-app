-- ============================================================
-- E2E Test Seed Data
-- Run: supabase db reset --db-url <url> && psql <url> < supabase/seed-e2e.sql
-- This file is idempotent — safe to run multiple times.
-- Note: auth.users must be created via Supabase service role API (see
-- tests/e2e/utils.ts seedTestData) or via the Dashboard. This SQL file
-- handles only the profile + related tables once auth users exist.
-- ============================================================

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- Replace the UUIDs below with the actual auth.users UUIDs for each test user.
-- These are looked up at runtime by tests/e2e/utils.ts.

-- ── Cleaner profile ───────────────────────────────────────────────────────────
-- Seeded by ensureUserWithProfile('ugobrendan@gmail.com', ..., 'cleaner_active')
-- cleaner_profiles row: business_name='Test Cleanlyst Service', status='approved'
-- availability_slots: all 7 days, 09:00–17:00
-- services: Standard Cleaning, £30, 90 min

-- ── Customer preferences ─────────────────────────────────────────────────────
-- Seeded by ensureUserWithProfile('tilda93@hotmail.co.uk', ..., 'customer')
-- customer_preferences: address='10 Test Street, WN1 1AA', room_count=2

-- ── Cleanup helper: remove test bookings ─────────────────────────────────────
-- Use this to reset booking state between test runs without full DB wipe.
-- Paste into Supabase SQL editor or run via psql.

/*
delete from public.bookings
where customer_id = (
  select id from auth.users where email = 'tilda93@hotmail.co.uk'
)
and status in (
  'pending_request', 'accepted', 'paid', 'cancelled',
  'cleaner_cancelled', 'declined', 'cleaner_declined'
);
*/

-- ── All seeding is handled programmatically by tests/e2e/utils.ts ────────────
-- The globalSetup calls seedTestData() which calls ensureUserWithProfile()
-- for each test user, creating auth users + profiles + cleaner data.
-- This SQL file serves as documentation and a manual reset utility.

select 'E2E seed documentation loaded. Run seedTestData() from global-setup.ts to seed test users.' as info;
