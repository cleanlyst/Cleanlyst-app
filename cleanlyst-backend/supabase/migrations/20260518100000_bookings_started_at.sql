-- Add started_at timestamp to bookings and stamp it when transitioning to in_progress.
alter table public.bookings
  add column if not exists started_at timestamptz;

-- Recreate transition_booking_state with started_at stamping.
create or replace function public.transition_booking_state(
  p_booking_id uuid,
  p_target_status public.booking_status,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_source_status public.booking_status;
  v_actor_is_customer boolean;
  v_actor_is_cleaner boolean;
  v_actor_is_admin boolean;
  v_is_allowed boolean := false;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  v_source_status := v_booking.status;
  v_actor_is_customer := v_booking.customer_id = auth.uid();
  v_actor_is_cleaner := v_booking.cleaner_id = auth.uid();
  v_actor_is_admin := public.is_admin();

  if not (v_actor_is_customer or v_actor_is_cleaner or v_actor_is_admin) then
    raise exception 'Not authorized to transition this booking';
  end if;

  if v_source_status = 'pending_request' and p_target_status in ('estimate_proposed', 'cleaner_declined') and v_actor_is_cleaner then
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
  elsif v_source_status in ('pending_request', 'estimate_proposed', 'awaiting_customer_payment') and p_target_status = 'cancelled' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition from % to %', v_source_status, p_target_status;
  end if;

  update public.bookings
  set
    status = p_target_status,
    started_at = case when p_target_status = 'in_progress' then now() else started_at end,
    completed_at = case when p_target_status = 'completed' then now() else completed_at end,
    customer_confirmed_completed_at = case when p_target_status = 'completed' then now() else customer_confirmed_completed_at end,
    dispute_opened_at = case when p_target_status = 'disputed' then now() else dispute_opened_at end,
    dispute_resolved_at = case when p_target_status in ('completed', 'refunded') and v_source_status = 'disputed' then now() else dispute_resolved_at end,
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_source_status, p_target_status, auth.uid());

  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (
      v_booking.id,
      v_booking.customer_id,
      v_booking.cleaner_id,
      auth.uid(),
      coalesce(p_note, 'Dispute opened by participant')
    )
    on conflict (booking_id) do nothing;
  end if;

  return v_booking;
end;
$$;
