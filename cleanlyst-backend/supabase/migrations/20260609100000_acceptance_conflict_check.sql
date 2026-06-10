-- ============================================================
-- Acceptance conflict guard
--
-- Before a booking transitions pending_request → accepted,
-- check that the assigned cleaner has no overlapping confirmed
-- booking (accepted / paid / in_progress).  Prevents a cleaner
-- being double-booked when two customers request the same slot.
--
-- Only the acceptance edge is guarded here; the existing
-- cleaner_has_booking_conflict RPC is used by the customer-side
-- search to filter results before they can even book.
-- ============================================================

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
  v_actor_role        text;
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

  v_actor_role := case
    when v_actor_is_admin    then 'admin'
    when v_actor_is_cleaner  then 'cleaner'
    when v_actor_is_customer then 'customer'
    else 'system'
  end;

  -- ── EPIC 4 canonical transitions ──────────────────────────
  -- pending_request → accepted  (cleaner accepts)
  if v_source_status = 'pending_request' and p_target_status = 'accepted' and (v_actor_is_cleaner or v_actor_is_admin) then
    -- Guard: cleaner must not have a confirmed overlapping booking
    if exists (
      select 1
      from   public.bookings b
      where  b.cleaner_id      = v_booking.cleaner_id
        and  b.id             != p_booking_id
        and  b.status::text in ('accepted', 'paid', 'in_progress')
        and  b.scheduled_start < v_booking.scheduled_end
        and  b.scheduled_end   > v_booking.scheduled_start
    ) then
      raise exception 'Cleaner is no longer available for this time slot.';
    end if;
    v_is_allowed := true;

  -- accepted → paid  (auto-advance after acceptance when payment captured)
  elsif v_source_status = 'accepted' and p_target_status = 'paid' and v_actor_is_admin then
    v_is_allowed := true;

  -- paid → in_progress  (cleaner starts job, 60-min window)
  elsif v_source_status = 'paid' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    if v_booking.payment_status != 'captured' then
      raise exception 'Cannot start booking: customer payment has not been received';
    end if;
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  -- accepted → in_progress  (backward compat: accepted bookings not yet on paid status)
  elsif v_source_status = 'accepted' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    if v_booking.payment_status != 'captured' then
      raise exception 'Cannot start booking: customer payment has not been received';
    end if;
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  -- in_progress → completed  (cleaner completes)
  elsif v_source_status = 'in_progress' and p_target_status = 'completed' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- completed → disputed  (customer raises dispute)
  elsif v_source_status = 'completed' and p_target_status = 'disputed' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;

  -- disputed → resolved paths  (admin only)
  elsif v_source_status = 'disputed' and p_target_status in ('refunded', 'completed') and v_actor_is_admin then
    v_is_allowed := true;

  -- ── DECLINE ───────────────────────────────────────────────
  elsif v_source_status = 'pending_request' and p_target_status in ('declined', 'cleaner_declined') and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- ── CANCELLATION (customer or admin) ──────────────────────
  elsif v_source_status in ('pending_request', 'accepted', 'paid') and p_target_status = 'cancelled'
    and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;

  -- ── LEGACY PATHS (estimate/payment flows) ─────────────────
  elsif v_source_status = 'paid_pending_start' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'scheduled' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'pending_request' and p_target_status = 'estimate_proposed' and v_actor_is_cleaner then
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
  elsif v_source_status = 'estimate_proposed' and p_target_status = 'cancelled' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'awaiting_customer_payment' and p_target_status = 'cancelled' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;

  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition: % → % (actor: %)', v_source_status, p_target_status, v_actor_role;
  end if;

  update public.bookings
  set status     = p_target_status,
      decline_reason = case when p_target_status in ('declined','cleaner_declined') then coalesce(p_note, decline_reason) else decline_reason end,
      accepted_at    = case when p_target_status in ('accepted','paid') and accepted_at is null then now() else accepted_at end,
      started_at     = case when p_target_status = 'in_progress' then now() else started_at end,
      completed_at   = case when p_target_status = 'completed' then now() else completed_at end,
      customer_confirmed_completed_at = case when p_target_status = 'completed' then now() else customer_confirmed_completed_at end,
      dispute_opened_at  = case when p_target_status = 'disputed' then now() else dispute_opened_at end,
      dispute_resolved_at = case when p_target_status in ('completed','refunded') and v_source_status = 'disputed' then now() else dispute_resolved_at end,
      cancelled_at       = case when p_target_status in ('cancelled','cleaner_cancelled') then now() else cancelled_at end,
      cancellation_reason = case when p_target_status in ('cancelled','cleaner_cancelled') then coalesce(p_note, cancellation_reason) else cancellation_reason end,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, v_source_status, p_target_status, auth.uid(), p_note, v_actor_role);

  -- Auto-advance accepted → paid if payment already captured
  if p_target_status = 'accepted' and v_booking.payment_status = 'captured' then
    update public.bookings
    set status = 'paid', updated_at = now()
    where id = p_booking_id
    returning * into v_booking;

    insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
    values (p_booking_id, 'accepted', 'paid', auth.uid(), 'Auto-advanced: payment already captured', 'system');
  end if;

  -- Create dispute record when transitioning to disputed
  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (v_booking.id, v_booking.customer_id, v_booking.cleaner_id, auth.uid(), coalesce(p_note, 'Dispute opened'))
    on conflict (booking_id) do nothing;
  end if;

  -- Notifications
  if p_target_status = 'accepted' or p_target_status = 'paid' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_accepted', 'Booking confirmed',
            'Your cleaner has accepted the booking.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id))
    on conflict do nothing;

  elsif p_target_status = 'declined' or p_target_status = 'cleaner_declined' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_declined', 'Booking declined',
            'Your cleaner was unable to accept this booking.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  elsif p_target_status = 'in_progress' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_in_progress', 'Cleaning started',
            'Your cleaner has started the job.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  elsif p_target_status = 'completed' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_completed', 'Cleaning complete',
            'Your cleaner has marked the job as complete.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  elsif p_target_status = 'cancelled' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.cleaner_id, 'booking_cancelled', 'Booking cancelled',
            'The booking has been cancelled.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  elsif p_target_status = 'disputed' then
    declare v_admin_id uuid;
    begin
      for v_admin_id in select id from public.profiles where role = 'admin' loop
        insert into public.notifications (user_id, type, title, body, booking_id, metadata)
        values (v_admin_id, 'booking_disputed', 'Dispute opened',
                'A customer has raised a dispute on a completed booking.',
                p_booking_id, jsonb_build_object('booking_id', p_booking_id));
      end loop;
    end;

  elsif p_target_status = 'refunded' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_refunded', 'Refund issued',
            'A refund has been issued for your booking.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
  end if;

  return v_booking;
end;
$$;
