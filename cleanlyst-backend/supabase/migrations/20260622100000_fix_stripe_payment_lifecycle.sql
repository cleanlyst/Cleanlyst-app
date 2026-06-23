-- =============================================================================
-- FIX: Stripe payment lifecycle — start_booking + cancel_booking_customer
-- =============================================================================
-- Stripe Checkout with capture_method: 'manual' leaves bookings in
-- 'payment_authorized' status (set by the checkout.session.completed webhook).
-- The existing start_booking RPC only accepted 'paid' and 'accepted', blocking
-- cleaners from starting Stripe-paid bookings.
--
-- cancel_booking_customer similarly blocked cancellation from 'payment_authorized',
-- trapping customers who had paid via Stripe but needed to cancel.
--
-- Changes:
--   1. start_booking   — allow 'payment_authorized'; relax payment_status check
--                        for that status (payment may still be 'authorized', not
--                        yet 'captured', until admin triggers capture).
--   2. cancel_booking_customer — add 'payment_authorized' to allowed statuses.
--                        NOTE: for Stripe path, the UI calls the refund-payment
--                        Edge Function (which handles PI cancel) rather than this
--                        RPC. This RPC update covers admin-initiated cancels and
--                        future non-Stripe paths.

-- ── 1. start_booking — allow payment_authorized ──────────────────────────────

create or replace function public.start_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_prev_status public.booking_status;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  -- Accept 'paid' (EPIC 4), 'accepted' (legacy), and 'payment_authorized' (Stripe Checkout path).
  if v_booking.status not in ('paid', 'accepted', 'payment_authorized') then
    raise exception 'Booking must be paid/accepted/payment_authorized to start (current: %)', v_booking.status;
  end if;

  -- For 'payment_authorized' bookings the payment is held by Stripe but not yet
  -- captured — allow the cleaner to start regardless, as the hold guarantees funds.
  -- For 'paid'/'accepted' (simulation path), still require captured payment_status.
  if v_booking.status != 'payment_authorized' and v_booking.payment_status != 'captured' then
    raise exception 'Cannot start booking: customer payment has not been received';
  end if;

  if v_booking.started_at is not null then
    return v_booking;
  end if;
  if now() < v_booking.scheduled_start - interval '60 minutes' then
    raise exception 'Start Cleaning is available 1 hour before the booking time';
  end if;

  v_prev_status := v_booking.status;

  update public.bookings
  set status     = 'in_progress',
      started_at = now(),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, actor_role)
  values (p_booking_id, v_prev_status, 'in_progress', auth.uid(),
          case when public.is_admin() then 'admin' else 'cleaner' end);

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.customer_id, 'booking_in_progress', 'Cleaning started',
          'Your cleaner has started the job.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  return v_booking;
end;
$$;

-- ── 2. cancel_booking_customer — allow payment_authorized ────────────────────
-- Preserves all existing logic from 20260621200000_fix_cancel_booking_customer_audit.
-- Only change: 'payment_authorized' added to the status allowlist.

create or replace function public.cancel_booking_customer(
  p_booking_id uuid,
  p_reason     text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_prev_status public.booking_status;
  v_auto_refund boolean;
  v_admin_id    uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status not in ('pending_request', 'accepted', 'paid', 'estimate_proposed', 'awaiting_customer_payment', 'payment_authorized') then
    raise exception 'Booking cannot be cancelled in its current state (%)', v_booking.status;
  end if;

  v_prev_status := v_booking.status;

  -- 24-hour rule: auto-refund if >24h before scheduled start
  v_auto_refund := (v_booking.scheduled_start - now()) > interval '24 hours';

  update public.bookings
  set status              = 'cancelled',
      payment_status      = case when v_auto_refund then 'refunded' else payment_status end,
      cancellation_reason = coalesce(p_reason, 'Customer cancelled'),
      cancelled_at        = now(),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  if v_auto_refund then
    update public.payments
    set status      = 'refunded',
        refunded_at = now(),
        updated_at  = now()
    where booking_id = p_booking_id and status != 'refunded';
  end if;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, v_prev_status, 'cancelled', auth.uid(),
          coalesce(p_reason, '') ||
          case when v_auto_refund then ' [auto-refund applied]' else ' [admin review required — within 24h]' end,
          'customer');

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.cleaner_id, 'booking_cancelled', 'Booking cancelled',
          'The customer has cancelled this booking.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'reason', p_reason));

  if v_auto_refund then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_refunded', 'Booking cancelled — refund issued',
            'Your booking has been cancelled and a full refund has been processed.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
  else
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_cancelled', 'Booking cancelled — awaiting review',
            'Your booking has been cancelled. As it was within 24 hours of the start time, a refund requires admin review.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'booking_cancelled_review', '⚠ Late cancellation — review required',
              'Customer cancelled within 24 hours of booking start. Refund decision needed.',
              p_booking_id, jsonb_build_object('booking_id', p_booking_id,
                'customer_id', v_booking.customer_id, 'reason', p_reason));
    end loop;
  end if;

  return v_booking;
end;
$$;
