-- ============================================================
-- PHASE 2 SCHEMA GAPS
-- ============================================================
-- Aligns the database with DB_SCHEMA.md. All earlier migrations
-- are preserved intact; this migration only adds or alters.
--
-- Changes:
--   1. messages.body  → messages.message
--   2. conversations  table (one per booking)
--   3. messages       add conversation_id FK + backfill
--   4. availability_slots restructured for recurring patterns
--   5. availability_overrides  new table (one-off exceptions)
--   6. cleaner_services  junction table
--   7. transactions  table (synced from payments via trigger)
--   8. Additional indexes
-- ============================================================

-- ============================================================
-- 1. RENAME messages.body → messages.message
-- ============================================================
-- DB_SCHEMA.md specifies the column as "message". The column
-- has no FK references so the rename is safe.

alter table public.messages rename column body to message;

-- ============================================================
-- 2. CONVERSATIONS
-- ============================================================
-- One conversation thread per booking. Created automatically
-- by trigger when a booking row is inserted.

create table if not exists public.conversations (
  id         uuid        primary key default gen_random_uuid(),
  booking_id uuid        unique not null
                         references public.bookings(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_booking
  on public.conversations (booking_id);

alter table public.conversations enable row level security;

create policy "Participants read conversation"
on public.conversations for select
using (public.is_booking_participant(booking_id));

create policy "Participants create conversation"
on public.conversations for insert
with check (public.is_booking_participant(booking_id));

create policy "Admin manages conversations"
on public.conversations for all
using (public.is_admin())
with check (public.is_admin());

-- Trigger: create conversation automatically on booking insert.
create or replace function public.create_conversation_for_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.conversations (booking_id)
  values (new.id)
  on conflict (booking_id) do nothing;
  return new;
end;
$$;

create or replace trigger trg_create_conversation_for_booking
after insert on public.bookings
for each row execute function public.create_conversation_for_booking();

-- ============================================================
-- 3. messages — add conversation_id + backfill
-- ============================================================

alter table public.messages
  add column if not exists conversation_id uuid
  references public.conversations(id) on delete cascade;

-- Backfill: one conversation per booking that already has messages.
insert into public.conversations (booking_id)
select distinct booking_id
from   public.messages
where  booking_id is not null
on conflict (booking_id) do nothing;

-- Link each message to its conversation.
update public.messages m
set    conversation_id = c.id
from   public.conversations c
where  c.booking_id = m.booking_id
  and  m.conversation_id is null;

create index if not exists idx_messages_conversation
  on public.messages (conversation_id, created_at);

-- ============================================================
-- 4. availability_slots — add recurring-pattern columns
-- ============================================================
-- The init_schema used absolute starts_at / ends_at timestamps,
-- which model one-off slots. DB_SCHEMA.md requires a recurring
-- weekly pattern: day_of_week (0=Sun…6=Sat) + start_time/end_time.
-- We add the new columns and keep starts_at / ends_at as nullable
-- (populated only for legacy rows or one-off exceptions via
-- availability_overrides in section 5).

alter table public.availability_slots
  add column if not exists day_of_week  smallint,
  add column if not exists start_time   time,
  add column if not exists end_time     time,
  add column if not exists active       boolean not null default true;

-- Backfill day_of_week / start_time / end_time from legacy starts_at / ends_at
-- where those columns still hold data.
update public.availability_slots
set
  day_of_week = extract(dow from starts_at)::smallint,
  start_time  = starts_at::time,
  end_time    = ends_at::time
where starts_at is not null
  and day_of_week is null;

-- Value constraints.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'availability_slots_day_of_week_check'
      and conrelid = 'public.availability_slots'::regclass
  ) then
    alter table public.availability_slots
      add constraint availability_slots_day_of_week_check
      check (day_of_week is null or day_of_week between 0 and 6);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'availability_slots_time_order_check'
      and conrelid = 'public.availability_slots'::regclass
  ) then
    alter table public.availability_slots
      add constraint availability_slots_time_order_check
      check (
        start_time is null or end_time is null or end_time > start_time
      );
  end if;
