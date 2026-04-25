-- =========================
-- EXTENSIONS
-- =========================
create extension if not exists pgcrypto;

-- =========================
-- ENUMS
-- =========================
do $$ begin
  create type public.user_role as enum ('customer', 'cleaner', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cleaner_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum (
    'pending',
    'accepted',
    'declined',
    'paid',
    'in_progress',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'unpaid',
    'authorized',
    'captured',
    'refunded',
    'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pricing_model as enum ('hourly', 'fixed');
exception when duplicate_object then null; end $$;

-- =========================
-- HELPERS
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- PROFILES
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text not null,
  phone text,
  avatar_url text,
  city text,
  country text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users view own profile"
on public.profiles
for select
using (id = auth.uid());

create policy "Users update own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- =========================
-- FUNCTION DEFINITIONS
-- =========================
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_cleaner()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'cleaner'
  );
$$;

create or replace function public.is_customer()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'customer'
  );
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- =========================
-- CLEANER PROFILES
-- =========================
create table public.cleaner_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text,
  bio text,
  service_radius_km integer,
  hourly_rate_cents integer,
  currency text not null default 'GBP',
  status public.cleaner_status not null default 'pending',
  stripe_account_id text unique,
  onboarding_complete boolean not null default false,
  average_rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cleaner_profiles enable row level security;

create policy "Public read approved cleaner profiles"
on public.cleaner_profiles
for select
using (status = 'approved');

create policy "Cleaner manages own cleaner profile"
on public.cleaner_profiles
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create trigger trg_cleaner_profiles_updated_at
before update on public.cleaner_profiles
for each row execute function public.set_updated_at();

-- =========================
-- SERVICES
-- =========================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  pricing_model public.pricing_model default 'hourly',
  base_price_cents integer not null,
  duration_minutes integer,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create index idx_services_cleaner on public.services(cleaner_id);

-- 🔒 FIXED SECURITY POLICY
alter table public.services enable row level security;

create policy "Public can view active services"
on public.services
for select
using (active = true);

create policy "Cleaner inserts own services"
on public.services
for insert
with check (cleaner_id = auth.uid() and public.is_cleaner());

create policy "Cleaner updates own services"
on public.services
for update
using (cleaner_id = auth.uid())
with check (cleaner_id = auth.uid());

create policy "Cleaner deletes own services"
on public.services
for delete
using (cleaner_id = auth.uid());

-- =========================
-- AVAILABILITY
-- =========================
create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_available boolean default true,
  created_at timestamptz default now()
);

alter table public.availability_slots enable row level security;

create policy "Cleaner manages availability"
on public.availability_slots
for select
using (cleaner_id = auth.uid());

create policy "Cleaner inserts own availability"
on public.availability_slots
for insert
with check (cleaner_id = auth.uid() and public.is_cleaner());

create policy "Cleaner updates own availability"
on public.availability_slots
for update
using (cleaner_id = auth.uid())
with check (cleaner_id = auth.uid());

create policy "Cleaner deletes own availability"
on public.availability_slots
for delete
using (cleaner_id = auth.uid());

-- =========================
-- BOOKINGS
-- =========================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  cleaner_id uuid not null references public.profiles(id),
  service_id uuid not null references public.services(id),

  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',

  service_title_snapshot text,
  category_snapshot text,
  description_snapshot text,

  location_text text not null,
  notes text,

  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,

  quote_cents integer not null,
  cleaner_payout_cents integer not null,
  currency text not null default 'GBP',

  stripe_payment_intent_id text,

  accepted_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint bookings_scheduled_range_check check (scheduled_end > scheduled_start),
  constraint bookings_quote_nonnegative_check check (quote_cents >= 0),
  constraint bookings_payout_nonnegative_check check (cleaner_payout_cents >= 0)
);

create trigger trg_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create index idx_bookings_customer on public.bookings(customer_id);
create index idx_bookings_cleaner on public.bookings(cleaner_id);

alter table public.bookings enable row level security;

create policy "Users view own bookings"
on public.bookings
for select
using (
  customer_id = auth.uid()
  or cleaner_id = auth.uid()
);

create policy "Customers create bookings"
on public.bookings
for insert
with check (customer_id = auth.uid() and public.is_customer());

create policy "Cleaner updates own bookings"
on public.bookings
for update
using (cleaner_id = auth.uid())
with check (cleaner_id = auth.uid());

-- =========================
-- BOOKING STATUS EVENTS
-- =========================
create table public.booking_status_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status,
  actor_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.booking_status_events enable row level security;

create policy "Participants can view booking events"
on public.booking_status_events
for select
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_status_events.booking_id
    and (b.customer_id = auth.uid() or b.cleaner_id = auth.uid())
  )
);

-- =========================
-- MESSAGES
-- =========================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Participants can view messages"
on public.messages
for select
using (
  exists (
    select 1 from public.bookings b
    where b.id = messages.booking_id
    and (b.customer_id = auth.uid() or b.cleaner_id = auth.uid())
  )
);

create policy "Participants send messages"
on public.messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = messages.booking_id
    and (b.customer_id = auth.uid() or b.cleaner_id = auth.uid())
  )
);

-- =========================
-- REVIEWS
-- =========================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.bookings(id),
  reviewer_id uuid references public.profiles(id),
  reviewee_id uuid references public.profiles(id),
  rating integer check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

alter table public.reviews enable row level security;

create policy "Public read reviews"
on public.reviews
for select
using (true);

create policy "Participants create reviews"
on public.reviews
for insert
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = reviews.booking_id
    and b.status = 'completed'
    and (
      (b.customer_id = auth.uid() and reviews.reviewee_id = b.cleaner_id)
      or (b.cleaner_id = auth.uid() and reviews.reviewee_id = b.customer_id)
    )
  )
);

create or replace function public.accept_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_booking public.bookings;
begin
  update public.bookings
  set
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  where id = p_booking_id
    and cleaner_id = auth.uid()
    and status = 'pending'
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'Booking not found or cannot be accepted';
  end if;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (updated_booking.id, 'pending', 'accepted', auth.uid());

  return updated_booking;
end;
$$;

-- =========================
-- AUTO PROFILE CREATION
-- =========================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'customer'),
    coalesce(new.raw_user_meta_data->>'full_name', 'New User')
  );

  if (new.raw_user_meta_data->>'role') = 'cleaner' then
    insert into public.cleaner_profiles (user_id)
    values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
