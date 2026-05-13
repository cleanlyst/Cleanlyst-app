-- =============================================================================
-- VERIFICATION SYSTEM: Wire up profiles.is_verified correctly
-- =============================================================================
-- Root cause: profiles.is_verified was added in 20260511100100 with
-- default FALSE but was never populated — not in handle_new_user(), not in
-- admin_review_cleaner_application(), not in any trigger.
--
-- Result: every profile has is_verified = false regardless of role.
--
-- This migration fixes all four gaps:
--   1. Backfills is_verified for all existing profiles
--   2. Updates handle_new_user() to set is_verified at profile creation
--   3. Adds trigger to sync is_verified when cleaner_profiles.status changes
--   4. Updates admin_set_user_role() to set is_verified on manual promotion
--   5. Replaces profiles marketplace RLS subquery with direct is_verified check
-- =============================================================================

-- =============================================================================
-- PART 1: BACKFILL EXISTING PROFILES
-- =============================================================================

-- Customers and admins are always verified
update public.profiles
set    is_verified = true
where  role in ('customer', 'admin')
  and  is_verified = false;

-- Approved cleaners are verified
update public.profiles p
set    is_verified = true
from   public.cleaner_profiles cp
where  cp.user_id    = p.id
  and  cp.status     = 'approved'
  and  p.is_verified = false;

-- Ensure pending/rejected/suspended cleaners are explicitly unverified
-- (defensive: covers any edge-case row that was manually set true)
update public.profiles p
set    is_verified = false
from   public.cleaner_profiles cp
where  cp.user_id    = p.id
  and  cp.status    <> 'approved'
  and  p.is_verified = true
  and  p.role in ('cleaner_pending', 'cleaner_active');

-- =============================================================================
-- PART 2: UPDATE handle_new_user()
-- =============================================================================
-- Set is_verified = true for customers at the moment their profile is created.
-- Cleaners start unverified (false) and become verified only after admin approval.
-- Admin users are promoted by an existing admin via admin_set_user_role —
-- they never arrive through the self-signup path, so no admin case needed here.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  resolved_role  public.user_role;
  v_is_verified  boolean;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'customer');

  resolved_role := case requested_role
    when 'cleaner'         then 'cleaner_pending'
    when 'cleaner_pending' then 'cleaner_pending'
    else                        'customer'
  end;

  -- Customers are verified at creation; cleaners start unverified
  v_is_verified := (resolved_role = 'customer');

  insert into public.profiles (id, role, full_name, email, is_verified)
  values (
    new.id,
    resolved_role,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    v_is_verified
  );

  if resolved_role = 'cleaner_pending' then
    insert into public.cleaner_profiles (user_id, business_name)
    values (new.id, nullif(new.raw_user_meta_data->>'business_name', ''))
    on conflict (user_id) do update
    set business_name = coalesce(
      excluded.business_name,
      public.cleaner_profiles.business_name
    );

    insert into public.cleaner_applications (cleaner_id)
    values (new.id)
    on conflict (cleaner_id) do nothing;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- PART 3: TRIGGER — sync is_verified on cleaner_profiles.status change
-- =============================================================================
-- Fires on every status transition, covering all approval paths:
--   - admin_review_cleaner_application() RPC (approve-cleaner edge function)
--   - reject-cleaner edge function
--   - admin_set_user_role() RPC (manual promotion)
--   - Direct admin DB updates
--
-- Runs AFTER the cleaner_profiles row is committed so the UPDATE on profiles
-- cannot conflict with a concurrent trigger on the same row.
--
-- The prevent_role_escalation trigger on profiles only checks role changes;
-- updating is_verified does not affect it.

create or replace function public.sync_is_verified_on_cleaner_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    update public.profiles
    set    is_verified = true
    where  id = new.user_id;

  elsif new.status <> 'approved' and old.status = 'approved' then
    update public.profiles
    set    is_verified = false
    where  id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_is_verified_on_cleaner_status on public.cleaner_profiles;

create trigger trg_sync_is_verified_on_cleaner_status
after update of status on public.cleaner_profiles
for each row
execute function public.sync_is_verified_on_cleaner_status();

-- =============================================================================
-- PART 4: UPDATE admin_set_user_role()
-- =============================================================================
-- Sets is_verified alongside the role change so manual promotions are
-- immediately consistent. The cleaner-status trigger in Part 3 also fires
-- when cleaner_profiles.status is updated below, producing the same result —
-- both paths agree, so there is no conflict.

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    public.user_role
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: only admins can call admin_set_user_role';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Admins cannot change their own role via this function';
  end if;

  update public.profiles
  set
    role        = p_role,
    is_verified = case p_role
      when 'customer'       then true
      when 'admin'          then true
      when 'cleaner_active' then true
      else                       false  -- cleaner_pending
    end
  where id = p_user_id
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'User % not found', p_user_id;
  end if;

  -- Ensure cleaner_profiles row exists when promoting to any cleaner role
  if p_role in ('cleaner_pending', 'cleaner_active') then
    insert into public.cleaner_profiles (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    update public.cleaner_profiles
    set status = case p_role
      when 'cleaner_active' then 'approved'::public.cleaner_status
      else                       'pending'::public.cleaner_status
    end
    where user_id = p_user_id;
  end if;

  -- If demoted away from cleaner role, mark profile as suspended
  if p_role = 'customer' then
    update public.cleaner_profiles
    set status = 'suspended'::public.cleaner_status
    where user_id = p_user_id;
  end if;

  -- If promoting to admin, ensure the user has no cleaner profile
  -- interfering with their verification state.
  if p_role = 'admin' then
    update public.cleaner_profiles
    set status = 'suspended'::public.cleaner_status
    where user_id = p_user_id
      and status <> 'suspended';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.user_role) to authenticated;

-- =============================================================================
-- PART 5: UPDATE profiles marketplace RLS policy
-- =============================================================================
-- Replace the cross-table subquery (expensive) with a direct boolean column
-- check (cheap, index-supported). The trigger in Part 3 + the backfill in
-- Part 1 guarantee that every approved cleaner (cleaner_profiles.status =
-- 'approved', profiles.role = 'cleaner_active') always has is_verified = true.
--
-- The existing cleaner_profiles "Public read approved cleaner profiles" policy
-- still enforces status = 'approved' as a second layer, so this is not the
-- only gate — defence-in-depth is preserved.

drop policy if exists "Approved cleaner profiles visible for marketplace" on public.profiles;
drop policy if exists "Verified cleaner profiles visible for marketplace"  on public.profiles;

create policy "Verified cleaner profiles visible for marketplace"
  on public.profiles
  for select
  using (is_verified = true and role = 'cleaner_active');