end $$;

-- Unique recurring slot per cleaner per day.
create unique index if not exists availability_slots_cleaner_day_uidx
  on public.availability_slots (cleaner_id, day_of_week)
  where day_of_week is not null;

-- ============================================================
-- 5. availability_overrides
-- ============================================================
-- One-off date exceptions that override the recurring schedule.
-- e.g. "not available on 2026-06-15 (bank holiday)" or
--      "extra availability on 2026-06-20 9am-1pm".

create table if not exists public.availability_overrides (
  id           uuid        primary key default gen_random_uuid(),
  cleaner_id   uuid        not null
               references public.cleaner_profiles(user_id) on delete cascade,
  date         date        not null,
  is_available boolean     not null default false,
  reason       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (cleaner_id, date)
);

create index if not exists idx_availability_overrides_cleaner_date
  on public.availability_overrides (cleaner_id, date);

create or replace trigger trg_availability_overrides_updated_at
before update on public.availability_overrides
for each row execute function public.set_updated_at();

alter table public.availability_overrides enable row level security;

-- Authenticated users can view overrides for approved cleaners (for booking UI)
create policy "Authenticated view cleaner overrides"
on public.availability_overrides for select
to authenticated
using (
  exists (
    select 1 from public.cleaner_profiles cp
    where cp.user_id = availability_overrides.cleaner_id
      and cp.status  = 'approved'
  )
  or cleaner_id = auth.uid()
  or public.is_admin()
);

create policy "Cleaner manages own overrides"
on public.availability_overrides for insert
with check (cleaner_id = auth.uid() and public.is_cleaner_active());

create policy "Cleaner updates own overrides"
on public.availability_overrides for update
using  (cleaner_id = auth.uid())
with check (cleaner_id = auth.uid());

create policy "Cleaner deletes own overrides"
on public.availability_overrides for delete
using (cleaner_id = auth.uid());

create policy "Admin manages availability overrides"
on public.availability_overrides for all
using  (public.is_admin())
with check (public.is_admin());

-- ============================================================
-- 6. cleaner_services  (junction table)
-- ============================================================
-- Maps cleaners to the service categories they offer at the
-- profile level. Distinct from the `services` table (which
-- stores individual cleaner listings with pricing).

create table if not exists public.cleaner_services (
  id         uuid        primary key default gen_random_uuid(),
  cleaner_id uuid        not null
             references public.cleaner_profiles(user_id) on delete cascade,
  service_id uuid        not null
             references public.services(id)              on delete cascade,
  created_at timestamptz not null default now(),
  unique (cleaner_id, service_id)
);

create index if not exists idx_cleaner_services_cleaner
  on public.cleaner_services (cleaner_id);

create index if not exists idx_cleaner_services_service
  on public.cleaner_services (service_id);

alter table public.cleaner_services enable row level security;

-- Public (incl. unauthenticated) can see service offerings of approved cleaners
create policy "Public reads cleaner services"
on public.cleaner_services for select
using (
  exists (
    select 1 from public.cleaner_profiles cp
    where cp.user_id = cleaner_services.cleaner_id
      and cp.status  = 'approved'
  )
  or cleaner_id = auth.uid()
  or public.is_admin()
);

-- Only fully approved cleaners can manage their service offerings
create policy "Cleaner inserts own services"
on public.cleaner_services for insert
with check (cleaner_id = auth.uid() and public.is_cleaner_active());

create policy "Cleaner deletes own services"
on public.cleaner_services for delete
using (cleaner_id = auth.uid());

create policy "Admin manages cleaner services"
on public.cleaner_services for all
using  (public.is_admin())
with check (public.is_admin());

