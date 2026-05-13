-- Fix 1: Add is_available column to cleaner_profiles (was incorrectly on availability_slots only)
alter table public.cleaner_profiles
  add column if not exists is_available boolean not null default true;

-- Fix 2: Set onboarding_complete = true for all approved cleaners
-- (sync_cleaner_status.sql set status='approved' but missed this flag)
update public.cleaner_profiles
  set onboarding_complete = true
  where status = 'approved' and onboarding_complete = false;

-- Fix 3: Ensure every cleaner_active user has a cleaner_profiles row
-- (manual role promotion may have skipped profile creation)
insert into public.cleaner_profiles (user_id, status, onboarding_complete, is_available)
  select p.id, 'approved', true, true
  from public.profiles p
  where p.role = 'cleaner_active'
    and not exists (
      select 1 from public.cleaner_profiles cp where cp.user_id = p.id
    )
  on conflict (user_id) do nothing;

-- Fix 4: Add RLS policy so customers/anonymous users can read approved cleaner profile rows
-- (profiles!inner join in PostgREST applies RLS to joined table; without this policy all search results are empty)
drop policy if exists "Approved cleaner profiles visible for marketplace" on public.profiles;
create policy "Approved cleaner profiles visible for marketplace"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.cleaner_profiles cp
      where cp.user_id = profiles.id
        and cp.status = 'approved'
    )
  );
