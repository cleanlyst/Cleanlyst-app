-- ============================================================
-- IMPROVED REASSIGNMENT SYSTEM
--
-- 1. Extend reassign_booking (admin) to support optional new date
-- 2. Add customer_reassign_booking — customer directly picks a
--    replacement cleaner after cleaner_cancelled / cleaner_no_show
--    without waiting for admin. No additional payment required.
-- ============================================================

-- ── 1. Admin: reassign_booking with optional date change ─────
-- Drop old 3-param signature so we can replace with 4-param.

drop function if exists public.reassign_booking(uuid, uuid, text);

create or replace function public.reassign_booking(
  p_booking_id           uuid,
  p_new_cleaner_id       uuid,
  p_note                 text        default null,
  p_new_scheduled_start  timestamptz default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking        public.bookings;
  v_old_cleaner_id uuid;
  v_customer_id    uuid;
  v_prev_status    public.booking_status;
  v_new_end        timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reassign bookings';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if v_booking.status::text not in (
    'cleaner_no_show', 'accepted', 'in_progress', 'pending_request',
    'cleaner_cancelled', 'reassign_requested', 'paid'
  ) then
    raise exception 'Booking cannot be reassigned in status: %', v_booking.status;
  end if;

  v_old_cleaner_id := v_booking.cleaner_id;
  v_customer_id    := v_booking.customer_id;
  v_prev_status    := v_booking.status;

  -- Preserve original duration when rescheduling
  if p_new_scheduled_start is not null then
    v_new_end := p_new_scheduled_start + (v_booking.scheduled_end - v_booking.scheduled_start);
  end if;

  update public.bookings
  set cleaner_id          = p_new_cleaner_id,
      status              = 'accepted',
      original_cleaner_id = coalesce(original_cleaner_id, v_old_cleaner_id),
      reassigned_at       = now(),
      reassigned_by       = auth.uid(),
      accepted_at         = now(),
      started_at          = null,
      completed_at        = null,
      scheduled_start     = coalesce(p_new_scheduled_start, scheduled_start),
      scheduled_end       = coalesce(v_new_end, scheduled_end),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, actor_id, notes, actor_role
  ) values (
    p_booking_id, v_prev_status, 'accepted',
    auth.uid(), coalesce(p_note, 'Booking reassigned by admin'), 'admin'
  );

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    p_new_cleaner_id, 'booking_reassigned', 'You have been assigned a booking',
    'You have been assigned a booking.',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'customer_id', v_customer_id)
  );

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_customer_id, 'booking_reassigned', 'Replacement cleaner assigned',
    'A replacement cleaner has been assigned to your booking.',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'cleaner_id', p_new_cleaner_id)
  );

  if v_old_cleaner_id is not null and v_old_cleaner_id != p_new_cleaner_id then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (
      v_old_cleaner_id, 'booking_reassigned', 'Booking reassigned',
      'This booking has been reassigned to another cleaner.',
      p_booking_id,
      jsonb_build_object('booking_id', p_booking_id)
    );
  end if;

  return v_booking;
end;
$$;

grant execute on function public.reassign_booking(uuid, uuid, text, timestamptz) to authenticated;


-- ── 2. Customer: directly select a replacement cleaner ───────
-- Allowed when status is cleaner_cancelled, cleaner_no_show, or
-- reassign_requested. No extra payment required.

create or replace function public.customer_reassign_booking(
  p_booking_id           uuid,
  p_new_cleaner_id       uuid,
  p_new_scheduled_start  timestamptz default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_old_cleaner uuid;
  v_prev_status public.booking_status;
  v_new_end     timestamptz;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status::text not in ('cleaner_cancelled', 'cleaner_no_show', 'reassign_requested') then
    raise exception 'Replacement can only be chosen after cleaner cancellation or no-show (current: %)', v_booking.status;
  end if;

  v_old_cleaner := v_booking.cleaner_id;
  v_prev_status := v_booking.status;

  if p_new_scheduled_start is not null then
    v_new_end := p_new_scheduled_start + (v_booking.scheduled_end - v_booking.scheduled_start);
  end if;

  update public.bookings
  set cleaner_id          = p_new_cleaner_id,
      status              = 'accepted',
      original_cleaner_id = coalesce(original_cleaner_id, v_old_cleaner),
      reassigned_at       = now(),
      accepted_at         = now(),
      started_at          = null,
      completed_at        = null,
      scheduled_start     = coalesce(p_new_scheduled_start, scheduled_start),
      scheduled_end       = coalesce(v_new_end, scheduled_end),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, actor_id, notes, actor_role
  ) values (
    p_booking_id, v_prev_status, 'accepted',
    auth.uid(), 'Customer selected replacement cleaner', 'customer'
  );

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    p_new_cleaner_id, 'booking_reassigned', 'You have been assigned a booking',
    'A customer has selected you as their replacement cleaner.',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'customer_id', v_booking.customer_id)
  );

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_booking.customer_id, 'booking_reassigned', 'Replacement cleaner confirmed',
    'Your replacement cleaner has been confirmed.',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'cleaner_id', p_new_cleaner_id)
  );

  if v_old_cleaner is not null and v_old_cleaner != p_new_cleaner_id then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (
      v_old_cleaner, 'booking_reassigned', 'Booking reassigned',
      'Your booking has been assigned to a new cleaner by the customer.',
      p_booking_id,
      jsonb_build_object('booking_id', p_booking_id)
    );
  end if;

  return v_booking;
end;
$$;

grant execute on function public.customer_reassign_booking(uuid, uuid, timestamptz) to authenticated;
