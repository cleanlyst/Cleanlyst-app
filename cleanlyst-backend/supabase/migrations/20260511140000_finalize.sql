-- =========================
-- FINALIZE: SCHEMA + RLS + AUTH ROLES
-- =========================
-- This is the last migration before frontend development begins.
-- Closes remaining schema gaps, hardens auth, and provides clean
-- RPCs the frontend can call directly.

-- =========================
-- PART 1: SCHEMA TIGHTENING
-- =========================

-- -------------------------
-- Enforce NOT NULL on nullable timestamp columns
-- -------------------------
-- cleaner_profiles, services, and bookings were created with
-- `default now()` but without NOT NULL, making them inconsistent
-- with every other table. Backfill any nulls before adding the constraint.

update public.cleaner_profiles
set
  created_at = now()
where created_at is null;

update public.cleaner_profiles
set
  updated_at = now()
where updated_at is null;

alter table public.cleaner_profiles
  alter column created_at set not null,
  alter column updated_at set not null;

-- --

update public.services
set created_at = now()
where created_at is null;

update public.services
set updated_at = now()
where updated_at is null;

alter table public.services
  alter column created_at set not null,
  alter column updated_at set not null;

-- --

update public.bookings
set created_at = now()
where created_at is null;

update public.bookings
set updated_at = now()
where updated_at is null;

alter table public.bookings
  alter column created_at set not null,
  alter column updated_at set not null;

-- -------------------------
-- Drop the useless platform_settings singleton constraint
-- -------------------------
-- `check (id is not null)` is always true and does nothing.
-- The actual singleton enforcement is the trigger added in 20260511100500.
alter table public.platform_settings
  drop constraint if exists platform_settings_singleton;

-- -------------------------
-- Auto-stamp cancelled_at on booking cancellation
-- -------------------------
-- The transition_booking_state RPC sets completed_at, dispute_opened_at etc.
-- but never sets cancelled_at. This BEFORE trigger fills that gap transparently
-- so no RPC code changes are needed.
create or replace function public.stamp_booking_lifecycle_timestamps()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'cancelled' and new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger trg_stamp_booking_lifecycle_timestamps
before update on public.bookings
for each row execute function public.stamp_booking_lifecycle_timestamps();

-- =========================
-- PART 2: AUTH ROLES — HARDENING
-- =========================

-- -------------------------
-- Block self-role-escalation via profile update (CRITICAL)
-- -------------------------
-- The "Users update own profile" RLS policy allows any authenticated user
-- to UPDATE their own profile row, including the role column. Without this
-- trigger, any user can escalate themselves to admin via:
--   UPDATE profiles SET role = 'admin' WHERE id = auth.uid()
--
-- Fix: a BEFORE UPDATE trigger that raises if a non-admin tries to change role.
-- auth.uid() = NULL means service-role context (Edge Functions, security-definer
-- RPCs) — those are always permitted so they can promote cleaners on approval.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    -- auth.uid() is NULL when executed under service role (bypasses this guard).
    -- Authenticated callers must be admin.
    if auth.uid() is not null and not public.is_admin() then
      raise exception
        'Unauthorized: role changes require admin privileges (attempted % → %)',
        old.role, new.role;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger trg_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_role_escalation();

-- =========================
-- PART 3: AUTH ROLE MANAGEMENT RPCs
-- =========================

-- -------------------------
-- admin_set_user_role
-- -------------------------
-- The only authorised path for changing a user's role via authenticated session.
-- Covers: promoting a cleaner_pending to cleaner_active if bypassing the
-- application flow, demoting a user, creating an admin from an existing user.
--
-- Guards:
--   - Caller must be admin
--   - Admin cannot change their own role (prevents accidental self-demotion)
--   - Syncs cleaner_profiles.status when role changes to/from cleaner variants
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
  set role = p_role
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

  -- If demoted away from cleaner role, mark profile as rejected/suspended
  if p_role = 'customer' then
    update public.cleaner_profiles
    set status = 'suspended'::public.cleaner_status
    where user_id = p_user_id;
  end if;

  return v_profile;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.user_role) to authenticated;

-- -------------------------
-- get_my_profile
-- -------------------------
-- Single RPC the frontend calls immediately after login to get role + profile
-- without needing a table query (avoids any RLS warm-up race conditions on
-- first session). Returns NULL if the profile does not exist yet (e.g. during
-- handle_new_user race on very first sign-in).
create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- -------------------------
-- is_onboarded
-- -------------------------
-- Lightweight boolean check the frontend can use to gate dashboard access.
-- Returns true only for fully active, onboarding-complete cleaners.
-- Customers are always considered onboarded once they have a profile.
create or replace function public.is_onboarded()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case role
      when 'customer'       then true
      when 'cleaner_active' then (
        select onboarding_complete
        from public.cleaner_profiles
        where user_id = auth.uid()
      )
      else false
    end
  from public.profiles
  where id = auth.uid();
$$;

revoke all on function public.is_onboarded() from public, anon;
grant execute on function public.is_onboarded() to authenticated;

-- =========================
-- PART 4: RLS — IDEMPOTENT RE-ENABLE
-- =========================
-- All tables already have RLS enabled from their creation migrations.
-- Stated explicitly here so the final schema state is self-documenting
-- and safe to re-run if a table was accidentally altered.

alter table public.profiles                    enable row level security;
alter table public.cleaner_profiles            enable row level security;
alter table public.customer_preferences        enable row level security;
alter table public.services                    enable row level security;
alter table public.availability_slots          enable row level security;
alter table public.booking_requests            enable row level security;
alter table public.bookings                    enable row level security;
alter table public.booking_status_events       enable row level security;
alter table public.booking_financials          enable row level security;
alter table public.messages                    enable row level security;
alter table public.reviews                     enable row level security;
alter table public.disputes                    enable row level security;
alter table public.dispute_messages            enable row level security;
alter table public.payments                    enable row level security;
alter table public.payouts                     enable row level security;
alter table public.payment_webhook_events      enable row level security;
alter table public.cleaner_subscriptions       enable row level security;
alter table public.cleaner_applications        enable row level security;
alter table public.cleaner_application_documents enable row level security;
alter table public.admin_application_reviews   enable row level security;
alter table public.notifications               enable row level security;
alter table public.platform_settings           enable row level security;
alter table public.city_rollout                enable row level security;
alter table public.waitlist_signups            enable row level security;

-- =========================
-- SCHEMA SIGN-OFF
-- =========================
-- Role hierarchy (final):
--
--   customer        default on signup; manages own bookings and preferences
--   cleaner_pending signed up as cleaner; awaiting admin approval
--   cleaner_active  approved; can accept bookings, manage services/availability
--   admin           full platform access; set only via admin_set_user_role RPC
--
-- Role transition paths:
--   signup                  → customer | cleaner_pending   (handle_new_user)
--   cleaner_pending → cleaner_active   (admin_review_cleaner_application)
--   any             → any             (admin_set_user_role, admin only)
--   self-change     → BLOCKED         (prevent_role_escalation trigger)
--
-- Auth call sequence for frontend on login:
--   1. supabase.auth.getUser()        → auth user + JWT
--   2. supabase.rpc('get_my_profile') → role, full_name, avatar_url, email
--   3. supabase.rpc('is_onboarded')   → gate dashboard vs onboarding flow
