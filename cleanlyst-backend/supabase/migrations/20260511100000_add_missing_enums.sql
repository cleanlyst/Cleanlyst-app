-- =========================
-- MISSING ENUMS
-- =========================

-- cleaner_type: distinguishes individual vs business cleaners.
-- Used on cleaner_profiles.cleaner_type added in 20260511100100.
do $$ begin
  create type public.cleaner_type as enum ('individual', 'business');
exception when duplicate_object then null; end $$;

-- document_status: admin review state for uploaded cleaner documents.
-- Replaces the current admin_verified boolean on cleaner_application_documents.
do $$ begin
  create type public.document_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- payout_status: typed status for cleaner payout records.
-- 'released' is the value written by the release-payout Edge Function.
-- payouts.status is currently an untyped text column; migration in 20260511100300.
do $$ begin
  create type public.payout_status as enum (
    'pending',
    'processing',
    'released',
    'paid',
    'failed'
  );
exception when duplicate_object then null; end $$;

-- Extend subscription_status with values aligned to DB_SCHEMA.md.
-- 'inactive' covers cleaners who cancel but are not yet past_due.
-- 'cancelled' (two l's) aligns to design doc spelling.
alter type public.subscription_status add value if not exists 'inactive';
alter type public.subscription_status add value if not exists 'cancelled';
