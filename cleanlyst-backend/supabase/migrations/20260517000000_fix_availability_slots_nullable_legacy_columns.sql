-- Remove legacy starts_at / ends_at columns from availability_slots.
--
-- The original init_schema used absolute timestamptz columns (starts_at, ends_at)
-- to model one-off availability windows. The phase2_schema_gaps migration
-- introduced the recurring weekly pattern (day_of_week + start_time + end_time),
-- making starts_at/ends_at vestigial.
--
-- Dropping them eliminates the dual time representation that the frontend was
-- sending in INSERT payloads, and removes any future ambiguity about which
-- columns are authoritative for recurring slots.
--
-- No view, RLS policy, trigger function, or frontend code references these
-- columns after this migration.

alter table public.availability_slots
  drop column if exists starts_at,
  drop column if exists ends_at;
