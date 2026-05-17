-- Fix: stack depth limit exceeded (54001) on availability_slots INSERT.
--
-- Root cause: cross-table RLS recursion between profiles and cleaner_profiles.
--
-- Recursion chain:
--   INSERT availability_slots → WITH CHECK policy calls is_cleaner_active()
--   is_cleaner_active() is LANGUAGE SQL STABLE → inlined by query planner
--   Inlined body queries profiles → profiles RLS evaluates ALL permissive policies:
--     "Approved cleaner profiles visible for marketplace"
--       → EXISTS(SELECT 1 FROM cleaner_profiles WHERE status = 'approved')
--       → cleaner_profiles RLS evaluates ALL permissive policies:
--           "Admin reads all cleaner profiles" calls is_admin()
--           is_admin() is LANGUAGE SQL STABLE → inlined by query planner
--           Inlined body queries profiles → profiles RLS → cycle repeats
--   → INFINITE RECURSION → max_stack_depth exceeded → 54001
--
-- The cycle was introduced by the "Approved cleaner profiles visible for
-- marketplace" policy (20260513120000_fix_cleaner_marketplace_visibility.sql)
-- which created a profiles → cleaner_profiles dependency, forming a closed
-- loop with the pre-existing cleaner_profiles → is_admin() → profiles path.
--
-- Fix: add SECURITY DEFINER + SET search_path to every role-check helper.
-- SECURITY DEFINER functions are never inlined by the query planner.
-- Their internal table access runs as the function owner and bypasses RLS,
-- so the profiles ↔ cleaner_profiles recursive evaluation chain cannot form.
--
-- This is the standard Supabase pattern for row-level security helper functions
-- and should have been applied from the start.

-- -------------------------
-- is_admin
-- -------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -------------------------
-- is_cleaner  (any cleaner role)
-- -------------------------
create or replace function public.is_cleaner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('cleaner_pending', 'cleaner_active')
  );
$$;

-- -------------------------
-- is_cleaner_pending
-- -------------------------
create or replace function public.is_cleaner_pending()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'cleaner_pending'
  );
$$;

-- -------------------------
-- is_cleaner_active
-- -------------------------
create or replace function public.is_cleaner_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'cleaner_active'
  );
$$;

-- -------------------------
-- is_customer
-- -------------------------
create or replace function public.is_customer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'customer'
  );
$$;
