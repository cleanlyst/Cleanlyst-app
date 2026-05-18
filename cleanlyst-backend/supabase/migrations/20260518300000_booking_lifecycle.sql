-- Add new booking status values for the simplified lifecycle
alter type public.booking_status add value if not exists 'accepted';
alter type public.booking_status add value if not exists 'declined';
alter type public.booking_status add value if not exists 'scheduled';

-- Add new columns to bookings
alter table public.bookings
  add column if not exists duration_minutes integer,
  add column if not exists hourly_rate_cents integer,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists decline_reason text,
  add column if not exists booking_edit_note text;

-- Recreate transition_booking_state with new lifecycle transitions
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

  -- New simplified lifecycle
  if v_source_status = 'pending_request' and p_target_status = 'accepted' and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'pending_request' and p_target_status = 'declined' and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'scheduled' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- Legacy lifecycle (backward compatibility for existing records)
  elsif v_source_status = 'pending_request' and p_target_status in ('estimate_proposed', 'cleaner_declined') and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'estimate_proposed' and p_target_status = 'awaiting_customer_payment' and v_actor_is_customer then
    v_is_allowed := true;
  elsif v_source_status = 'awaiting_customer_payment' and p_target_status = 'payment_authorized' and v_actor_is_customer then
    v_is_allowed := true;
  elsif v_source_status = 'payment_authorized' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- Common transitions shared by both lifecycles
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
  set
    status = p_target_status,
    decline_reason = case when p_target_status = 'declined' then coalesce(p_note, decline_reason) else decline_reason end,
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

-- Process dummy payment: accepted → scheduled + insert payments record
create or replace function public.process_booking_payment(
  p_booking_id uuid
)
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

  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_booking.status != 'accepted' then
    raise exception 'Booking must be in accepted state before payment (current: %)', v_booking.status;
  end if;

  if v_booking.payment_status = 'paid' then
    raise exception 'Booking is already paid';
  end if;

  update public.bookings
  set
    status = 'scheduled',
    payment_status = 'paid',
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.payments (booking_id, status, amount_cents, currency, captured_at)
  values (
    p_booking_id,
    'captured',
    coalesce(v_booking.quote_cents, 0),
    coalesce(v_booking.currency, 'GBP'),
    now()
  )
  on conflict (booking_id) do update
    set
      status = 'captured',
      captured_at = excluded.captured_at,
      updated_at = now();

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'accepted', 'scheduled', auth.uid());

  return v_booking;
end;
$$;

-- Update booking duration and recalculate quote (cleaner can edit when pending/accepted)
create or replace function public.update_booking_duration(
  p_booking_id uuid,
  p_duration_minutes integer
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_new_payout_cents integer;
  v_new_quote_cents integer;
  v_new_scheduled_end timestamptz;
  v_edit_note text;
  v_old_hours numeric;
  v_new_hours numeric;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  if v_booking.cleaner_id != auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_booking.status not in ('pending_request', 'accepted', 'estimate_proposed') then
    raise exception 'Cannot edit duration at this stage (status: %)', v_booking.status;
  end if;

  if v_booking.hourly_rate_cents is null then
    raise exception 'Hourly rate not set on this booking';
  end if;

  if p_duration_minutes <= 0 then
    raise exception 'Duration must be greater than zero';
  end if;

  -- Recalculate financials: subtotal = hourly_rate * hours, quote = subtotal * 1.07
  v_new_payout_cents := round(v_booking.hourly_rate_cents::numeric * p_duration_minutes / 60);
  v_new_quote_cents := round(v_new_payout_cents * 1.07);
  v_new_scheduled_end := v_booking.scheduled_start + (p_duration_minutes || ' minutes')::interval;

  -- Build customer-facing change note
  v_old_hours := round(coalesce(v_booking.duration_minutes, 0)::numeric / 60, 1);
  v_new_hours := round(p_duration_minutes::numeric / 60, 1);
  v_edit_note :=
    'Cleaner updated this booking — Duration: ' || v_old_hours || 'h → ' || v_new_hours || 'h' ||
    ', New total: £' || to_char(coalesce(v_booking.quote_cents, 0)::numeric / 100, 'FM999990.00') ||
    ' → £' || to_char(v_new_quote_cents::numeric / 100, 'FM999990.00');

  update public.bookings
  set
    duration_minutes = p_duration_minutes,
    scheduled_end = v_new_scheduled_end,
    quote_cents = v_new_quote_cents,
    cleaner_payout_cents = v_new_payout_cents,
    booking_edit_note = v_edit_note,
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;
