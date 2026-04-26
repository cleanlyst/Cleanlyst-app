-- =========================
-- SUBSCRIPTION TYPES
-- =========================

do $$ begin
  create type public.subscription_status as enum ('trial', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

-- =========================
-- BOOKING FINANCIAL SNAPSHOTS
-- =========================

create table if not exists public.booking_financials (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  quote_cents integer not null,
  platform_fee_cents integer not null,
  booking_fee_cents integer not null,
  cleaner_payout_cents integer not null,
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_financials_nonnegative check (
    quote_cents >= 0
    and platform_fee_cents >= 0
    and booking_fee_cents >= 0
    and cleaner_payout_cents >= 0
  )
);

create trigger trg_booking_financials_updated_at
before update on public.booking_financials
for each row execute function public.set_updated_at();

alter table public.booking_financials enable row level security;

create policy "Participants read booking financials"
on public.booking_financials
for select
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_financials.booking_id
      and (b.customer_id = auth.uid() or b.cleaner_id = auth.uid() or public.is_admin())
  )
);

-- =========================
-- PAYMENTS + PAYOUTS + WEBHOOK LOG
-- =========================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  status public.payment_status not null default 'unpaid',
  amount_cents integer not null,
  currency text not null default 'GBP',
  authorized_at timestamptz,
  captured_at timestamptz,
  refunded_at timestamptz,
  failed_at timestamptz,
  last_webhook_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create index idx_payments_booking on public.payments(booking_id);
create index idx_payments_status on public.payments(status);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  amount_cents integer not null,
  currency text not null default 'GBP',
  stripe_transfer_id text unique,
  status text not null default 'pending',
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_payouts_updated_at
before update on public.payouts
for each row execute function public.set_updated_at();

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null,
  processing_error text
);

alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy "Participants read payments"
on public.payments
for select
using (
  exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id
      and (b.customer_id = auth.uid() or b.cleaner_id = auth.uid() or public.is_admin())
  )
);

create policy "Admin manages payments"
on public.payments
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Cleaner and admin read payouts"
on public.payouts
for select
using (cleaner_id = auth.uid() or public.is_admin());

create policy "Admin manages payouts"
on public.payouts
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Admin reads webhook events"
on public.payment_webhook_events
for select
using (public.is_admin());

create policy "Admin inserts webhook events"
on public.payment_webhook_events
for insert
with check (public.is_admin());

create policy "Admin updates webhook events"
on public.payment_webhook_events
for update
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- CLEANER SUBSCRIPTIONS
-- =========================

create table if not exists public.cleaner_subscriptions (
  cleaner_id uuid primary key references public.profiles(id) on delete cascade,
  status public.subscription_status not null default 'trial',
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_cleaner_subscriptions_updated_at
before update on public.cleaner_subscriptions
for each row execute function public.set_updated_at();

alter table public.cleaner_subscriptions enable row level security;

create policy "Cleaner reads own subscription"
on public.cleaner_subscriptions
for select
using (cleaner_id = auth.uid() and public.is_cleaner());

create policy "Admin manages subscriptions"
on public.cleaner_subscriptions
for all
using (public.is_admin())
with check (public.is_admin());
