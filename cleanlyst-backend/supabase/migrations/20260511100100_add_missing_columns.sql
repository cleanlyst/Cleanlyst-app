-- =========================
-- PROFILES: MISSING COLUMNS
-- =========================

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists last_login_at timestamptz;

-- Backfill email from auth.users for all existing profiles.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Unique index (not constraint) so partial nulls don't conflict.
create unique index if not exists profiles_email_uidx
  on public.profiles (email)
  where email is not null;

-- Keep profiles.email in sync whenever auth.users.email changes
-- (e.g. after user confirms an email-change request).
create or replace function public.sync_user_email_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_email_changed'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_email_changed
    after update of email on auth.users
    for each row
    when (old.email is distinct from new.email)
    execute function public.sync_user_email_to_profile();
  end if;
end $$;

-- =========================
-- CLEANER PROFILES: MISSING COLUMNS
-- =========================

alter table public.cleaner_profiles
  add column if not exists cleaner_type public.cleaner_type,
  add column if not exists years_experience integer,
  add column if not exists approval_date timestamptz,
  add column if not exists total_jobs_completed integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cleaner_profiles_years_experience_check'
      and conrelid = 'public.cleaner_profiles'::regclass
  ) then
    alter table public.cleaner_profiles
      add constraint cleaner_profiles_years_experience_check
      check (years_experience is null or years_experience >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cleaner_profiles_total_jobs_check'
      and conrelid = 'public.cleaner_profiles'::regclass
  ) then
    alter table public.cleaner_profiles
      add constraint cleaner_profiles_total_jobs_check
      check (total_jobs_completed >= 0);
  end if;
end $$;

-- =========================
-- CUSTOMER PREFERENCES: MISSING COLUMNS
-- =========================

alter table public.customer_preferences
  add column if not exists city text;

-- =========================
-- BOOKINGS: MISSING COLUMNS
-- =========================

alter table public.bookings
  add column if not exists latitude  numeric(9, 6),
  add column if not exists longitude numeric(9, 6),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_latitude_range_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_latitude_range_check
      check (latitude is null or (latitude between -90 and 90));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_longitude_range_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_longitude_range_check
      check (longitude is null or (longitude between -180 and 180));
  end if;
end $$;

-- =========================
-- MESSAGES: MISSING COLUMNS
-- =========================

alter table public.messages
  add column if not exists read_at timestamptz;

-- =========================
-- PLATFORM SETTINGS: MISSING COLUMNS
-- =========================

alter table public.platform_settings
  add column if not exists support_email text;

-- =========================
-- CLEANER SUBSCRIPTIONS: MISSING COLUMNS
-- =========================

alter table public.cleaner_subscriptions
  add column if not exists current_period_start timestamptz;

-- =========================
-- HANDLE_NEW_USER: SECURITY FIX + EMAIL CAPTURE
-- =========================
-- Closes privilege escalation: raw_user_meta_data->>'role' = 'admin' previously
-- resolved to the admin role during self-signup. Now, only 'cleaner_pending'
-- is grantable via public signup; admin/cleaner_active require an existing admin.
-- Also captures email at profile creation so profiles.email is never stale.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  resolved_role  public.user_role;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'customer');

  resolved_role := case requested_role
    when 'cleaner'         then 'cleaner_pending'
    when 'cleaner_pending' then 'cleaner_pending'
    else                        'customer'
  end;

  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    resolved_role,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email
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
