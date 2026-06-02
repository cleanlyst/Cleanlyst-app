-- Fix reassign_booking: set status = 'pending_request' so the new cleaner
-- goes through the normal accept/decline flow instead of being auto-accepted.

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
      status       = 'pending_request',
      accepted_at  = null,
      started_at   = null,
      completed_at = null,
      updated_at   = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_prev_status, 'pending_request', auth.uid());

  -- Notify new cleaner
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    p_new_cleaner_id,
    'booking_reassigned',
    'New booking assignment',
    'A booking has been assigned to you. Please accept or decline.',
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

  -- Notify old cleaner if different
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
