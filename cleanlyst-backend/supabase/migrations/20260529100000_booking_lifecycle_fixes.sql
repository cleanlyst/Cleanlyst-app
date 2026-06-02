-- ============================================================
-- Booking lifecycle fixes
-- 1. Start-cleaning window: 30 min → 60 min
-- 2. reassign_booking RPC for admin cleaner reassignment
-- 3. admin_stats seed row (no-op if already exists)
-- ============================================================

-- ── 1. Update start_booking: 60-minute window ───────────────
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
  if now() < v_booking.scheduled_start - interval '60 minutes' then
    raise exception 'Start Cleaning is available 1 hour before the booking time';
  end if;

  update public.bookings
  set status     = 'in_progress',
      started_at = now(),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'accepted', 'in_progress', auth.uid());

  return v_booking;
end;
$$;

-- ── 2. Update transition_booking_state: 60-minute window ────
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
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
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

-- ── 3. reassign_booking RPC (admin only) ────────────────────
create or replace function public.reassign_booking(
  p_booking_id     uuid,
  p_new_cleaner_id uuid,
  p_note           text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking         public.bookings;
  v_old_cleaner_id  uuid;
  v_customer_id     uuid;
  v_prev_status     public.booking_status;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reassign bookings';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if v_booking.status not in ('cleaner_no_show', 'accepted', 'pending_request') then
    raise exception 'Booking cannot be reassigned in current status: %', v_booking.status;
  end if;

  v_old_cleaner_id := v_booking.cleaner_id;
  v_customer_id    := v_booking.customer_id;
  v_prev_status    := v_booking.status;

  update public.bookings
  set cleaner_id   = p_new_cleaner_id,
      status       = 'accepted',
      accepted_at  = now(),
      started_at   = null,
      completed_at = null,
      updated_at   = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_prev_status, 'accepted', auth.uid());

  -- Notify new cleaner
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    p_new_cleaner_id,
    'booking_reassigned',
    'New booking assigned to you',
    'You have been assigned a reassigned booking.',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'customer_id', v_customer_id)
  );

  -- Notify customer
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_customer_id,
    'booking_reassigned',
    'New cleaner assigned',
    'A new cleaner has been assigned to your booking.',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'cleaner_id', p_new_cleaner_id)
  );

  -- Notify old cleaner if different from new cleaner
  if v_old_cleaner_id is not null and v_old_cleaner_id != p_new_cleaner_id then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (
      v_old_cleaner_id,
      'booking_reassigned',
      'Booking reassigned',
      'This booking has been reassigned to another cleaner.',
      p_booking_id,
      jsonb_build_object('booking_id', p_booking_id)
    );
  end if;

  return v_booking;
end;
$$;

-- ── 4. Seed admin_stats row if missing ──────────────────────
insert into public.admin_stats (id, total_revenue_cents, updated_at)
values (1, 0, now())
on conflict (id) do nothing;