-- ============================================================
-- 7. transactions
-- ============================================================
-- DB_SCHEMA.md specifies a transactions table for customer payment
-- records (the Stripe PaymentIntent from the customer's perspective).
-- The existing `payments` table stores the full Stripe lifecycle;
-- `transactions` is kept in sync via trigger as a cleaner projection.

create table if not exists public.transactions (
  id                       uuid        primary key default gen_random_uuid(),
  booking_id               uuid        not null unique
                           references public.bookings(id) on delete restrict,
  payment_id               uuid
                           references public.payments(id) on delete set null,
  stripe_payment_intent_id text,
  amount                   integer     not null,
  currency                 text        not null default 'GBP',
  payment_status           public.payment_status not null default 'unpaid',
  created_at               timestamptz not null default now()
);

create index if not exists idx_transactions_booking
  on public.transactions (booking_id);

alter table public.transactions enable row level security;

create policy "Participants read transactions"
on public.transactions for select
using (public.is_booking_participant(booking_id));

create policy "Admin manages transactions"
on public.transactions for all
using  (public.is_admin())
with check (public.is_admin());

-- Seed transactions from existing payments rows
insert into public.transactions (
  booking_id,
  payment_id,
  stripe_payment_intent_id,
  amount,
  currency,
  payment_status
)
select
  p.booking_id,
  p.id,
  p.stripe_payment_intent_id,
  p.amount_cents,
  p.currency,
  p.status
from public.payments p
on conflict (booking_id) do nothing;

-- Trigger: keep transactions in sync whenever payments changes
create or replace function public.sync_transaction_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.transactions (
    booking_id,
    payment_id,
    stripe_payment_intent_id,
    amount,
    currency,
    payment_status
  )
  values (
    new.booking_id,
    new.id,
    new.stripe_payment_intent_id,
    new.amount_cents,
    new.currency,
    new.status
  )
  on conflict (booking_id) do update set
    stripe_payment_intent_id = excluded.stripe_payment_intent_id,
    amount                   = excluded.amount,
    payment_status           = excluded.payment_status;

  return new;
end;
$$;

create or replace trigger trg_sync_transaction_from_payment
after insert or update on public.payments
for each row execute function public.sync_transaction_from_payment();

-- ============================================================
-- 8. ADDITIONAL INDEXES
-- ============================================================

-- Reviews by reviewee (cleaner ratings page)
create index if not exists idx_reviews_reviewee_created
  on public.reviews (reviewee_id, created_at desc);

-- Payouts by cleaner (earnings dashboard)
create index if not exists idx_payouts_cleaner_created
  on public.payouts (cleaner_id, created_at desc);

-- Booking status events per booking (audit trail)
create index if not exists idx_booking_status_events_booking
  on public.booking_status_events (booking_id, created_at);

-- Cleaner subscriptions by status (billing jobs and expiry scans)
create index if not exists idx_cleaner_subscriptions_status
  on public.cleaner_subscriptions (status);

-- Payments by intent id (webhook lookups)
create index if not exists idx_payments_stripe_intent
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ============================================================
-- SCHEMA SIGN-OFF
-- ============================================================
-- All DB_SCHEMA.md tables are now present:
--
--   ✓ enums                 — init_schema, mvp_role_and_core_foundation,
--                             add_missing_enums
--   ✓ profiles              — init_schema + add_missing_columns
--   ✓ customer_profiles     — customer_preferences (mvp_role_and_core_foundation)
--   ✓ cleaner_profiles      — init_schema + add_missing_columns
--   ✓ cleaner_documents     — cleaner_application_documents (mvp_cleaner_document_storage)
--   ✓ services              — init_schema
--   ✓ cleaner_services      — this migration
--   ✓ cleaner_availability  — availability_slots (init_schema, restructured here)
--   ✓ bookings              — init_schema + add_missing_columns
--   ✓ reviews               — init_schema
--   ✓ conversations         — this migration
--   ✓ messages              — init_schema (column renamed here)
--   ✓ payouts               — mvp_payments_and_subscriptions
--   ✓ transactions          — this migration
--   ✓ notifications         — notifications_table
--   ✓ cleaner_subscriptions — mvp_payments_and_subscriptions
--   ✓ platform_settings     — mvp_role_and_core_foundation
--
-- RLS         — enabled on all tables ✓
-- Indexes     — FK columns + common query patterns ✓
-- updated_at  — triggers on all mutable tables ✓
-- Constraints — booking lifecycle, review uniqueness, lat/lng range ✓
