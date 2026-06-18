-- =============================================================================
-- FIX: Allow customer → cleaner_pending self-transition
-- =============================================================================
-- Problem: The prevent_role_escalation trigger (20260511140000_finalize.sql)
-- blocks ALL role changes by non-admin authenticated users. This breaks the
-- OAuth cleaner signup flow: provisionOAuthSignup() in auth.ts tries to update
-- a newly-created user from role='customer' (set by handle_new_user, which has
-- no metadata from Google OAuth) to role='cleaner_pending'. The trigger blocks it.
--
-- Fix: Add a special case before the blanket restriction — allow a user to
-- promote themselves from customer to cleaner_pending only. This is NOT a
-- privilege escalation: cleaner_pending still requires admin approval to become
-- cleaner_active. The transition is the equivalent of "applying to be a cleaner."
--
-- All other self-role-changes remain blocked.

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    -- Allow a user to apply as a cleaner (customer → cleaner_pending).
    -- cleaner_pending requires admin approval before becoming cleaner_active,
    -- so this is an application, not a privilege escalation.
    if auth.uid() = old.id
       and old.role = 'customer'
       and new.role = 'cleaner_pending' then
      return new;
    end if;

    -- All other role changes require admin (or service-role, auth.uid() = null).
    if auth.uid() is not null and not public.is_admin() then
      raise exception
        'Unauthorized: role changes require admin privileges (attempted % → %)',
        old.role, new.role;
    end if;
  end if;
  return new;
end;
$$;
