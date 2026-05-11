-- =========================
-- ROLE + STATUS FOUNDATION
-- =========================

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'user_role'
  ) then
    alter type public.user_role rename to user_role_old;
  end if;
end $$;

do $$ begin
  create type public.user_role as enum ('customer', 'cleaner_pending', 'cleaner_active', 'admin');
exception when duplicate_object then null; end $$;

alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type public.user_role
  using (
    case role::text
      when 'cleaner' then 'cleaner_pending'
      else role::text
    end
  )::public.user_role;

alter table public.profiles
  alter column role set default 'customer';

drop type if exists public.user_role_old;

-- =========================
-- BOOKING STATE MACHINE ENUM
-- =========================

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'booking_status'
  ) then
    alter type public.booking_status rename to booking_status_old;
  end if;
end $$;

do $$ begin
  create type public.booking_status as enum (
    'pending_request',
    'estimate_proposed',
    'awaiting_customer_payment',
    'payment_authorized',
    'in_progress',
    'completion_pending_customer',
    'completed',
    'disputed',
    'refunded',
    'cleaner_declined',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

alter table public.bookings
  alter column status drop default;

alter table public.bookings
  alter column status type public.booking_status
  using (
    case status::text
      when 'pending' then 'pending_request'
      when 'accepted' then 'estimate_proposed'
      when 'paid' then 'payment_authorized'
      when 'in_progress' then 'in_progress'
      when 'completed' then 'completed'
      when 'declined' then 'cleaner_declined'
      when 'cancelled' then 'cancelled'
      else 'pending_request'
    end
  )::public.booking_status;

alter table public.bookings
  alter column status set default 'pending_request';

-- =========================
-- BOOKING EVENT COMPATIBILITY
-- =========================
-- Convert booking_status_events columns BEFORE dropping booking_status_old,
-- because from_status and to_status still depend on the old type at this point.

alter table public.booking_status_events
  alter column from_status type public.booking_status
  using (
    case
      when from_status is null then null
      when from_status::text = 'pending' then 'pending_request'
      when from_status::text = 'accepted' then 'estimate_proposed'
      when from_status::text = 'paid' then 'payment_authorized'
      when from_status::text = 'in_progress' then 'in_progress'
      when from_status::text = 'completed' then 'completed'
      when from_status::text = 'declined' then 'cleaner_declined'
      when from_status::text = 'cancelled' then 'cancelled'
      else 'pending_request'
    end
  )::public.booking_status;

alter table public.booking_status_events
  alter column to_status type public.booking_status
  using (
    case
      when to_status is null then null
      when to_status::text = 'pending' then 'pending_request'
      when to_status::text = 'accepted' then 'estimate_proposed'
      when to_status::text = 'paid' then 'payment_authorized'
      when to_status::text = 'in_progress' then 'in_progress'
      when to_status::text = 'completed' then 'completed'
      when to_status::text = 'declined' then 'cleaner_declined'
      when to_status::text = 'cancelled' then 'cancelled'
      else 'pending_request'
    end
  )::public.booking_status;

-- All dependents converted; safe to drop the old type now.
drop type if exists public.booking_status_old;

-- =========================
-- ROLE HELPERS
-- =========================

create or replace function public.is_cleaner_pending()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'cleaner_pending'
  );
$$;

create or replace function public.is_cleaner_active()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'cleaner_active'
  );
$$;

create or replace function public.is_cleaner()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('cleaner_pending', 'cleaner_active')
  );
$$;

-- =========================
-- PLATFORM SETTINGS + ROLLOUT
-- =========================

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  booking_fee_percent numeric(5,2) not null default 12.50,
  booking_fee_fixed_cents integer not null default 0,
  cleaner_subscription_monthly_cents integer not null default 2900,
  free_cleaner_trial_count integer not null default 30,
  free_cleaner_trial_months integer not null default 3,
  currency text not null default 'GBP',
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id is not null)
);

create trigger trg_platform_settings_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

create policy "Admin reads platform settings"
on public.platform_settings
for select
using (public.is_admin());

create policy "Admin manages platform settings"
on public.platform_settings
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.platform_settings (id)
select gen_random_uuid()
where not exists (select 1 from public.platform_settings);

create table if not exists public.city_rollout (
  id uuid primary key default gen_random_uuid(),
  city text not null unique,
  country text not null default 'UK',
  enabled boolean not null default false,
  launched_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_city_rollout_updated_at
before update on public.city_rollout
for each row execute function public.set_updated_at();

alter table public.city_rollout enable row level security;

create policy "Public reads enabled rollout cities"
on public.city_rollout
for select
using (enabled = true or public.is_admin());

create policy "Admin manages city rollout"
on public.city_rollout
for all
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- CUSTOMER PREFERENCES
-- =========================

create table if not exists public.customer_preferences (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  address_line_1 text,
  address_line_2 text,
  postcode text,
  has_pets boolean,
  preferred_cleaner_gender text,
  room_count integer,
  notes text,
  setup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_customer_preferences_updated_at
before update on public.customer_preferences
for each row execute function public.set_updated_at();

alter table public.customer_preferences enable row level security;

create policy "Customer reads own preferences"
on public.customer_preferences
for select
using (customer_id = auth.uid() and public.is_customer());

create policy "Customer inserts own preferences"
on public.customer_preferences
for insert
with check (customer_id = auth.uid() and public.is_customer());

create policy "Customer updates own preferences"
on public.customer_preferences
for update
using (customer_id = auth.uid() and public.is_customer())
with check (customer_id = auth.uid() and public.is_customer());
