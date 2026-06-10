-- ============================================================
-- Add 'paid' to booking_status enum
--
-- The init schema (20260413150243) was updated to include 'paid'
-- after the live database was already initialised, so the live DB
-- is missing this value.  Migration 20260602400000 (EPIC 4) added
-- the auto-advance accepted → paid logic but assumed 'paid' was
-- already present from the init schema — it wasn't.
--
-- All other booking lifecycle migrations that reference 'paid'
-- use ::text casts as a workaround; this migration adds the value
-- properly so direct enum assignments work correctly.
-- ============================================================

alter type public.booking_status add value if not exists 'paid';
