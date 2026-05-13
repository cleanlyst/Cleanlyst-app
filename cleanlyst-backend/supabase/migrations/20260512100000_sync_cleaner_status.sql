-- =============================================================================
-- Sync cleaner_profiles.status with profiles.role
-- =============================================================================
-- Root cause: the admin approval flow can update profiles.role to 'cleaner_active'
-- without updating cleaner_profiles.status to 'approved'. This causes two issues:
--   1. Frontend badge reads cleanerProfile.status and shows "PENDING APPROVAL"
--      even though the user can log in and use the dashboard.
--   2. The public marketplace SELECT policy filters on status = 'approved', so
--      these cleaners are invisible to customers browsing for a cleaner.
-- =============================================================================

-- Promote status for any cleaner whose role is already active
update public.cleaner_profiles cp
set    status = 'approved'
from   public.profiles p
where  p.id        = cp.user_id
  and  p.role      = 'cleaner_active'
  and  cp.status   = 'pending';

-- Reciprocal: demote role for any cleaner whose profile was rejected/suspended
-- but whose role was not updated (defensive — prevents a cleaner with
-- status = 'rejected' still routing to the active cleaner dashboard).
update public.profiles p
set    role = 'cleaner_pending'
from   public.cleaner_profiles cp
where  cp.user_id = p.id
  and  cp.status  in ('rejected', 'suspended')
  and  p.role     = 'cleaner_active';

-- =============================================================================
-- Trigger: keep the two columns in sync on future admin updates
-- =============================================================================

create or replace function public.sync_cleaner_role_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    update public.profiles
    set    role = 'cleaner_active'
    where  id   = new.user_id
      and  role = 'cleaner_pending';

  elsif new.status in ('rejected', 'suspended') and old.status not in ('rejected', 'suspended') then
    update public.profiles
    set    role = 'cleaner_pending'
    where  id   = new.user_id
      and  role = 'cleaner_active';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_cleaner_role on public.cleaner_profiles;

create trigger trg_sync_cleaner_role
after update of status on public.cleaner_profiles
for each row
execute function public.sync_cleaner_role_on_status_change();
