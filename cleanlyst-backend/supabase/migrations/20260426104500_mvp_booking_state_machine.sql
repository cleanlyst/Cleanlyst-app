-- =========================
-- BOOKING FLOW TYPES
-- =========================

do $$ begin
  create type public.dispute_status as enum (
    'open',
    'investigating',
    'resolved_customer_refund',
    'resolved_cleaner_release',
    'closed'
  );
exception when duplicate_object then null; end $$;

-- =========================
-- BOOKING REQUEST LAYER
-- =========================

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  preferred_start timestamptz not null,
  preferred_end timestamptz not null,
  location_text text not null,
  customer_note text,
  proposed_estimated_hours numeric(5,2),
  cleaner_response_note text,
  status public.booking_status not null default 'pending_request',
  declined_reason text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_requests_time_check check (preferred_end > preferred_start)
);

create trigger trg_booking_requests_updated_at
before update on public.booking_requests
for each row execute function public.set_updated_at();

create index idx_booking_requests_customer on public.booking_requests(customer_id);
create index idx_booking_requests_cleaner on public.booking_requests(cleaner_id);

alter table public.booking_requests enable row level security;

create policy "Customer manages own booking requests"
on public.booking_requests
for all
using (customer_id = auth.uid() and public.is_customer())
with check (customer_id = auth.uid() and public.is_customer());

create policy "Cleaner reads assigned booking requests"
on public.booking_requests
for select
using (
  cleaner_id = auth.uid()
  and public.is_cleaner_active()
);

create policy "Cleaner updates assigned booking requests"
on public.booking_requests
for update
using (
  cleaner_id = auth.uid()
  and public.is_cleaner_active()
)
with check (
  cleaner_id = auth.uid()
  and public.is_cleaner_active()
);

create policy "Admin reads all booking requests"
on public.booking_requests
for select
using (public.is_admin());

-- =========================
-- BOOKING TABLE ADDITIONS
-- =========================

alter table public.bookings
  add column if not exists booking_request_id uuid references public.booking_requests(id),
  add column if not exists estimated_hours numeric(5,2),
  add column if not exists customer_confirmed_completed_at timestamptz,
  add column if not exists dispute_opened_at timestamptz,
  add column if not exists dispute_resolved_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_quote_nonnegative_check;

alter table public.bookings
  add constraint bookings_quote_nonnegative_check check (quote_cents >= 0);

-- =========================
-- DISPUTES
-- =========================

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete cascade,
  status public.dispute_status not null default 'open',
  reason text not null,
  admin_resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create trigger trg_disputes_updated_at
before update on public.disputes
for each row execute function public.set_updated_at();

create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;

create policy "Participants read dispute"
on public.disputes
for select
using (
  customer_id = auth.uid()
  or cleaner_id = auth.uid()
  or public.is_admin()
);

create policy "Customer creates dispute for own booking"
on public.disputes
for insert
with check (
  customer_id = auth.uid()
  and opened_by = auth.uid()
  and public.is_customer()
);

create policy "Admin updates disputes"
on public.disputes
for update
using (public.is_admin())
with check (public.is_admin());

create policy "Participants read dispute messages"
on public.dispute_messages
for select
using (
  exists (
    select 1
    from public.disputes d
    where d.id = dispute_messages.dispute_id
      and (
        d.customer_id = auth.uid()
        or d.cleaner_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy "Participants send dispute messages"
on public.dispute_messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.disputes d
    where d.id = dispute_messages.dispute_id
      and (
        d.customer_id = auth.uid()
        or d.cleaner_id = auth.uid()
        or public.is_admin()
      )
  )
);

-- =========================
-- BOOKING TRANSITION RPC
-- =========================

create or replace function public.transition_booking_state(
  p_booking_id uuid,
  p_target_status public.booking_status,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_source_status public.booking_status;
  v_actor_is_customer boolean;
  v_actor_is_cleaner boolean;
  v_actor_is_admin boolean;
  v_is_allowed boolean := false;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  v_source_status := v_booking.status;
  v_actor_is_customer := v_booking.customer_id = auth.uid();
  v_actor_is_cleaner := v_booking.cleaner_id = auth.uid();
  v_actor_is_admin := public.is_admin();

  if not (v_actor_is_customer or v_actor_is_cleaner or v_actor_is_admin) then
    raise exception 'Not authorized to transition this booking';
  end if;

  if v_source_status = 'pending_request' and p_target_status in ('estimate_proposed', 'cleaner_declined') and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'estimate_proposed' and p_target_status = 'awaiting_customer_payment' and v_actor_is_customer then
    v_is_allowed := true;
  elsif v_source_status = 'awaiting_customer_payment' and p_target_status = 'payment_authorized' and v_actor_is_customer then
    v_is_allowed := true;
  elsif v_source_status = 'payment_authorized' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'in_progress' and p_target_status = 'completion_pending_customer' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'completion_pending_customer' and p_target_status in ('completed', 'disputed') and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'disputed' and p_target_status in ('refunded', 'completed') and v_actor_is_admin then
    v_is_allowed := true;
  elsif v_source_status in ('pending_request', 'estimate_proposed', 'awaiting_customer_payment') and p_target_status = 'cancelled' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition from % to %', v_source_status, p_target_status;
  end if;

  update public.bookings
  set
    status = p_target_status,
    completed_at = case when p_target_status = 'completed' then now() else completed_at end,
    customer_confirmed_completed_at = case when p_target_status = 'completed' then now() else customer_confirmed_completed_at end,
    dispute_opened_at = case when p_target_status = 'disputed' then now() else dispute_opened_at end,
    dispute_resolved_at = case when p_target_status in ('completed', 'refunded') and v_source_status = 'disputed' then now() else dispute_resolved_at end,
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_source_status, p_target_status, auth.uid());

  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (
      v_booking.id,
      v_booking.customer_id,
      v_booking.cleaner_id,
      auth.uid(),
      coalesce(p_note, 'Dispute opened by participant')
    )
    on conflict (booking_id) do nothing;
  end if;

  return v_booking;
end;
$$;
