-- =============================================================================
-- FIX P2: start_booking + report_cleaner_no_show — hardcoded from_status in audit
-- =============================================================================
-- Both functions hardcode the from_status in their booking_status_events INSERT,
-- causing audit log inaccuracies when the booking was in a different but valid state.
--
-- start_booking (20260602400000): hardcodes from_status = 'paid' even though the
-- function also accepts status = 'accepted' (backward compat). Bookings still in
-- 'accepted' state that are started by the cleaner record 'paid → in_progress'
-- instead of 'accepted → in_progress'.
--
-- report_cleaner_no_show (20260608200000): hardcodes from_status = 'accepted'
-- even though the fix migration added support for status = 'paid'. A paid booking
-- reported as no-show records 'accepted → cleaner_no_show' instead of
-- 'paid → cleaner_no_show'.
--
-- Fix: capture v_prev_status before each UPDATE and use it in the audit INSERT.

-- ── 1. start_booking — use actual from_status ─────────────────

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
  -- Accept both 'paid' (EPIC 4) and 'accepted' (legacy backward compat)
  if v_booking.status not in ('paid', 'accepted') then
    raise exception 'Booking must be paid/accepted to start (current: %)', v_booking.status;
  end if;
  if v_booking.payment_status != 'captured' then
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

-- ── 2. report_cleaner_no_show — use actual from_status ────────

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
  v_booking        public.bookings;
  v_prev_status    public.booking_status;
  v_target_status  public.booking_status;
  v_no_show_action text;
  v_admin_id       uuid;
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

  v_prev_status := v_booking.status;

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
  values (p_booking_id, v_prev_status, v_target_status, auth.uid(), 'customer');

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
