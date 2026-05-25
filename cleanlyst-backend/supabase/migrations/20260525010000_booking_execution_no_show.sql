-- Booking execution workflow and cleaner no-show recovery.

alter type public.booking_status add value if not exists 'cleaner_no_show';

alter table public.bookings
  add column if not exists no_show_reported_at timestamptz,
  add column if not exists no_show_action text;

alter table public.notifications
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_bookings_cleaner_no_show
  on public.bookings (cleaner_id, no_show_reported_at desc)
  where no_show_action is not null;

create index if not exists idx_notifications_booking
  on public.notifications (booking_id);

-- Cleaner starts an accepted, paid booking no earlier than 30 minutes before
-- scheduled_start. The app's dummy payment flow stores paid funds as
-- payment_status='captured'.
create or replace function public.start_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status != 'accepted' then
    raise exception 'Booking must be accepted to start (current: %)', v_booking.status;
  end if;
  if v_booking.payment_status != 'captured' then
    raise exception 'Cannot start booking: customer payment has not been received';
  end if;
  if v_booking.started_at is not null then
    return v_booking;
  end if;
  if now() < v_booking.scheduled_start - interval '30 minutes' then
    raise exception 'Start Cleaning is available 30 minutes before the booking time';
  end if;

  update public.bookings
  set status = 'in_progress',
      started_at = now(),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'accepted', 'in_progress', auth.uid());

  return v_booking;
end;
$$;

-- Keep legacy callers safe by allowing accepted+captured -> in_progress through
-- transition_booking_state as well, with the same 30 minute guard.
create or replace function public.transition_booking_state(
  p_booking_id    uuid,
  p_target_status public.booking_status,
  p_note          text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking           public.bookings;
  v_source_status     public.booking_status;
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

  if v_source_status = 'pending_request' and p_target_status = 'accepted' and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'pending_request' and p_target_status = 'declined' and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'accepted' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    if v_booking.payment_status != 'captured' then
      raise exception 'Cannot start booking: customer payment has not been received';
    end if;
    if now() < v_booking.scheduled_start - interval '30 minutes' then
      raise exception 'Start Cleaning is available 30 minutes before the booking time';
    end if;
    v_is_allowed := true;
  elsif v_source_status = 'paid_pending_start' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'scheduled' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'pending_request' and p_target_status in ('estimate_proposed', 'cleaner_declined') and v_actor_is_cleaner then
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
  elsif v_source_status in ('pending_request', 'estimate_proposed', 'awaiting_customer_payment', 'accepted') and p_target_status = 'cancelled' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition from % to %', v_source_status, p_target_status;
  end if;

  update public.bookings
  set status = p_target_status,
      decline_reason = case when p_target_status = 'declined' then coalesce(p_note, decline_reason) else decline_reason end,
      started_at = case when p_target_status = 'in_progress' then now() else started_at end,
      completed_at = case when p_target_status = 'completed' then now() else completed_at end,
      customer_confirmed_completed_at = case when p_target_status = 'completed' then now() else customer_confirmed_completed_at end,
      dispute_opened_at = case when p_target_status = 'disputed' then now() else dispute_opened_at end,
      dispute_resolved_at = case when p_target_status in ('completed', 'refunded') and v_source_status = 'disputed' then now() else dispute_resolved_at end,
      cancelled_at = case when p_target_status = 'cancelled' then now() else cancelled_at end,
      cancellation_reason = case when p_target_status = 'cancelled' then coalesce(p_note, cancellation_reason) else cancellation_reason end,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_source_status, p_target_status, auth.uid());

  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (v_booking.id, v_booking.customer_id, v_booking.cleaner_id, auth.uid(), coalesce(p_note, 'Dispute opened by participant'))
    on conflict (booking_id) do nothing;
  end if;

  return v_booking;
