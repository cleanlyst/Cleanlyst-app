-- =========================
-- CUSTOMER PREFERENCES: PROPERTY DETAILS
-- =========================
-- Adds property_type, bedrooms, bathrooms as the single source of truth
-- for property information. These fields pre-populate the Book Cleaner flow.

alter table public.customer_preferences
  add column if not exists property_type text,
  add column if not exists bedrooms      text,
  add column if not exists bathrooms     text;

-- =========================
-- BOOKINGS: PROPERTY SNAPSHOT
-- =========================
-- Stores an immutable snapshot of property details at booking time.
-- Future preference edits must not alter historical bookings.

alter table public.bookings
  add column if not exists property_type_snapshot text,
  add column if not exists bedrooms_snapshot       text,
  add column if not exists bathrooms_snapshot      text;
