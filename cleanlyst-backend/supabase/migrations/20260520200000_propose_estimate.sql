-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: propose_estimate
-- Allows a cleaner to set a new quote and transition a booking to estimate_proposed
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
  v_booking             public.bookings;
  v_old_status          public.booking_status;
  v_cleaner_payout_cents bigint;
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

  update public.bookings
  set
    quote_cents           = p_quote_cents,
    cleaner_payout_cents  = v_cleaner_payout_cents,
    booking_edit_note     = p_note,
    status                = 'estimate_proposed',
    updated_at            = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_old_status, 'estimate_proposed', auth.uid());

  return v_booking;
end;
$$;
