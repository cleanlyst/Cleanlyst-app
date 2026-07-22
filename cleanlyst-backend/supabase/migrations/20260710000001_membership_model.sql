-- ── Phase M — Membership Model ──────────────────────────────────────────────
--
-- COMMERCIAL MODEL CHANGE
-- -----------------------
-- Cleanlyst moves from a per-transaction marketplace to a membership-based
-- trusted network. Customers purchase access to vetted cleaners; booking fees
-- and per-transaction commissions are no longer the primary revenue mechanism.
--
-- WHAT THIS MIGRATION ADDS
-- ────────────────────────
-- 1. membership_status  enum      — free | active | paused | cancelled | complimentary
-- 2. booking_payment_method enum  — card | cash | bank_transfer
-- 3. membership_plans   table     — admin-configurable plans (price, name, Stripe price ID)
-- 4. customer_memberships table   — one row per customer, tracks current plan & status
-- 5. cleaner_profiles   column    — accepted_payment_methods text[] (default '{card}')
-- 6. bookings           column    — payment_method booking_payment_method (nullable, default 'card')
-- 7. RLS policies for new tables
-- 8. Admin RPCs for membership management
-- 9. Helper functions: is_member(), get_active_plan()
--
-- BACKWARDS COMPATIBILITY
-- ───────────────────────
-- • accepted_payment_methods defaults to '{card}' — existing cleaners are unaffected
-- • payment_method defaults to 'card' — existing bookings are unaffected
-- • customer_memberships row is created on first access — no hard requirement
-- • Booking gate enforced in application layer (router guard) not DB for now
--   (DB-level enforcement added via RLS when membership billing is live)
--
-- WHAT IS NOT CHANGED
-- ───────────────────
-- • bookings state machine                    (unchanged)
-- • payment_ledger_events / Stripe webhooks   (unchanged)
-- • cleaner_subscriptions                     (renamed conceptually to "membership" in UI only)
-- • existing RLS on bookings, payments        (unchanged)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. membership_status enum ───────────────────────────────────────────────

do $$ begin
  create type public.membership_status as enum (
    'free',
    'active',
    'paused',
    'cancelled',
    'complimentary'
  );
exception when duplicate_object then null; end $$;

-- ── 2. booking_payment_method enum ──────────────────────────────────────────

do $$ begin
  create type public.booking_payment_method as enum (
    'card',
    'cash',
    'bank_transfer'
  );
exception when duplicate_object then null; end $$;

-- ── 3. membership_plans ──────────────────────────────────────────────────────

create table if not exists public.membership_plans (
  id                uuid         primary key default gen_random_uuid(),
  name              text         not null,
  description       text,
  price_pence       integer      not null check (price_pence >= 0),
  billing_interval  text         not null default 'monthly'
                                   check (billing_interval in ('monthly', 'annual')),
  stripe_price_id   text         unique,
  active            boolean      not null default true,
  sort_order        integer      not null default 0,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

create trigger trg_membership_plans_updated_at
before update on public.membership_plans
for each row execute function public.set_updated_at();

alter table public.membership_plans enable row level security;

-- Everyone can read active plans (needed for upsell / signup page)
create policy "Everyone reads active membership plans"
on public.membership_plans
for select
using (active = true or public.is_admin());

-- Only admins can manage plans
create policy "Admin manages membership plans"
on public.membership_plans
for all
using (public.is_admin())
with check (public.is_admin());

-- Seed a default monthly plan (idempotent)
insert into public.membership_plans (name, description, price_pence, billing_interval, sort_order)
values (
  'Cleanlyst Member',
  'Full access to verified, fully vetted cleaners. Book, review, and manage your home cleaning with confidence.',
  999,
  'monthly',
  1
)
on conflict do nothing;

-- ── 4. customer_memberships ──────────────────────────────────────────────────

create table if not exists public.customer_memberships (
  id                       uuid               primary key default gen_random_uuid(),
  customer_id              uuid               not null unique references public.profiles(id) on delete cascade,
  plan_id                  uuid               references public.membership_plans(id) on delete set null,
  status                   public.membership_status not null default 'free',
  stripe_customer_id       text               unique,
  stripe_subscription_id   text               unique,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  trial_ends_at            timestamptz,
  cancelled_at             timestamptz,
  paused_at                timestamptz,
  granted_by               uuid               references public.profiles(id) on delete set null,
  grant_reason             text,
  notes                    text,
  created_at               timestamptz        not null default now(),
  updated_at               timestamptz        not null default now()
);

create trigger trg_customer_memberships_updated_at
before update on public.customer_memberships
for each row execute function public.set_updated_at();

create index idx_customer_memberships_customer on public.customer_memberships(customer_id);
create index idx_customer_memberships_status   on public.customer_memberships(status);

alter table public.customer_memberships enable row level security;

-- Customer reads their own membership
create policy "Customer reads own membership"
on public.customer_memberships
for select
using (customer_id = auth.uid());

-- Admin has full access
create policy "Admin manages customer memberships"
on public.customer_memberships
for all
using (public.is_admin())
with check (public.is_admin());

-- ── 5. cleaner_profiles: accepted_payment_methods ───────────────────────────

alter table public.cleaner_profiles
  add column if not exists accepted_payment_methods text[] not null default '{card}';

-- ── 6. bookings: payment_method ─────────────────────────────────────────────

alter table public.bookings
  add column if not exists payment_method public.booking_payment_method default 'card';

-- ── 7. Helper functions ──────────────────────────────────────────────────────

-- Returns true if the calling user has an active or complimentary membership
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_memberships cm
    where cm.customer_id = auth.uid()
      and cm.status in ('active', 'complimentary')
  );
