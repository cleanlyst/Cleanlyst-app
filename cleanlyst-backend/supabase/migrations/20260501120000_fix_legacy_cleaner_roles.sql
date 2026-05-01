-- =========================
-- LEGACY CLEANER ROLE FIX
-- =========================

-- Ensure the new cleaner role values exist in the enum.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cleaner_pending';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cleaner_active';

-- Convert any legacy cleaner profiles to cleaner_pending.
UPDATE public.profiles
SET role = 'cleaner_pending'
WHERE role = 'cleaner';
