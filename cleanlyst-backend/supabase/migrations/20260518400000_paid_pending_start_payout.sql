-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: paid_pending_start lifecycle + atomic payout distribution
-- New state machine: pending_request → accepted → paid_pending_start
--                    → in_progress → completed
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. New booking status value
alter type public.booking_status add value if not exists 'paid_pending_start';

-- 2. Timestamp columns on bookings
alter table public.bookings
  add column if not exists paid_at timestamptz;

-- 3. Denormalised earnings counter on cleaner_profiles
alter table public.cleaner_profiles
  add column if not exists total_earnings_cents bigint not null default 0;

-- 4. Fee columns on payments (populated at completion time)
alter table public.payments
  add column if not exists platform_fee_cents  bigint,
  add column if not exists cleaner_payout_cents bigint;

-- 5. Singleton admin revenue table
create table if not exists public.admin_stats (
  id                  integer primary key default 1 check (id = 1),
  total_revenue_cents bigint not null default 0,
  updated_at          timestamptz not null default now()
);
insert into public.admin_stats (id, total_revenue_cents)
values (1, 0)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. process_booking_payment  →  accepted → paid_pending_start
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.process_booking_payment(
  p_booking_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status != 'accepted' then
    raise exception 'Booking must be accepted before payment (current: %)', v_booking.status;
  end if;
  if v_booking.payment_status = 'paid' then
    raise exception 'Booking is already paid';
  end if;

  update public.bookings
  set
    status         = 'paid_pending_start',
    payment_status = 'paid',
    paid_at        = now(),
    updated_at     = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.payments (booking_id, status, amount_cents, currency, captured_at)
  values (
    p_booking_id,
    'captured',
    coalesce(v_booking.quote_cents, 0),
    coalesce(v_booking.currency, 'GBP'),
    now()
  )
  on conflict (booking_id) do update
    set status     = 'captured',
        captured_at = excluded.captured_at,
        updated_at  = now();

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'accepted', 'paid_pending_start', auth.uid());

  return v_booking;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. transition_booking_state  – adds paid_pending_start → in_progress
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.transition_booking_state(
  p_booking_id   uuid,
  p_target_status public.booking_status,
  p_note          text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking          public.bookings;
  v_source_status    public.booking_status;
  v_actor_is_customer boolean;
  v_actor_is_cleaner  boolean;
  v_actor_is_admin    boolean;
  v_is_allowed        boolean := false;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  v_source_status     := v_booking.status;
  v_actor_is_customer := v_booking.customer_id = auth.uid();
  v_actor_is_cleaner  := v_booking.cleaner_id  = auth.uid();
  v_actor_is_admin    := public.is_admin();

  if not (v_actor_is_customer or v_actor_is_cleaner or v_actor_is_admin) then
    raise exception 'Not authorised to transition this booking';
  end if;

  -- ── New simplified lifecycle ────────────────────────────────────────────
  if v_source_status = 'pending_request'    and p_target_status = 'accepted'          and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'pending_request'    and p_target_status = 'declined'          and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'paid_pending_start' and p_target_status = 'in_progress'       and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- ── Legacy lifecycle (backward compat) ─────────────────────────────────
  elsif v_source_status = 'scheduled'          and p_target_status = 'in_progress'       and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'pending_request'    and p_target_status in ('estimate_proposed','cleaner_declined') and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'estimate_proposed'  and p_target_status = 'awaiting_customer_payment' and v_actor_is_customer then
    v_is_allowed := true;
  elsif v_source_status = 'awaiting_customer_payment' and p_target_status = 'payment_authorized' and v_actor_is_customer then
    v_is_allowed := true;
  elsif v_source_status = 'payment_authorized' and p_target_status = 'in_progress'       and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- ── Shared transitions ──────────────────────────────────────────────────
  elsif v_source_status = 'in_progress'        and p_target_status = 'completion_pending_customer' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'completion_pending_customer' and p_target_status in ('completed','disputed') and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'disputed'           and p_target_status in ('refunded','completed') and v_actor_is_admin then
    v_is_allowed := true;
  elsif v_source_status in ('pending_request','estimate_proposed','awaiting_customer_payment','accepted') and p_target_status = 'cancelled' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition from % to %', v_source_status, p_target_status;
  end if;

  update public.bookings
  set
    status              = p_target_status,
    decline_reason      = case when p_target_status = 'declined'   then coalesce(p_note, decline_reason)             else decline_reason  end,
    started_at          = case when p_target_status = 'in_progress' then now()                                       else started_at       end,
    completed_at        = case when p_target_status = 'completed'   then now()                                       else completed_at     end,
    customer_confirmed_completed_at = case when p_target_status = 'completed' then now()                             else customer_confirmed_completed_at end,
    dispute_opened_at   = case when p_target_status = 'disputed'   then now()                                        else dispute_opened_at end,
    dispute_resolved_at = case when p_target_status in ('completed','refunded') and v_source_status = 'disputed' then now() else dispute_resolved_at end,
    updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_source_status, p_target_status, auth.uid());

  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (v_booking.id, v_booking.customer_id, v_booking.cleaner_id, auth.uid(), coalesce(p_note,'Dispute opened by participant'))
    on conflict (booking_id) do nothing;
  end if;

  return v_booking;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. complete_booking  –  in_progress → completed + atomic payout distribution
--    Called by cleaner; customer confirmation step is skipped in the new flow.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.complete_booking(
  p_booking_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking              public.bookings;
  v_cleaner_payout_cents bigint;
  v_platform_fee_cents   bigint;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status != 'in_progress' then
    raise exception 'Booking must be in_progress to complete (current: %)', v_booking.status;
  end if;

  -- Payout split: use stored cleaner_payout_cents when available; fall back to 93/7 split
  if v_booking.cleaner_payout_cents is not null and v_booking.quote_cents is not null then
    v_cleaner_payout_cents := v_booking.cleaner_payout_cents;
    v_platform_fee_cents   := v_booking.quote_cents - v_booking.cleaner_payout_cents;
  elsif v_booking.quote_cents is not null then
    v_platform_fee_cents   := round(v_booking.quote_cents * 0.07);
    v_cleaner_payout_cents := v_booking.quote_cents - v_platform_fee_cents;
  else
    v_cleaner_payout_cents := 0;
    v_platform_fee_cents   := 0;
  end if;

  -- Mark booking completed
  update public.bookings
  set
    status                          = 'completed',
    completed_at                    = now(),
    customer_confirmed_completed_at = now(),
    updated_at                      = now()
  where id = p_booking_id
  returning * into v_booking;

  -- Release payment record and stamp fee split
  insert into public.payments (booking_id, status, amount_cents, platform_fee_cents, cleaner_payout_cents, currency)
  values (
    p_booking_id,
    'released',
    coalesce(v_booking.quote_cents, 0),
    v_platform_fee_cents,
    v_cleaner_payout_cents,
    coalesce(v_booking.currency, 'GBP')
  )
  on conflict (booking_id) do update
    set status              = 'released',
        platform_fee_cents  = excluded.platform_fee_cents,
        cleaner_payout_cents = excluded.cleaner_payout_cents,
        updated_at          = now();

  -- Credit cleaner earnings
  update public.cleaner_profiles
  set total_earnings_cents = total_earnings_cents + v_cleaner_payout_cents
  where user_id = v_booking.cleaner_id;

  -- Credit admin revenue
  update public.admin_stats
  set total_revenue_cents = total_revenue_cents + v_platform_fee_cents,
      updated_at          = now()
  where id = 1;

  -- Audit trail
  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'in_progress', 'completed', auth.uid());

  return v_booking;
end;
$$;