$$;

grant execute on function public.is_member() to authenticated;

-- Returns the current plan for the calling customer (null if none)
create or replace function public.get_my_membership()
returns public.customer_memberships
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.customer_memberships
  where customer_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_membership() to authenticated;

-- Upserts a free membership record for the calling customer
-- Called on first dashboard load to ensure every customer has a row
create or replace function public.ensure_customer_membership()
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_memberships;
begin
  insert into public.customer_memberships (customer_id, status)
  values (auth.uid(), 'free')
  on conflict (customer_id) do nothing;

  select * into v_row
  from public.customer_memberships
  where customer_id = auth.uid();

  return v_row;
end;
$$;

grant execute on function public.ensure_customer_membership() to authenticated;

-- ── 8. Admin RPCs for membership management ─────────────────────────────────

-- Grant a complimentary membership
create or replace function public.admin_grant_membership(
  p_customer_id uuid,
  p_plan_id     uuid  default null,
  p_reason      text  default null,
  p_notes       text  default null
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_memberships;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = 'PGRST';
  end if;

  insert into public.customer_memberships (customer_id, plan_id, status, granted_by, grant_reason, notes)
  values (p_customer_id, p_plan_id, 'complimentary', auth.uid(), p_reason, p_notes)
  on conflict (customer_id) do update set
    plan_id      = excluded.plan_id,
    status       = 'complimentary',
    granted_by   = excluded.granted_by,
    grant_reason = excluded.grant_reason,
    notes        = excluded.notes,
    cancelled_at = null,
    paused_at    = null,
    updated_at   = now();

  select * into v_row from public.customer_memberships where customer_id = p_customer_id;
  return v_row;
end;
$$;

grant execute on function public.admin_grant_membership(uuid, uuid, text, text) to authenticated;

-- Cancel a membership
create or replace function public.admin_cancel_membership(
  p_customer_id uuid,
  p_reason      text  default null
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_memberships;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = 'PGRST';
  end if;

  update public.customer_memberships
  set
    status       = 'cancelled',
    cancelled_at = now(),
    paused_at    = null,
    notes        = coalesce(p_reason, notes),
    updated_at   = now()
  where customer_id = p_customer_id;

  if not found then
    raise exception 'Membership not found for customer %', p_customer_id;
  end if;

  select * into v_row from public.customer_memberships where customer_id = p_customer_id;
  return v_row;
end;
$$;

grant execute on function public.admin_cancel_membership(uuid, text) to authenticated;

-- Pause a membership
create or replace function public.admin_pause_membership(
  p_customer_id uuid,
  p_reason      text default null
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_memberships;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = 'PGRST';
  end if;

  update public.customer_memberships
  set
    status    = 'paused',
    paused_at = now(),
    notes     = coalesce(p_reason, notes),
    updated_at = now()
  where customer_id = p_customer_id
    and status in ('active', 'complimentary');

  if not found then
    raise exception 'No active membership found for customer %', p_customer_id;
  end if;

  select * into v_row from public.customer_memberships where customer_id = p_customer_id;
  return v_row;
end;
$$;

grant execute on function public.admin_pause_membership(uuid, text) to authenticated;

-- Reactivate a paused or cancelled membership
create or replace function public.admin_reactivate_membership(
  p_customer_id uuid,
  p_plan_id     uuid default null,
  p_notes       text default null
)
returns public.customer_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_memberships;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = 'PGRST';
  end if;

  update public.customer_memberships
  set
    status       = 'active',
    plan_id      = coalesce(p_plan_id, plan_id),
    paused_at    = null,
    cancelled_at = null,
    notes        = coalesce(p_notes, notes),
    updated_at   = now()
  where customer_id = p_customer_id;

  if not found then
    raise exception 'Membership not found for customer %', p_customer_id;
  end if;

  select * into v_row from public.customer_memberships where customer_id = p_customer_id;
  return v_row;
end;
$$;

grant execute on function public.admin_reactivate_membership(uuid, uuid, text) to authenticated;

-- Admin: create or update a membership plan
create or replace function public.admin_upsert_membership_plan(
  p_id               uuid    default null,
  p_name             text    default null,
  p_description      text    default null,
  p_price_pence      integer default null,
  p_billing_interval text    default null,
  p_stripe_price_id  text    default null,
  p_active           boolean default null,
  p_sort_order       integer default null
)
returns public.membership_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.membership_plans;
  v_id  uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = 'PGRST';
  end if;

  if p_id is null then
    -- Create new plan
    if p_name is null or p_price_pence is null then
      raise exception 'name and price_pence are required when creating a plan';
    end if;
    insert into public.membership_plans
      (name, description, price_pence, billing_interval, stripe_price_id, active, sort_order)
    values
      (p_name, p_description, p_price_pence,
       coalesce(p_billing_interval, 'monthly'),
       p_stripe_price_id,
       coalesce(p_active, true),
       coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    -- Update existing plan
    update public.membership_plans set
      name             = coalesce(p_name, name),
      description      = coalesce(p_description, description),
      price_pence      = coalesce(p_price_pence, price_pence),
      billing_interval = coalesce(p_billing_interval, billing_interval),
      stripe_price_id  = coalesce(p_stripe_price_id, stripe_price_id),
      active           = coalesce(p_active, active),
      sort_order       = coalesce(p_sort_order, sort_order),
      updated_at       = now()
    where id = p_id;

    if not found then
      raise exception 'Membership plan % not found', p_id;
    end if;
    v_id := p_id;
  end if;

  select * into v_row from public.membership_plans where id = v_id;
  return v_row;
end;
$$;

grant execute on function public.admin_upsert_membership_plan(uuid, text, text, integer, text, text, boolean, integer) to authenticated;

-- Admin: list all members (for the membership management dashboard)
create or replace function public.admin_list_members(
  p_status public.membership_status default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  membership_id   uuid,
  customer_id     uuid,
  customer_name   text,
  customer_email  text,
  plan_name       text,
  status          public.membership_status,
  current_period_end timestamptz,
  created_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cm.id              as membership_id,
    cm.customer_id,
    p.full_name        as customer_name,
    p.email            as customer_email,
    mp.name            as plan_name,
    cm.status,
    cm.current_period_end,
    cm.created_at
  from public.customer_memberships cm
  join public.profiles p on p.id = cm.customer_id
  left join public.membership_plans mp on mp.id = cm.plan_id
  where (p_status is null or cm.status = p_status)
  order by cm.created_at desc
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.admin_list_members(membership_status, integer, integer) to authenticated;

-- ── 9. Enable realtime on new tables ────────────────────────────────────────

alter publication supabase_realtime add table public.customer_memberships;
