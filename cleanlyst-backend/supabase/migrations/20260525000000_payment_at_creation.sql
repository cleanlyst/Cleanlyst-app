-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: payment_at_creation
-- Implements upfront payment: customer pays at booking creation, not after
-- cleaner acceptance. Adds additional-payment columns for estimate revisions.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. New columns on bookings
alter table public.bookings
  add column if not exists requires_additional_payment boolean not null default false,
  add column if not exists additional_payment_cents    integer,
  add column if not exists initial_quote_cents         integer;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. record_initial_payment
--    Called immediately after booking creation to mark payment as captured.
--    Works on pending_request bookings (before cleaner acceptance).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_initial_payment(p_booking_id uuid)
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
  -- Idempotent: if already paid, return as-is
  if v_booking.payment_status = 'captured' then
    return v_booking;
  end if;

  update public.bookings
  set payment_status      = 'captured',
      paid_at             = now(),
      initial_quote_cents = quote_cents,
      updated_at          = now()
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
    set status      = 'captured',
        captured_at = now(),
        amount_cents = excluded.amount_cents,
        updated_at  = now();

  return v_booking;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. record_additional_payment
--    Customer pays the outstanding amount after a cleaner proposes a revised
--    (higher) estimate. Resets the booking to pending_request so the cleaner
--    can now accept with full payment in place.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_additional_payment(p_booking_id uuid)
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
  if not v_booking.requires_additional_payment then
    raise exception 'No additional payment is required for this booking';
  end if;

  update public.bookings
  set payment_status              = 'captured',
      requires_additional_payment = false,
      additional_payment_cents    = null,
      paid_at                     = now(),
      status                      = 'pending_request',
      updated_at                  = now()
  where id = p_booking_id
  returning * into v_booking;

  -- Bring the payment record up to the new total amount
  update public.payments
  set status      = 'captured',
      amount_cents = coalesce(v_booking.quote_cents, 0),
      captured_at  = now(),
      updated_at   = now()
  where booking_id = p_booking_id;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'estimate_proposed', 'pending_request', auth.uid());

  return v_booking;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. propose_estimate  (updated)
--    Now calculates whether the customer owes an additional amount and sets
--    requires_additional_payment / additional_payment_cents accordingly.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.propose_estimate(
  p_booking_id  uuid,
  p_quote_cents integer,
  p_note        text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking              public.bookings;
  v_old_status           public.booking_status;
  v_cleaner_payout_cents bigint;
  v_already_paid_cents   integer;
  v_additional_cents     integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised to propose an estimate for this booking';
  end if;
  if v_booking.status not in ('pending_request', 'accepted') then
    raise exception 'Can only propose an estimate for pending or accepted bookings (current: %)', v_booking.status;
  end if;
  if p_quote_cents <= 0 then
    raise exception 'Quote must be greater than zero';
  end if;

  v_old_status           := v_booking.status;
  v_cleaner_payout_cents := round(p_quote_cents * 0.93);

  -- How much has the customer already paid (use initial amount if recorded)
  v_already_paid_cents := coalesce(v_booking.initial_quote_cents, v_booking.quote_cents, 0);
  v_additional_cents   := p_quote_cents - v_already_paid_cents;

  update public.bookings
  set quote_cents                 = p_quote_cents,
      cleaner_payout_cents        = v_cleaner_payout_cents,
      booking_edit_note           = p_note,
      status                      = 'estimate_proposed',
      requires_additional_payment = (v_additional_cents > 0),
      additional_payment_cents    = case when v_additional_cents > 0 then v_additional_cents else null end,
      updated_at                  = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_old_status, 'estimate_proposed', auth.uid());

  return v_booking;
end;
$$;
