-- =========================
-- LEGACY CLEANER ROLE FIX
-- =========================

-- Ensure the new cleaner role values exist in the enum.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cleaner_pending';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cleaner_active';

-- Convert any legacy cleaner profiles to cleaner_pending.
-- Cast to text before comparing so PostgreSQL does not validate 'cleaner'
-- against the current enum (20260426101500 already removed that value).
UPDATE public.profiles
SET role = 'cleaner_pending'
WHERE role::text = 'cleaner';
