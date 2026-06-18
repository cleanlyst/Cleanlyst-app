-- =============================================================================
-- FIX P2: customer_reassign_booking — no validation on p_new_cleaner_id
-- =============================================================================
-- Root cause: customer_reassign_booking (20260618100000) assigns p_new_cleaner_id
-- directly without verifying that the cleaner is approved and active. The UI
-- only surfaces cleaners from searchCleaners (filtered by approved status), but
-- the RPC is callable directly by any authenticated customer. A customer who
-- knows or guesses a suspended or pending cleaner's UUID could assign them to
-- an active booking.
--
-- Fix: Before updating the booking, verify that p_new_cleaner_id belongs to a
-- profile with role = 'cleaner_active' AND a cleaner_profiles row with
-- status = 'approved'. The same guard applies to the admin reassign_booking
-- RPC (enforced there implicitly via the admin approvals workflow, but adding
-- an explicit check here for defence-in-depth on the customer-facing path).

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

  -- Validate new cleaner is approved and active before assigning
  if not exists (
    select 1
    from public.profiles p
    join public.cleaner_profiles cp on cp.user_id = p.id
    where p.id = p_new_cleaner_id
      and p.role = 'cleaner_active'
      and cp.status = 'approved'
  ) then
    raise exception 'The selected cleaner is not available for bookings';
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
