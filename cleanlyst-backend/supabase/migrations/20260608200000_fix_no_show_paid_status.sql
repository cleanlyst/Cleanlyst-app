-- ============================================================
-- Fix: report_cleaner_no_show — allow 'paid' status
--
-- Root cause: EPIC 4 (20260602400000) introduced the 'paid'
-- auto-advance (accepted → paid when payment already captured),
-- but report_cleaner_no_show was written before that migration
-- and only guards on 'accepted' | 'cleaner_no_show'. Every
-- lifecycle RPC that touches active bookings (start_booking,
-- cleaner_cannot_attend, cancel_booking_customer) was updated
-- to accept 'paid'; this one was missed.
--
-- Impact: customer clicks "Cleaner Didn't Show" on a paid
-- booking and receives "Only accepted bookings can be reported
-- as no-show" even though the frontend correctly shows the
-- button for status = 'paid'.
-- ============================================================

create or replace function public.report_cleaner_no_show(
  p_booking_id uuid,
  p_action     text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking       public.bookings;
  v_target_status public.booking_status;
  v_no_show_action text;
  v_admin_id      uuid;
begin
  if p_action not in ('replacement', 'refund') then
    raise exception 'Invalid no-show action: %', p_action;
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.started_at is not null then
    raise exception 'This booking has already been started';
  end if;
  if v_booking.status = 'completed' then
    raise exception 'Completed bookings cannot be reported as no-show';
  end if;
  -- Allow 'paid' (EPIC 4 auto-advance) in addition to legacy 'accepted'
  if v_booking.status::text not in ('accepted', 'paid', 'cleaner_no_show') then
    raise exception 'Only accepted or paid bookings can be reported as no-show (current: %)', v_booking.status;
  end if;
  if now() <= v_booking.scheduled_start + interval '30 minutes' then
    raise exception 'Cleaner no-show can be reported 30 minutes after the booking start time';
  end if;
  -- Idempotent: already reported
  if v_booking.no_show_action is not null then
    return v_booking;
  end if;

  if p_action = 'replacement' then
    v_target_status  := 'cleaner_no_show';
    v_no_show_action := 'replacement_requested';
  else
    v_target_status  := 'cancelled';
    v_no_show_action := 'refund_requested';
  end if;

  update public.bookings
  set status              = v_target_status,
      no_show_reported_at = now(),
      no_show_action      = v_no_show_action,
      cancellation_reason = case when p_action = 'refund' then 'cleaner_no_show' else cancellation_reason end,
      cancelled_at        = case when p_action = 'refund' then now() else cancelled_at end,
      payment_status      = case when p_action = 'refund' then 'refunded' else payment_status end,
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  if p_action = 'refund' then
    update public.payments
    set status      = 'refunded',
        refunded_at = now(),
        updated_at  = now()
    where booking_id = p_booking_id
      and status <> 'refunded';
  end if;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, actor_role)
  values (p_booking_id, 'accepted', v_target_status, auth.uid(), 'customer');

  for v_admin_id in select id from public.profiles where role = 'admin' loop
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (
      v_admin_id,
      'cleaner_no_show',
      'Cleaner did not attend booking',
      case
        when p_action = 'replacement' then 'Customer requested another cleaner.'
        else 'Customer requested a refund.'
      end,
      p_booking_id,
      jsonb_build_object(
        'booking_id', p_booking_id,
        'cleaner_id', v_booking.cleaner_id,
        'customer_id', v_booking.customer_id,
        'action', v_no_show_action
      )
    );
  end loop;

  return v_booking;
end;
$$;