end;
$$;

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking              public.bookings;
  v_cleaner_payout_cents bigint;
  v_platform_fee_cents   bigint;
  v_payment_id           uuid;
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

  select
    coalesce(bf.cleaner_payout_cents, v_booking.cleaner_payout_cents, 0),
    coalesce(bf.platform_revenue_cents, bf.platform_fee_cents, greatest(coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0), 0))
  into v_cleaner_payout_cents, v_platform_fee_cents
  from public.booking_financials bf
  where bf.booking_id = p_booking_id;

  if v_cleaner_payout_cents is null then
    v_cleaner_payout_cents := coalesce(v_booking.cleaner_payout_cents, 0);
  end if;
  if v_platform_fee_cents is null then
    v_platform_fee_cents := greatest(coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0), 0);
  end if;

  update public.bookings
  set status = 'completed',
      completed_at = now(),
      customer_confirmed_completed_at = now(),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.payments (
    booking_id,
    status,
    amount_cents,
    platform_fee_cents,
    cleaner_payout_cents,
    currency,
    captured_at
  )
  values (
    p_booking_id,
    'captured',
    coalesce(v_booking.quote_cents, 0),
    v_platform_fee_cents,
    v_cleaner_payout_cents,
    coalesce(v_booking.currency, 'GBP'),
    now()
  )
  on conflict (booking_id) do update
    set status = 'captured',
        platform_fee_cents = excluded.platform_fee_cents,
        cleaner_payout_cents = excluded.cleaner_payout_cents,
        captured_at = coalesce(public.payments.captured_at, now()),
        updated_at = now()
  returning id into v_payment_id;

  insert into public.payouts (booking_id, cleaner_id, payment_id, amount_cents, currency, status, released_at)
  values (
    p_booking_id,
    v_booking.cleaner_id,
    v_payment_id,
    v_cleaner_payout_cents,
    coalesce(v_booking.currency, 'GBP'),
    'released',
    now()
  )
  on conflict (booking_id) do update
    set payment_id = excluded.payment_id,
        amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        status = 'released',
        released_at = coalesce(public.payouts.released_at, now());

  update public.cleaner_profiles
  set total_earnings_cents = total_earnings_cents + v_cleaner_payout_cents
  where user_id = v_booking.cleaner_id;

  update public.admin_stats
  set total_revenue_cents = total_revenue_cents + v_platform_fee_cents,
      updated_at = now()
  where id = 1;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'in_progress', 'completed', auth.uid());

  return v_booking;
end;
$$;

create or replace function public.report_cleaner_no_show(
  p_booking_id uuid,
  p_action text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_target_status public.booking_status;
  v_no_show_action text;
  v_admin_id uuid;
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
  if v_booking.status not in ('accepted', 'cleaner_no_show') then
    raise exception 'Only accepted bookings can be reported as no-show (current: %)', v_booking.status;
  end if;
  if now() <= v_booking.scheduled_start + interval '30 minutes' then
    raise exception 'Cleaner no-show can be reported 30 minutes after the booking start time';
  end if;
  if v_booking.no_show_action is not null then
    return v_booking;
  end if;

  if p_action = 'replacement' then
    v_target_status := 'cleaner_no_show';
    v_no_show_action := 'replacement_requested';
  else
    v_target_status := 'cancelled';
    v_no_show_action := 'refund_requested';
  end if;

  update public.bookings
  set status = v_target_status,
      no_show_reported_at = now(),
      no_show_action = v_no_show_action,
      cancellation_reason = case when p_action = 'refund' then 'cleaner_no_show' else cancellation_reason end,
      cancelled_at = case when p_action = 'refund' then now() else cancelled_at end,
      payment_status = case when p_action = 'refund' then 'refunded' else payment_status end,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  if p_action = 'refund' then
    update public.payments
    set status = 'refunded',
        refunded_at = now(),
        updated_at = now()
    where booking_id = p_booking_id
      and status <> 'refunded';
  end if;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'accepted', v_target_status, auth.uid());

  for v_admin_id in
    select id from public.profiles where role = 'admin'
  loop
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
