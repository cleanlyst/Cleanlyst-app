-- ============================================================
-- REASSIGNMENT SYSTEM
--
-- Adds:
--   1. Tracking columns: original_cleaner_id, reassigned_at,
--      reassigned_by, reassignment_requested_at
--   2. New booking_status enum value: reassign_requested
--   3. request_reassignment RPC — customer requests replacement
--      when cleaner cancelled or did not show
--   4. Updated reassign_booking RPC — admin immediately assigns
--      a new cleaner with status = accepted and full audit trail
-- ============================================================

-- ── 1. Schema additions ──────────────────────────────────────

alter table public.bookings
  add column if not exists original_cleaner_id      uuid references public.profiles(id),
  add column if not exists reassigned_at            timestamptz,
  add column if not exists reassigned_by            uuid references public.profiles(id),
  add column if not exists reassignment_requested_at timestamptz;

-- ── 2. New status value ──────────────────────────────────────

alter type public.booking_status add value if not exists 'reassign_requested';

-- ── 3. request_reassignment — customer-side ──────────────────
-- Customer calls this when their cleaner cancelled or didn't show
-- and they want a replacement rather than a refund.

create or replace function public.request_reassignment(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_prev_status public.booking_status;
  v_admin_id    uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status::text not in ('cleaner_cancelled', 'cleaner_no_show') then
    raise exception 'Reassignment can only be requested when cleaner cancelled or did not show (current: %)', v_booking.status;
  end if;
  -- Idempotent: already requested
  if v_booking.reassignment_requested_at is not null then
    return v_booking;
  end if;

  v_prev_status := v_booking.status;

  update public.bookings
  set status                    = 'reassign_requested',
      reassignment_requested_at = now(),
      updated_at                = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, actor_role)
  values (p_booking_id, v_prev_status, 'reassign_requested', auth.uid(), 'customer');

  -- Notify all admins so they can act quickly
  for v_admin_id in select id from public.profiles where role = 'admin' loop
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (
      v_admin_id,
      'reassign_requested',
      'Replacement cleaner requested',
      'A customer has requested a replacement cleaner for their booking.',
      p_booking_id,
      jsonb_build_object(
        'booking_id', p_booking_id,
        'customer_id', v_booking.customer_id,
        'cleaner_id',  v_booking.cleaner_id
      )
    );
  end loop;

  return v_booking;
end;
$$;

grant execute on function public.request_reassignment(uuid) to authenticated;

-- ── 4. reassign_booking — admin-side ─────────────────────────
-- Admin selects a replacement cleaner. The new cleaner is
-- immediately accepted (no pending flow). Full audit trail is
-- written: original_cleaner_id, reassigned_at, reassigned_by.

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
  v_booking        public.bookings;
  v_old_cleaner_id uuid;
  v_customer_id    uuid;
  v_prev_status    public.booking_status;
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
    raise exception 'Booking cannot be reassigned in current status: %', v_booking.status;
  end if;

  v_old_cleaner_id := v_booking.cleaner_id;
  v_customer_id    := v_booking.customer_id;
  v_prev_status    := v_booking.status;

  update public.bookings
  set cleaner_id               = p_new_cleaner_id,
      status                   = 'accepted',
      -- Preserve the very first original cleaner across multiple reassignments
      original_cleaner_id      = coalesce(original_cleaner_id, v_old_cleaner_id),
      reassigned_at            = now(),
      reassigned_by            = auth.uid(),
      -- Reset operational timestamps for the new cleaner
      accepted_at              = now(),
      started_at               = null,
      completed_at             = null,
      updated_at               = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, actor_id, notes, actor_role
  )
  values (
    p_booking_id,
    v_prev_status,
    'accepted',
    auth.uid(),
    coalesce(p_note, 'Booking reassigned by admin'),
    'admin'
  );

  -- Notify new cleaner
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    p_new_cleaner_id,
    'booking_reassigned',
    'You have been assigned a booking',
    'You have been assigned a booking.',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'customer_id', v_customer_id)
  );

  -- Notify customer
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_customer_id,
    'booking_reassigned',
    'Replacement cleaner assigned',
    'A replacement cleaner has been assigned to your booking.',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'cleaner_id', p_new_cleaner_id)
  );

  -- Notify original cleaner only if different from new
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

grant execute on function public.reassign_booking(uuid, uuid, text) to authenticated;
