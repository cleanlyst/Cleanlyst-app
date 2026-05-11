-- =========================
-- PAYOUTS: TEXT → ENUM TYPE MIGRATION
-- =========================
-- payouts.status is currently an untyped text column, allowing any string.
-- This migration converts it to the payout_status enum defined in 20260511100000.
--
-- The USING clause maps every value the release-payout Edge Function writes:
--   'pending'    → pending    (table default)
--   'released'   → released   (written by release-payout on successful transfer)
--   'processing' → processing (future webhook path)
--   'paid'       → paid       (future settled state)
--   'failed'     → failed     (future failure path)
-- Any unexpected text value falls back to 'pending' to avoid data loss.
--
-- NOTE: ALTER COLUMN TYPE rewrites the table and takes ACCESS EXCLUSIVE lock.
-- Run during low-traffic window or via pg_repack for zero-downtime on large tables.

-- Drop the text default before changing the type.
-- PostgreSQL cannot automatically cast a text DEFAULT to an enum type,
-- so the default must be removed first and re-applied after the conversion.
alter table public.payouts
  alter column status drop default;

alter table public.payouts
  alter column status type public.payout_status
  using (
    case status
      when 'pending'    then 'pending'
      when 'processing' then 'processing'
      when 'released'   then 'released'
      when 'paid'       then 'paid'
      when 'failed'     then 'failed'
      else                   'pending'
    end
  )::public.payout_status;

-- Re-apply the default now typed correctly as payout_status.
alter table public.payouts
  alter column status set default 'pending'::public.payout_status;

-- Ensure NOT NULL is still enforced (preserved through ALTER TYPE, but explicit).
alter table public.payouts
  alter column status set not null;
