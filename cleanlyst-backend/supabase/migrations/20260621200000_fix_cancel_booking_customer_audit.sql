-- =============================================================================
-- FIX P0: cancel_booking_customer — audit log records wrong from_status
-- =============================================================================
-- Root cause: The function performs UPDATE ... RETURNING * INTO v_booking, which
-- overwrites v_booking.status with the new value ('cancelled'). The subsequent
-- INSERT into booking_status_events uses v_booking.status as from_status, so
-- every cancellation audit event incorrectly records:
--   from_status = 'cancelled', to_status = 'cancelled'
-- instead of e.g. from_status = 'paid', to_status = 'cancelled'.
--
-- Fix: Capture v_prev_status := v_booking.status immediately after the initial
-- SELECT (before any UPDATE), then use v_prev_status in the audit INSERT.
-- Pattern mirrors cleaner_cannot_attend (20260602400000) which does this correctly.

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
  if v_booking.status not in ('pending_request', 'accepted', 'paid', 'estimate_proposed', 'awaiting_customer_payment') then
    raise exception 'Booking cannot be cancelled in its current state (%)', v_booking.status;
  end if;

  -- Capture status BEFORE the UPDATE overwrites v_booking
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

  -- Use v_prev_status (captured before UPDATE) as from_status
  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, v_prev_status, 'cancelled', auth.uid(),
          coalesce(p_reason, '') ||
          case when v_auto_refund then ' [auto-refund applied]' else ' [admin review required — within 24h]' end,
          'customer');

  -- Notify cleaner
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
